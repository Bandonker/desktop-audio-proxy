import {
  AudioProxyServer,
  createProxyServer,
  startProxyServer,
} from '../server-impl';
import { ProxyConfig } from '../types';
import axios from 'axios';
import {
  createServer as createHttpServer,
  IncomingMessage,
  Server as NodeHttpServer,
  ServerResponse,
} from 'http';
import { createServer as createNetServer } from 'net';

// Type for error responses in tests
interface ErrorResponse {
  response: {
    status: number;
    data: {
      error: string;
      message?: string;
    };
  };
}

// Type for server address
interface ServerAddress {
  port: number;
}

// Helper to find available port for testing
async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as ServerAddress)?.port;
      server.close(() => {
        if (port) {
          resolve(port);
        } else {
          reject(new Error('Could not find available port'));
        }
      });
    });
  });
}

async function startLocalUpstreamServer(
  handler: (_req: IncomingMessage, _res: ServerResponse) => void
): Promise<{ server: NodeHttpServer; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const upstreamServer = createHttpServer(handler);

    upstreamServer.once('error', reject);
    upstreamServer.listen(0, '127.0.0.1', () => {
      const address = upstreamServer.address();
      if (!address || typeof address === 'string') {
        upstreamServer.close();
        reject(new Error('Could not determine upstream test server port'));
        return;
      }

      resolve({
        server: upstreamServer,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

async function stopLocalUpstreamServer(server: NodeHttpServer): Promise<void> {
  await new Promise<void>(resolve => server.close(() => resolve()));
}

describe('AudioProxyServer', () => {
  let server: AudioProxyServer;
  let testPort: number;

  beforeEach(async () => {
    testPort = await getAvailablePort();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('constructor', () => {
    it('should create server with default configuration', () => {
      server = new AudioProxyServer();
      expect(server).toBeInstanceOf(AudioProxyServer);
    });

    it('should create server with custom configuration', () => {
      const config: ProxyConfig = {
        port: testPort,
        host: '127.0.0.1',
        corsOrigins: 'http://localhost:3000',
        timeout: 30000,
        maxRedirects: 5,
        userAgent: 'TestAgent/1.0',
        allowedProtocols: ['http', 'https'],
        allowPrivateAddresses: true,
        enableLogging: false,
        enableTranscoding: true,
        cacheEnabled: false,
        cacheTTL: 1800,
      };

      server = new AudioProxyServer(config);
      expect(server).toBeInstanceOf(AudioProxyServer);
    });
  });

  describe('server lifecycle', () => {
    it('should start and stop server successfully', async () => {
      server = new AudioProxyServer({ port: testPort, enableLogging: false });

      await server.start();
      expect(server.getActualPort()).toBeGreaterThan(0);

      await server.stop();
    });

    it('should find alternative port when configured port is occupied', async () => {
      const occupiedPort = testPort;

      // Start a dummy server on the test port
      const dummyServer = createNetServer();
      await new Promise<void>(resolve => {
        dummyServer.listen(occupiedPort, '127.0.0.1', () => resolve());
      });

      try {
        server = new AudioProxyServer({
          port: occupiedPort,
          host: '127.0.0.1',
          enableLogging: false,
        });
        await server.start();

        // Should use a different port
        expect(server.getActualPort()).toBeGreaterThan(occupiedPort);
      } finally {
        await new Promise<void>(resolve => dummyServer.close(() => resolve()));
      }
    });

    it('should provide correct proxy URL', async () => {
      server = new AudioProxyServer({ port: testPort, host: 'localhost' });
      await server.start();

      const proxyUrl = server.getProxyUrl();
      expect(proxyUrl).toBe(`http://localhost:${server.getActualPort()}`);
    });
  });

  describe('health endpoint (integration)', () => {
    beforeEach(async () => {
      server = new AudioProxyServer({ port: testPort, enableLogging: false });
      await server.start();
    });

    it('should return health status', async () => {
      const response = await axios.get(`${server.getProxyUrl()}/health`);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        status: 'ok',
        version: '1.1.7',
        config: {
          port: server.getActualPort(),
          configuredPort: testPort,
          enableTranscoding: false,
          cacheEnabled: true,
        },
      });
      expect(typeof response.data.uptime).toBe('number');
    });
  });

  describe('info endpoint (integration)', () => {
    beforeEach(async () => {
      server = new AudioProxyServer({
        port: testPort,
        enableLogging: false,
        allowPrivateAddresses: true,
      });
      await server.start();
    });

    it('should return error when URL parameter is missing', async () => {
      try {
        await axios.get(`${server.getProxyUrl()}/info`);
        fail('Expected error but request succeeded');
      } catch (error: unknown) {
        const errorResponse = error as ErrorResponse;
        expect(errorResponse.response.status).toBe(400);
        expect(errorResponse.response.data.error).toBe(
          'URL parameter required'
        );
      }
    });

    it('should return stream info for valid URL', async () => {
      const { server: upstreamServer, baseUrl } =
        await startLocalUpstreamServer((req, res) => {
          if (req.url !== '/audio-info') {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('not found');
            return;
          }

          res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Content-Length': '12345',
            'Accept-Ranges': 'bytes',
            'Last-Modified': 'Wed, 01 Jan 2020 00:00:00 GMT',
          });
          res.end();
        });

      const testUrl = `${baseUrl}/audio-info`;
      try {
        const response = await axios.get(`${server.getProxyUrl()}/info`, {
          params: { url: testUrl },
        });

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          url: testUrl,
          status: 200,
          contentType: 'audio/mpeg',
          contentLength: '12345',
          acceptRanges: 'bytes',
          lastModified: 'Wed, 01 Jan 2020 00:00:00 GMT',
        });
      } finally {
        await stopLocalUpstreamServer(upstreamServer);
      }
    });

    it('should reject blank URL parameter values', async () => {
      try {
        await axios.get(`${server.getProxyUrl()}/info`, {
          params: { url: '   ' },
        });
        fail('Expected error but request succeeded');
      } catch (error: unknown) {
        const errorResponse = error as ErrorResponse;
        expect(errorResponse.response.status).toBe(400);
        expect(errorResponse.response.data.error).toBe(
          'URL parameter required'
        );
      }
    });

    it('should handle upstream errors properly', async () => {
      const { server: upstreamServer, baseUrl } =
        await startLocalUpstreamServer((req, res) => {
          if (req.url === '/status-404') {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('not found');
            return;
          }

          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('ok');
        });

      const testUrl = `${baseUrl}/status-404`;
      try {
        await axios.get(`${server.getProxyUrl()}/info`, {
          params: { url: testUrl },
        });
        fail('Expected error but request succeeded');
      } catch (error: unknown) {
        const errorResponse = error as ErrorResponse;
        expect(errorResponse.response.status).toBe(404);
        expect(errorResponse.response.data.error).toContain(
          'Upstream error: 404'
        );
      } finally {
        await stopLocalUpstreamServer(upstreamServer);
      }
    });

    it('should handle invalid URLs properly', async () => {
      const testUrl = 'invalid-url-format';

      try {
        await axios.get(`${server.getProxyUrl()}/info`, {
          params: { url: testUrl },
        });
        fail('Expected error but request succeeded');
      } catch (error: unknown) {
        const errorResponse = error as ErrorResponse;
        expect(errorResponse.response.status).toBe(400);
        expect(errorResponse.response.data.error).toBe('Invalid URL parameter');
      }
    });

    it('should cache info responses when cache is enabled', async () => {
      let requestCount = 0;
      const { server: upstreamServer, baseUrl } =
        await startLocalUpstreamServer((req, res) => {
          if (req.url !== '/cached-audio') {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('not found');
            return;
          }

          requestCount += 1;
          res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Content-Length': '12345',
            'Accept-Ranges': 'bytes',
            'Last-Modified': 'Wed, 01 Jan 2020 00:00:00 GMT',
          });
          res.end();
        });

      const testUrl = `${baseUrl}/cached-audio`;
      try {
        const firstResponse = await axios.get(`${server.getProxyUrl()}/info`, {
          params: { url: testUrl },
        });
        const secondResponse = await axios.get(`${server.getProxyUrl()}/info`, {
          params: { url: testUrl },
        });

        expect(firstResponse.status).toBe(200);
        expect(secondResponse.status).toBe(200);
        expect(requestCount).toBe(1);
      } finally {
        await stopLocalUpstreamServer(upstreamServer);
      }
    });

    it('should skip cache when disabled', async () => {
      await server.stop();
      server = new AudioProxyServer({
        port: testPort,
        enableLogging: false,
        allowPrivateAddresses: true,
        cacheEnabled: false,
      });
      await server.start();

      let requestCount = 0;
      const { server: upstreamServer, baseUrl } =
        await startLocalUpstreamServer((req, res) => {
          if (req.url !== '/no-cache-audio') {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('not found');
            return;
          }

          requestCount += 1;
          res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Content-Length': '12345',
            'Accept-Ranges': 'bytes',
            'Last-Modified': 'Wed, 01 Jan 2020 00:00:00 GMT',
          });
          res.end();
        });

      const testUrl = `${baseUrl}/no-cache-audio`;
      try {
        await axios.get(`${server.getProxyUrl()}/info`, {
          params: { url: testUrl },
        });
        await axios.get(`${server.getProxyUrl()}/info`, {
          params: { url: testUrl },
        });

        expect(requestCount).toBe(2);
      } finally {
        await stopLocalUpstreamServer(upstreamServer);
      }
    });
  });

  describe('proxy endpoint (integration)', () => {
    beforeEach(async () => {
      server = new AudioProxyServer({
        port: testPort,
        enableLogging: false,
        allowPrivateAddresses: true,
      });
      await server.start();
    });

    it('should return error when URL parameter is missing', async () => {
      try {
        await axios.get(`${server.getProxyUrl()}/proxy`);
        fail('Expected error but request succeeded');
      } catch (error: unknown) {
        const errorResponse = error as ErrorResponse;
        expect(errorResponse.response.status).toBe(400);
        expect(errorResponse.response.data.error).toBe(
          'URL parameter required'
        );
      }
    });

    it('should reject blank URL parameter values', async () => {
      try {
        await axios.get(`${server.getProxyUrl()}/proxy`, {
          params: { url: '   ' },
        });
        fail('Expected error but request succeeded');
      } catch (error: unknown) {
        const errorResponse = error as ErrorResponse;
        expect(errorResponse.response.status).toBe(400);
        expect(errorResponse.response.data.error).toBe(
          'URL parameter required'
        );
      }
    });

    it('should proxy audio stream successfully', async () => {
      const mockAudio = Buffer.from('mock-audio-stream-data');
      const { server: upstreamServer, baseUrl } =
        await startLocalUpstreamServer((req, res) => {
          if (req.url === '/audio') {
            res.writeHead(200, {
              'Content-Type': 'audio/mpeg',
              'Content-Length': String(mockAudio.length),
              'Accept-Ranges': 'bytes',
            });
            res.end(mockAudio);
            return;
          }

          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('not found');
        });

      const testUrl = `${baseUrl}/audio`;
      try {
        const response = await axios.get(`${server.getProxyUrl()}/proxy`, {
          params: { url: testUrl },
          responseType: 'arraybuffer',
          timeout: 10000,
        });

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('audio/mpeg');
        expect(Buffer.from(response.data)).toEqual(mockAudio);
      } finally {
        await stopLocalUpstreamServer(upstreamServer);
      }
    });

    it('should handle range requests for seeking', async () => {
      const fullPayload = Buffer.alloc(1024, 1);
      const { server: upstreamServer, baseUrl } =
        await startLocalUpstreamServer((req, res) => {
          if (req.url !== '/range-target') {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('not found');
            return;
          }

          if (req.headers.range === 'bytes=0-511') {
            const partial = fullPayload.subarray(0, 512);
            res.writeHead(206, {
              'Content-Type': 'audio/mpeg',
              'Accept-Ranges': 'bytes',
              'Content-Range': 'bytes 0-511/1024',
              'Content-Length': String(partial.length),
            });
            res.end(partial);
            return;
          }

          res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Accept-Ranges': 'bytes',
            'Content-Length': String(fullPayload.length),
          });
          res.end(fullPayload);
        });

      const testUrl = `${baseUrl}/range-target`;
      try {
        const response = await axios.get(`${server.getProxyUrl()}/proxy`, {
          params: { url: testUrl },
          headers: { Range: 'bytes=0-511' },
          responseType: 'arraybuffer',
          timeout: 10000,
        });

        expect(response.status).toBe(206);
        expect(response.headers['content-range']).toBe('bytes 0-511/1024');
        expect(Buffer.from(response.data)).toHaveLength(512);
      } finally {
        await stopLocalUpstreamServer(upstreamServer);
      }
    });

    it('should handle connection refused errors', async () => {
      const testUrl = 'http://127.0.0.1:1/audio.mp3';

      try {
        await axios.get(`${server.getProxyUrl()}/proxy`, {
          params: { url: testUrl },
          timeout: 5000,
        });
        fail('Expected error but request succeeded');
      } catch (error: unknown) {
        const errorResponse = error as ErrorResponse;
        expect(errorResponse.response.status).toBe(503);
        expect(errorResponse.response.data.error).toBe(
          'Audio source unavailable'
        );
      }
    });

    it('should handle timeout errors', async () => {
      await server.stop();
      server = new AudioProxyServer({
        port: testPort,
        enableLogging: false,
        allowPrivateAddresses: true,
        timeout: 100,
      });
      await server.start();

      const { server: upstreamServer, baseUrl } =
        await startLocalUpstreamServer((_req, res) => {
          setTimeout(() => {
            res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
            res.end(Buffer.alloc(64, 1));
          }, 500);
        });

      const testUrl = `${baseUrl}/slow-audio`;

      try {
        await axios.get(`${server.getProxyUrl()}/proxy`, {
          params: { url: testUrl },
          timeout: 5000,
        });
        fail('Expected timeout error but request succeeded');
      } catch (error: unknown) {
        const errorResponse = error as ErrorResponse;
        expect(errorResponse.response.status).toBe(408);
        expect(errorResponse.response.data.error).toBe('Request timeout');
      } finally {
        await stopLocalUpstreamServer(upstreamServer);
      }
    });
  });

  describe('security validation', () => {
    beforeEach(async () => {
      server = new AudioProxyServer({
        port: testPort,
        enableLogging: false,
      });
      await server.start();
    });

    it('should block private/local addresses by default', async () => {
      try {
        await axios.get(`${server.getProxyUrl()}/proxy`, {
          params: { url: 'http://127.0.0.1:8080/audio.mp3' },
        });
        fail('Expected private address to be blocked');
      } catch (error: unknown) {
        const errorResponse = error as ErrorResponse;
        expect(errorResponse.response.status).toBe(403);
        expect(errorResponse.response.data.error).toBe(
          'Private or local addresses are blocked'
        );
      }
    });

    it('should reject unsupported URL protocols', async () => {
      try {
        await axios.get(`${server.getProxyUrl()}/info`, {
          params: { url: 'file:///etc/passwd' },
        });
        fail('Expected unsupported protocol to be rejected');
      } catch (error: unknown) {
        const errorResponse = error as ErrorResponse;
        expect(errorResponse.response.status).toBe(400);
        expect(errorResponse.response.data.error).toBe(
          'Unsupported URL protocol'
        );
      }
    });
  });

  describe('CORS handling (integration)', () => {
    beforeEach(async () => {
      server = new AudioProxyServer({
        port: testPort,
        enableLogging: false,
        corsOrigins: 'http://localhost:3000',
      });
      await server.start();
    });

    it('should handle OPTIONS preflight requests', async () => {
      const response = await axios.options(`${server.getProxyUrl()}/proxy`, {
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Range',
        },
      });

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000'
      );
      expect(response.headers['access-control-allow-methods']).toContain('GET');
      expect(response.headers['access-control-allow-methods']).toContain(
        'OPTIONS'
      );
    });
  });

  describe('convenience functions', () => {
    it('should create proxy server with createProxyServer', () => {
      const config: ProxyConfig = { port: testPort };
      server = createProxyServer(config);
      expect(server).toBeInstanceOf(AudioProxyServer);
    });

    it('should start proxy server with startProxyServer', async () => {
      const config: ProxyConfig = { port: testPort };
      server = await startProxyServer(config);
      expect(server).toBeInstanceOf(AudioProxyServer);
      expect(server.getActualPort()).toBeGreaterThan(0);
    });
  });
});
