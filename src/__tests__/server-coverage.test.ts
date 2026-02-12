import {
  AudioProxyServer,
  createProxyServer,
  startProxyServer,
} from '../server-impl';
import { ProxyConfig } from '../types';
import axios from 'axios';
import { createServer as createNetServer } from 'net';
import { AxiosError } from 'axios';

interface ServerAddress {
  port: number;
}

interface ErrorResponseBody {
  error: string;
}

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

describe('AudioProxyServer - Coverage Tests', () => {
  let server: AudioProxyServer;
  let testPort: number;

  beforeEach(async () => {
    testPort = await getAvailablePort();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('health endpoint integration', () => {
    it('should provide health endpoint', async () => {
      server = new AudioProxyServer({ port: testPort, enableLogging: false });
      await server.start();

      const response = await axios.get(`${server.getProxyUrl()}/health`);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'ok');
      expect(response.data).toHaveProperty('version', '1.1.7');
      expect(response.data).toHaveProperty('uptime');
      expect(response.data.config).toHaveProperty('port');
      expect(response.data.config).toHaveProperty('enableTranscoding', false);
      expect(response.data.config).toHaveProperty('cacheEnabled', true);
    });
  });

  describe('error handling', () => {
    it('should handle info endpoint without URL parameter', async () => {
      server = new AudioProxyServer({ port: testPort, enableLogging: false });
      await server.start();

      try {
        await axios.get(`${server.getProxyUrl()}/info`);
        fail('Should have thrown an error');
      } catch (error: unknown) {
        const axiosError = error as AxiosError<ErrorResponseBody>;
        expect(axiosError.response?.status).toBe(400);
        expect(axiosError.response?.data.error).toBe('URL parameter required');
      }
    });

    it('should handle proxy endpoint without URL parameter', async () => {
      server = new AudioProxyServer({ port: testPort, enableLogging: false });
      await server.start();

      try {
        await axios.get(`${server.getProxyUrl()}/proxy`);
        fail('Should have thrown an error');
      } catch (error: unknown) {
        const axiosError = error as AxiosError<ErrorResponseBody>;
        expect(axiosError.response?.status).toBe(400);
        expect(axiosError.response?.data.error).toBe('URL parameter required');
      }
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight requests', async () => {
      server = new AudioProxyServer({
        port: testPort,
        enableLogging: false,
        corsOrigins: 'http://localhost:3000',
      });
      await server.start();

      const response = await axios.options(`${server.getProxyUrl()}/proxy`, {
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Range',
        },
      });

      expect(response.status).toBe(204);
    });
  });

  describe('configuration handling', () => {
    it('should handle logging enabled configuration', async () => {
      server = new AudioProxyServer({ port: testPort, enableLogging: true });
      await server.start();

      // Just test that it starts successfully with logging enabled
      expect(server.getActualPort()).toBeGreaterThan(0);
    });

    it('should handle custom CORS origins', async () => {
      server = new AudioProxyServer({
        port: testPort,
        corsOrigins: ['http://localhost:3000', 'http://localhost:3001'],
      });
      await server.start();

      expect(server.getActualPort()).toBeGreaterThan(0);
    });

    it('should handle all configuration options', async () => {
      const config: ProxyConfig = {
        port: testPort,
        host: 'localhost',
        corsOrigins: 'http://example.com',
        timeout: 30000,
        maxRedirects: 5,
        userAgent: 'TestAgent/1.0',
        enableLogging: false,
        enableTranscoding: true,
        cacheEnabled: false,
        cacheTTL: 1800,
      };

      server = new AudioProxyServer(config);
      await server.start();

      expect(server.getActualPort()).toBe(testPort);
      expect(server.getProxyUrl()).toBe(`http://localhost:${testPort}`);
    });
  });

  describe('port handling', () => {
    it('should find alternative port when specified port is busy', async () => {
      const busyPort = testPort;

      // Start a server on the selected port
      const firstServer = new AudioProxyServer({
        port: busyPort,
        host: '127.0.0.1',
        enableLogging: false,
      });
      await firstServer.start();

      try {
        // Try to start another server on the same port
        server = new AudioProxyServer({
          port: busyPort,
          host: '127.0.0.1',
          enableLogging: false,
        });
        await server.start();

        // Should use a different port
        expect(server.getActualPort()).toBeGreaterThan(busyPort);
      } finally {
        await firstServer.stop();
      }
    });
  });

  describe('convenience functions', () => {
    it('should create and start server with startProxyServer', async () => {
      server = await startProxyServer({ port: testPort, enableLogging: false });

      expect(server).toBeInstanceOf(AudioProxyServer);
      expect(server.getActualPort()).toBe(testPort);
    });

    it('should create server with createProxyServer', () => {
      server = createProxyServer({ port: testPort });

      expect(server).toBeInstanceOf(AudioProxyServer);
    });
  });

  describe('server state management', () => {
    it('should handle stop when server is not started', async () => {
      server = new AudioProxyServer({ port: testPort });

      // Should not throw when stopping a server that wasn't started
      await expect(server.stop()).resolves.toBeUndefined();
    });

    it('should handle multiple stop calls', async () => {
      server = new AudioProxyServer({ port: testPort, enableLogging: false });
      await server.start();

      await server.stop();
      await server.stop(); // Second stop should not throw
    });

    it('should provide correct URLs before and after start', async () => {
      server = new AudioProxyServer({ port: testPort, host: 'localhost' });

      // Before start
      expect(server.getProxyUrl()).toBe(`http://localhost:${testPort}`);
      expect(server.getActualPort()).toBe(testPort);

      // After start
      await server.start();
      expect(server.getProxyUrl()).toBe(`http://localhost:${testPort}`);
      expect(server.getActualPort()).toBe(testPort);
    });
  });
});
