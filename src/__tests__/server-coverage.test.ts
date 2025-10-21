import {
  AudioProxyServer,
  createProxyServer,
  startProxyServer,
} from '../server-impl';
import { ProxyConfig } from '../types';
import axios from 'axios';

describe('AudioProxyServer - Coverage Tests', () => {
  let server: AudioProxyServer;

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('health endpoint integration', () => {
    it('should provide health endpoint', async () => {
      server = new AudioProxyServer({ port: 5000, enableLogging: false });
      await server.start();

      const response = await axios.get(
        `http://localhost:${server.getActualPort()}/health`
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'ok');
      expect(response.data).toHaveProperty('version', '1.1.5');
      expect(response.data).toHaveProperty('uptime');
      expect(response.data.config).toHaveProperty('port');
      expect(response.data.config).toHaveProperty('enableTranscoding', false);
      expect(response.data.config).toHaveProperty('cacheEnabled', true);
    });
  });

  describe('error handling', () => {
    it('should handle info endpoint without URL parameter', async () => {
      server = new AudioProxyServer({ port: 5001, enableLogging: false });
      await server.start();

      try {
        await axios.get(`http://localhost:${server.getActualPort()}/info`);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toBe('URL parameter required');
      }
    });

    it('should handle proxy endpoint without URL parameter', async () => {
      server = new AudioProxyServer({ port: 5002, enableLogging: false });
      await server.start();

      try {
        await axios.get(`http://localhost:${server.getActualPort()}/proxy`);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toBe('URL parameter required');
      }
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight requests', async () => {
      server = new AudioProxyServer({
        port: 5003,
        enableLogging: false,
        corsOrigins: 'http://localhost:3000',
      });
      await server.start();

      const response = await axios.options(
        `http://localhost:${server.getActualPort()}/proxy`,
        {
          headers: {
            Origin: 'http://localhost:3000',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Range',
          },
        }
      );

      expect(response.status).toBe(204);
    });
  });

  describe('configuration handling', () => {
    it('should handle logging enabled configuration', async () => {
      server = new AudioProxyServer({ port: 5004, enableLogging: true });
      await server.start();

      // Just test that it starts successfully with logging enabled
      expect(server.getActualPort()).toBeGreaterThan(0);
    });

    it('should handle custom CORS origins', async () => {
      server = new AudioProxyServer({
        port: 5005,
        corsOrigins: ['http://localhost:3000', 'http://localhost:3001'],
      });
      await server.start();

      expect(server.getActualPort()).toBeGreaterThan(0);
    });

    it('should handle all configuration options', async () => {
      const config: ProxyConfig = {
        port: 5006,
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

      expect(server.getActualPort()).toBe(5006);
      expect(server.getProxyUrl()).toBe('http://localhost:5006');
    });
  });

  describe('port handling', () => {
    it('should find alternative port when specified port is busy', async () => {
      // Start a server on port 5007
      const firstServer = new AudioProxyServer({
        port: 5007,
        enableLogging: false,
      });
      await firstServer.start();

      try {
        // Try to start another server on the same port
        server = new AudioProxyServer({ port: 5007, enableLogging: false });
        await server.start();

        // Should use a different port
        expect(server.getActualPort()).toBeGreaterThan(5007);
      } finally {
        await firstServer.stop();
      }
    });
  });

  describe('convenience functions', () => {
    it('should create and start server with startProxyServer', async () => {
      server = await startProxyServer({ port: 5008, enableLogging: false });

      expect(server).toBeInstanceOf(AudioProxyServer);
      expect(server.getActualPort()).toBe(5008);
    });

    it('should create server with createProxyServer', () => {
      server = createProxyServer({ port: 5009 });

      expect(server).toBeInstanceOf(AudioProxyServer);
    });
  });

  describe('server state management', () => {
    it('should handle stop when server is not started', async () => {
      server = new AudioProxyServer({ port: 5010 });

      // Should not throw when stopping a server that wasn't started
      await expect(server.stop()).resolves.toBeUndefined();
    });

    it('should handle multiple stop calls', async () => {
      server = new AudioProxyServer({ port: 5011, enableLogging: false });
      await server.start();

      await server.stop();
      await server.stop(); // Second stop should not throw
    });

    it('should provide correct URLs before and after start', async () => {
      server = new AudioProxyServer({ port: 5012, host: 'localhost' });

      // Before start
      expect(server.getProxyUrl()).toBe('http://localhost:5012');
      expect(server.getActualPort()).toBe(5012);

      // After start
      await server.start();
      expect(server.getProxyUrl()).toBe('http://localhost:5012');
      expect(server.getActualPort()).toBe(5012);
    });
  });
});
