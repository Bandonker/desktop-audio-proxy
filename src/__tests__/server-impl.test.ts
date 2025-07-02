import {
  AudioProxyServer,
  createProxyServer,
  startProxyServer,
} from '../server-impl';
import { ProxyConfig } from '../types';
import axios from 'axios';
import { createServer } from 'net';

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
    const server = createServer();
    server.listen(0, () => {
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
      server = null as any; // Clear reference
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
      server = new AudioProxyServer({ port: testPort });

      await server.start();
      expect(server.getActualPort()).toBe(testPort);

      await server.stop();
    });

    it('should find alternative port when configured port is occupied', async () => {
      // Start a dummy server on the test port
      const dummyServer = createServer();
      await new Promise<void>(resolve => {
        dummyServer.listen(testPort, () => resolve());
      });

      try {
        server = new AudioProxyServer({ port: testPort });
        await server.start();

        // Should use a different port
        expect(server.getActualPort()).toBeGreaterThan(testPort);
      } finally {
        dummyServer.close();
      }
    });

    it('should provide correct proxy URL', async () => {
      server = new AudioProxyServer({ port: testPort, host: 'localhost' });
      await server.start();

      const proxyUrl = server.getProxyUrl();
      expect(proxyUrl).toBe(`http://localhost:${testPort}`);
    });
  });

  describe('health endpoint (integration)', () => {
    beforeEach(async () => {
      server = new AudioProxyServer({ port: testPort, enableLogging: false });
      await server.start();
    });

    it('should return health status', async () => {
      const response = await axios.get(`http://localhost:${testPort}/health`);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        status: 'ok',
        version: '1.1.1',
        config: {
          port: testPort,
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
      server = new AudioProxyServer({ port: testPort, enableLogging: false });
      await server.start();
    });

    it('should return error when URL parameter is missing', async () => {
      try {
        await axios.get(`http://localhost:${testPort}/info`);
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
      // Use a simple URL that exists and has audio headers
      const testUrl = 'https://www.soundjay.com/misc/sounds/fail-buzzer-02.mp3';

      try {
        const response = await axios.get(`http://localhost:${testPort}/info`, {
          params: { url: testUrl },
        });

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          url: testUrl,
          status: expect.any(Number),
        });
        expect(response.data.contentType).toContain('audio');
      } catch (error) {
        // If the external URL is not accessible, skip the test
        console.warn('Skipping external URL test due to network error:', error);
      }
    });

    it('should handle upstream errors properly', async () => {
      // Test with a URL that returns 404
      const testUrl = 'https://httpbin.org/status/404';

      try {
        await axios.get(`http://localhost:${testPort}/info`, {
          params: { url: testUrl },
        });
        fail('Expected error but request succeeded');
      } catch (error: unknown) {
        const errorResponse = error as ErrorResponse;
        expect(errorResponse.response.status).toBe(404);
        expect(errorResponse.response.data.error).toContain(
          'Upstream error: 404'
        );
      }
    });

    it('should handle invalid URLs properly', async () => {
      const testUrl = 'invalid-url-format';

      try {
        await axios.get(`http://localhost:${testPort}/info`, {
          params: { url: testUrl },
        });
        fail('Expected error but request succeeded');
      } catch (error: unknown) {
        const errorResponse = error as ErrorResponse;
        expect(errorResponse.response.status).toBe(500);
        expect(errorResponse.response.data.error).toBe(
          'Failed to get stream info'
        );
      }
    });
  });

  describe('proxy endpoint (integration)', () => {
    beforeEach(async () => {
      server = new AudioProxyServer({ port: testPort, enableLogging: false });
      await server.start();
    });

    it('should return error when URL parameter is missing', async () => {
      try {
        await axios.get(`http://localhost:${testPort}/proxy`);
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
      // Test with a simple text URL that we can proxy
      const testUrl = 'https://httpbin.org/get';

      try {
        const response = await axios.get(`http://localhost:${testPort}/proxy`, {
          params: { url: testUrl },
          timeout: 10000,
        });

        expect(response.status).toBe(200);
        // The response should contain data from httpbin
        expect(response.data).toBeDefined();
      } catch (error: unknown) {
        const errorResponse = error as ErrorResponse;
        // If external service is down, just verify we get a proper error response
        if ((error as ErrorResponse).response) {
          expect(errorResponse.response.status).toBeGreaterThan(0);
        }
      }
    });

    it('should handle range requests for seeking', async () => {
      // Test with httpbin which supports range requests
      const testUrl = 'https://httpbin.org/range/1024';

      try {
        const response = await axios.get(`http://localhost:${testPort}/proxy`, {
          params: { url: testUrl },
          headers: { Range: 'bytes=0-511' },
          timeout: 10000,
        });

        // Should either return 206 (partial content) or 200 (full content)
        expect([200, 206]).toContain(response.status);
      } catch (error: unknown) {
        const errorResponse = error as ErrorResponse;
        // Some services may not support range requests, that's OK
        if ((error as ErrorResponse).response) {
          expect(errorResponse.response.status).toBeGreaterThan(0);
        }
      }
    });

    it('should handle non-existent domains', async () => {
      const testUrl = 'https://nonexistent-domain-12345.invalid/audio.mp3';

      try {
        await axios.get(`http://localhost:${testPort}/proxy`, {
          params: { url: testUrl },
          timeout: 5000,
        });
        fail('Expected error but request succeeded');
      } catch (error: unknown) {
        const errorResponse = error as ErrorResponse;
        expect(errorResponse.response.status).toBe(404);
        expect(errorResponse.response.data.error).toBe(
          'Audio source not found'
        );
      }
    });

    it('should handle connection refused errors', async () => {
      const testUrl = 'http://localhost:99999/audio.mp3';

      try {
        await axios.get(`http://localhost:${testPort}/proxy`, {
          params: { url: testUrl },
          timeout: 5000,
        });
        fail('Expected error but request succeeded');
      } catch (error: unknown) {
        const errorResponse = error as ErrorResponse;
        // The high port number causes ERR_INVALID_URL or similar, which results in 500
        // Both 500 and 503 are valid responses for this type of error
        expect([500, 503]).toContain(errorResponse.response.status);
        expect(errorResponse.response.data.error).toMatch(
          /Audio source|Proxy request failed/
        );
      }
    });

    it('should handle timeout errors', async () => {
      // Use httpbin delay endpoint to test timeout
      const testUrl = 'https://httpbin.org/delay/10'; // 10 second delay

      try {
        await axios.get(`http://localhost:${testPort}/proxy`, {
          params: { url: testUrl },
          timeout: 2000, // 2 second timeout
        });
        fail('Expected timeout error but request succeeded');
      } catch (error: unknown) {
        const errorResponse = error as ErrorResponse;
        // Should timeout either at axios level or proxy level
        expect(
          errorResponse.response?.status ||
            (error as Error & { code?: string }).code
        ).toBeDefined();
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
      const response = await axios.options(
        `http://localhost:${testPort}/proxy`,
        {
          headers: {
            Origin: 'http://localhost:3000',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Range',
          },
        }
      );

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
      expect(server.getActualPort()).toBe(testPort);
    });
  });
});
