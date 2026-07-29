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
import { gzipSync } from 'zlib';

// Type for error responses in tests
interface ErrorResponse {
  response: {
    status: number;
    headers: Record<string, string>;
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
        enableTranscoding: false,
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
        version: '1.1.8',
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
      let upstreamUserAgent: string | undefined;
      const { server: upstreamServer, baseUrl } =
        await startLocalUpstreamServer((req, res) => {
          if (req.url !== '/audio-info') {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('not found');
            return;
          }

          upstreamUserAgent = req.headers['user-agent'];
          res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Content-Length': '12345',
            'Accept-Ranges': 'bytes',
            'Last-Modified': 'Wed, 01 Jan 2020 00:00:00 GMT',
            'Set-Cookie': 'session=should-not-leak',
            'X-Internal-Token': 'should-not-leak',
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
        expect(response.data.headers['set-cookie']).toBeUndefined();
        expect(response.data.headers['x-internal-token']).toBeUndefined();
        expect(upstreamUserAgent).toBe('AudioProxy/1.1.8');
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

    it('should evict the least-recently-used entry at the cache bound', async () => {
      await server.stop();
      server = new AudioProxyServer({
        port: testPort,
        enableLogging: false,
        allowPrivateAddresses: true,
        maxCacheEntries: 1,
      });
      await server.start();

      const requestCounts = new Map<string, number>();
      const { server: upstreamServer, baseUrl } =
        await startLocalUpstreamServer((req, res) => {
          const requestUrl = req.url || '/';
          requestCounts.set(
            requestUrl,
            (requestCounts.get(requestUrl) || 0) + 1
          );
          res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Content-Length': '1',
          });
          res.end();
        });

      try {
        const firstUrl = `${baseUrl}/first`;
        const secondUrl = `${baseUrl}/second`;
        await axios.get(`${server.getProxyUrl()}/info`, {
          params: { url: firstUrl },
        });
        await axios.get(`${server.getProxyUrl()}/info`, {
          params: { url: secondUrl },
        });
        await axios.get(`${server.getProxyUrl()}/info`, {
          params: { url: firstUrl },
        });

        expect(requestCounts.get('/first')).toBe(2);
        expect(requestCounts.get('/second')).toBe(1);
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

    it('should normalize a generic MP3 response type for media engines', async () => {
      const mockAudio = Buffer.from('mock-mp3-data');
      const { server: upstreamServer, baseUrl } =
        await startLocalUpstreamServer((_req, res) => {
          res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(mockAudio.length),
          });
          res.end(mockAudio);
        });

      try {
        const response = await axios.get(`${server.getProxyUrl()}/proxy`, {
          params: { url: `${baseUrl}/station.mp3?token=example` },
          responseType: 'arraybuffer',
        });

        expect(response.headers['content-type']).toContain('audio/mpeg');
        expect(Buffer.from(response.data)).toEqual(mockAudio);
      } finally {
        await stopLocalUpstreamServer(upstreamServer);
      }
    });

    it('should deny a station outside the configured host allowlist', async () => {
      await server.stop();
      server = new AudioProxyServer({
        port: testPort,
        enableLogging: false,
        allowPrivateAddresses: true,
        allowedHosts: ['radio.example'],
      } as ProxyConfig);
      await server.start();

      const { server: upstreamServer, baseUrl } =
        await startLocalUpstreamServer((_req, res) => {
          res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
          res.end('audio');
        });

      try {
        await expect(
          axios.get(`${server.getProxyUrl()}/proxy`, {
            params: { url: `${baseUrl}/station` },
          })
        ).rejects.toMatchObject({
          response: {
            status: 403,
            data: {
              error: 'Target host is not allowed',
            },
          },
        });
      } finally {
        await stopLocalUpstreamServer(upstreamServer);
      }
    });

    it('should fail closed when the configured host allowlist is empty', async () => {
      await server.stop();
      server = new AudioProxyServer({
        port: testPort,
        enableLogging: false,
        allowPrivateAddresses: true,
        allowedHosts: [],
      });
      await server.start();

      await expect(
        axios.get(`${server.getProxyUrl()}/proxy`, {
          params: { url: 'http://127.0.0.1:65535/station' },
        })
      ).rejects.toMatchObject({
        response: {
          status: 403,
          data: {
            error: 'Target host is not allowed',
          },
        },
      });
    });

    it('should preserve compressed upstream bytes and encoding metadata', async () => {
      const compressedPayload = gzipSync('playlist contents');
      const { server: upstreamServer, baseUrl } =
        await startLocalUpstreamServer((req, res) => {
          if (req.url !== '/compressed') {
            res.writeHead(404);
            res.end();
            return;
          }

          res.writeHead(200, {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Content-Encoding': 'gzip',
            'Content-Length': String(compressedPayload.length),
          });
          res.end(compressedPayload);
        });

      try {
        const response = await axios.get(`${server.getProxyUrl()}/proxy`, {
          params: { url: `${baseUrl}/compressed` },
          responseType: 'arraybuffer',
          decompress: false,
        });

        expect(response.headers['content-encoding']).toBe('gzip');
        expect(Buffer.from(response.data)).toEqual(compressedPayload);
      } finally {
        await stopLocalUpstreamServer(upstreamServer);
      }
    });

    it.each([
      ['without content encoding', undefined],
      ['with identity content encoding', 'identity'],
    ] as const)(
      'should rewrite and proxy relative HLS segment URLs end to end %s',
      async (_encodingCase, contentEncoding) => {
        const segmentPayload = Buffer.from('segment-bytes');
        const { server: upstreamServer, baseUrl } =
          await startLocalUpstreamServer((req, res) => {
            if (req.url === '/entry.m3u8') {
              res.writeHead(302, { Location: '/hls/master.m3u8' });
              res.end();
              return;
            }
            if (req.url === '/hls/master.m3u8') {
              const playlist = '#EXTM3U\n#EXTINF:10,\nsegments/one.ts\n';
              const headers: Record<string, string> = {
                'Content-Type': 'application/vnd.apple.mpegurl',
                'Content-Length': String(Buffer.byteLength(playlist)),
              };
              if (contentEncoding) {
                headers['Content-Encoding'] = contentEncoding;
              }
              res.writeHead(200, headers);
              res.end(playlist);
              return;
            }
            if (req.url === '/hls/segments/one.ts') {
              res.writeHead(200, {
                'Content-Type': 'video/mp2t',
                'Content-Length': String(segmentPayload.length),
              });
              res.end(segmentPayload);
              return;
            }
            res.writeHead(404);
            res.end();
          });

        try {
          const manifestResponse = await axios.get(
            `${server.getProxyUrl()}/proxy`,
            {
              params: { url: `${baseUrl}/entry.m3u8` },
            }
          );
          const rewrittenSegmentPath = String(manifestResponse.data)
            .split('\n')
            .find(line => line.startsWith('/proxy?url='));

          expect(rewrittenSegmentPath).toBeDefined();
          expect(manifestResponse.headers['content-length']).not.toBe(
            String(Buffer.byteLength('#EXTM3U\n#EXTINF:10,\nsegments/one.ts\n'))
          );

          const segmentResponse = await axios.get(
            `${server.getProxyUrl()}${rewrittenSegmentPath}`,
            { responseType: 'arraybuffer' }
          );
          expect(Buffer.from(segmentResponse.data)).toEqual(segmentPayload);
        } finally {
          await stopLocalUpstreamServer(upstreamServer);
        }
      }
    );

    it('should preserve the upstream base for imported HLS variables', async () => {
      const segmentPayload = Buffer.from('imported-variable-segment');
      const { server: upstreamServer, baseUrl } =
        await startLocalUpstreamServer((req, res) => {
          if (req.url === '/hls/child.m3u8') {
            const playlist = [
              '#EXTM3U',
              '#EXT-X-DEFINE:IMPORT="path"',
              '#EXTINF:5,',
              '{$path}/segment.ts',
              '',
            ].join('\n');
            res.writeHead(200, {
              'Content-Type': 'application/vnd.apple.mpegurl',
              'Content-Length': String(Buffer.byteLength(playlist)),
            });
            res.end(playlist);
            return;
          }
          if (req.url === '/hls/media/segment.ts') {
            res.writeHead(200, {
              'Content-Type': 'video/mp2t',
              'Content-Length': String(segmentPayload.length),
            });
            res.end(segmentPayload);
            return;
          }
          res.writeHead(404);
          res.end();
        });

      try {
        const manifestResponse = await axios.get(
          `${server.getProxyUrl()}/proxy`,
          {
            params: { url: `${baseUrl}/hls/child.m3u8` },
          }
        );
        const rewrittenSegmentPath = String(manifestResponse.data)
          .split('\n')
          .find(line => line.startsWith('/proxy?base='));

        expect(rewrittenSegmentPath).toBe(
          `/proxy?base=${encodeURIComponent(
            `${baseUrl}/hls/child.m3u8`
          )}&reference={$path}${encodeURIComponent('/segment.ts')}`
        );

        const substitutedSegmentPath = rewrittenSegmentPath?.replace(
          '{$path}',
          'media'
        );
        const segmentResponse = await axios.get(
          `${server.getProxyUrl()}${substitutedSegmentPath}`,
          { responseType: 'arraybuffer' }
        );

        expect(Buffer.from(segmentResponse.data)).toEqual(segmentPayload);
      } finally {
        await stopLocalUpstreamServer(upstreamServer);
      }
    });

    it('should preserve URI delimiters in variables imported by child playlists', async () => {
      const segmentPayload = Buffer.from('delimited-import-segment');
      let variableTarget = '';
      const { server: upstreamServer, baseUrl } =
        await startLocalUpstreamServer((req, res) => {
          if (req.url === '/hls/master.m3u8') {
            const playlist = [
              '#EXTM3U',
              `#EXT-X-DEFINE:NAME="cdn",VALUE="${variableTarget}"`,
              '#EXT-X-STREAM-INF:BANDWIDTH=128000',
              'child.m3u8',
              '',
            ].join('\n');
            res.writeHead(200, {
              'Content-Type': 'application/vnd.apple.mpegurl',
            });
            res.end(playlist);
            return;
          }
          if (req.url === '/hls/child.m3u8') {
            const playlist = [
              '#EXTM3U',
              '#EXT-X-DEFINE:IMPORT="cdn"',
              '#EXTINF:5,',
              '{$cdn}',
              '',
            ].join('\n');
            res.writeHead(200, {
              'Content-Type': 'application/vnd.apple.mpegurl',
            });
            res.end(playlist);
            return;
          }
          if (req.url === '/media/segment.ts?token=a&quality=b') {
            res.writeHead(200, {
              'Content-Type': 'video/mp2t',
              'Content-Length': String(segmentPayload.length),
            });
            res.end(segmentPayload);
            return;
          }
          res.writeHead(404);
          res.end();
        });
      variableTarget = `${baseUrl}/media/segment.ts?token=a&quality=b#selection`;

      try {
        const masterResponse = await axios.get(
          `${server.getProxyUrl()}/proxy`,
          {
            params: { url: `${baseUrl}/hls/master.m3u8` },
          }
        );
        const childPlaylistPath = String(masterResponse.data)
          .split('\n')
          .find(line => line.startsWith('/proxy?url='));

        expect(childPlaylistPath).toContain('&hlsvars=');

        const childResponse = await axios.get(
          `${server.getProxyUrl()}${childPlaylistPath}`
        );
        const segmentPath = String(childResponse.data)
          .split('\n')
          .find(line => line.startsWith('/proxy?url='));

        expect(segmentPath).toContain(
          `/proxy?url=${encodeURIComponent(variableTarget)}`
        );
        expect(segmentPath).not.toContain('&quality=b');

        const segmentResponse = await axios.get(
          `${server.getProxyUrl()}${segmentPath}`,
          { responseType: 'arraybuffer' }
        );
        expect(Buffer.from(segmentResponse.data)).toEqual(segmentPayload);
      } finally {
        await stopLocalUpstreamServer(upstreamServer);
      }
    });

    it('should reject malformed HLS variable context before contacting upstream', async () => {
      let upstreamRequests = 0;
      const { server: upstreamServer, baseUrl } =
        await startLocalUpstreamServer((_req, res) => {
          upstreamRequests += 1;
          res.writeHead(200, {
            'Content-Type': 'application/vnd.apple.mpegurl',
          });
          res.end('#EXTM3U\n');
        });

      try {
        await expect(
          axios.get(`${server.getProxyUrl()}/proxy`, {
            params: {
              url: `${baseUrl}/master.m3u8`,
              hlsvars: 'not-valid-base64',
            },
          })
        ).rejects.toMatchObject({
          response: {
            status: 400,
            data: {
              error: 'Invalid HLS variable context',
            },
          },
        });
        expect(upstreamRequests).toBe(0);
      } finally {
        await stopLocalUpstreamServer(upstreamServer);
      }
    });

    it('should reject upstream redirects when redirect following is disabled', async () => {
      await server.stop();
      server = new AudioProxyServer({
        port: testPort,
        enableLogging: false,
        allowPrivateAddresses: true,
        maxRedirects: 0,
      });
      await server.start();

      let redirectedTargetRequests = 0;
      const { server: upstreamServer, baseUrl } =
        await startLocalUpstreamServer((req, res) => {
          if (req.url === '/redirect') {
            res.writeHead(302, { Location: '/audio' });
            res.end();
            return;
          }
          if (req.url === '/audio') {
            redirectedTargetRequests += 1;
            res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
            res.end('audio');
            return;
          }
          res.writeHead(404);
          res.end();
        });

      try {
        for (const endpoint of ['info', 'proxy']) {
          const response = await axios.get(
            `${server.getProxyUrl()}/${endpoint}`,
            {
              params: { url: `${baseUrl}/redirect` },
              maxRedirects: 0,
              validateStatus: () => true,
            }
          );

          expect(response.status).toBe(502);
          expect(response.headers.location).toBeUndefined();
          expect(response.data.error).toBe(
            'Upstream redirect was not followed'
          );
        }
        expect(redirectedTargetRequests).toBe(0);
      } finally {
        await stopLocalUpstreamServer(upstreamServer);
      }
    });

    it.each(['application/octet-stream', 'text/plain; charset=utf-8'])(
      'should normalize a generic HLS playlist type before returning it: %s',
      async upstreamContentType => {
        const playlist = '#EXTM3U\n#EXTINF:10,\nsegment.ts\n';
        const { server: upstreamServer, baseUrl } =
          await startLocalUpstreamServer((_req, res) => {
            res.writeHead(200, {
              'Content-Type': upstreamContentType,
              'Content-Length': String(Buffer.byteLength(playlist)),
            });
            res.end(playlist);
          });

        try {
          const response = await axios.get(`${server.getProxyUrl()}/proxy`, {
            params: { url: `${baseUrl}/station.m3u8` },
          });

          expect(response.headers['content-type']).toContain(
            'application/vnd.apple.mpegurl'
          );
          expect(String(response.data)).toContain('/proxy?url=');
        } finally {
          await stopLocalUpstreamServer(upstreamServer);
        }
      }
    );

    it('should pass partial HLS responses through without corrupting them', async () => {
      const partialPlaylist = Buffer.from('#EXTM3U\n#EX');
      const { server: upstreamServer, baseUrl } =
        await startLocalUpstreamServer((_req, res) => {
          res.writeHead(206, {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Content-Range': 'bytes 0-10/32',
            'Content-Length': String(partialPlaylist.length),
          });
          res.end(partialPlaylist);
        });

      try {
        const response = await axios.get(`${server.getProxyUrl()}/proxy`, {
          params: { url: `${baseUrl}/partial.m3u8` },
          headers: { Range: 'bytes=0-10' },
          responseType: 'arraybuffer',
        });

        expect(response.status).toBe(206);
        expect(response.headers['content-range']).toBe('bytes 0-10/32');
        expect(Buffer.from(response.data)).toEqual(partialPlaylist);
      } finally {
        await stopLocalUpstreamServer(upstreamServer);
      }
    });

    it('should clear upstream headers when an HLS playlist is too large', async () => {
      const oversizedPlaylist = Buffer.alloc(2 * 1024 * 1024 + 1, 65);
      const { server: upstreamServer, baseUrl } =
        await startLocalUpstreamServer((_req, res) => {
          res.writeHead(200, {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Content-Length': String(oversizedPlaylist.length),
          });
          res.end(oversizedPlaylist);
        });

      try {
        await axios.get(`${server.getProxyUrl()}/proxy`, {
          params: { url: `${baseUrl}/oversized.m3u8` },
        });
        fail('Expected oversized playlist to be rejected');
      } catch (error: unknown) {
        const errorResponse = error as ErrorResponse;
        expect(errorResponse.response.status).toBe(413);
        expect(errorResponse.response.headers['content-type']).toContain(
          'application/json'
        );
        expect(
          Number(errorResponse.response.headers['content-length'])
        ).toBeLessThan(oversizedPlaylist.length);
        expect(errorResponse.response.data.error).toBe(
          'HLS playlist is too large'
        );
      } finally {
        await stopLocalUpstreamServer(upstreamServer);
      }
    });

    it('should reject cyclic HLS variable expansion with a bounded error', async () => {
      const playlist = [
        '#EXTM3U',
        '#EXT-X-DEFINE:NAME="x",VALUE="{$x}{$x}"',
        '#EXTINF:5,',
        '{$x}',
        '',
      ].join('\n');
      const { server: upstreamServer, baseUrl } =
        await startLocalUpstreamServer((_req, res) => {
          res.writeHead(200, {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Content-Length': String(Buffer.byteLength(playlist)),
          });
          res.end(playlist);
        });

      try {
        await expect(
          axios.get(`${server.getProxyUrl()}/proxy`, {
            params: { url: `${baseUrl}/cyclic.m3u8` },
          })
        ).rejects.toMatchObject({
          response: {
            status: 422,
            data: {
              error: 'HLS variable expansion rejected',
            },
          },
        });
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

    it.each([
      'http://[::1]:8080/audio.mp3',
      'http://[::ffff:7f00:1]:8080/audio.mp3',
      'http://169.254.169.254/latest/meta-data',
    ])('should block non-public target %s', async targetUrl => {
      await expect(
        axios.get(`${server.getProxyUrl()}/proxy`, {
          params: { url: targetUrl },
        })
      ).rejects.toMatchObject({
        response: {
          status: 403,
          data: {
            error: 'Private or local addresses are blocked',
          },
        },
      });
    });

    it('should reject credentials embedded in target URLs', async () => {
      await expect(
        axios.get(`${server.getProxyUrl()}/info`, {
          params: { url: 'https://user:secret@example.com/audio.mp3' },
        })
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            error: 'URL credentials are not supported',
          },
        },
      });
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
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should not advertise credentialed CORS with a wildcard origin', async () => {
      await server.stop();
      server = new AudioProxyServer({
        port: testPort,
        enableLogging: false,
        corsOrigins: '*',
      });
      await server.start();

      const response = await axios.options(`${server.getProxyUrl()}/proxy`, {
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'GET',
        },
      });

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(
        response.headers['access-control-allow-credentials']
      ).toBeUndefined();
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
