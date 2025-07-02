import {
  AudioProxyServer,
  createProxyServer,
  startProxyServer,
} from '../server-impl';
import { ProxyConfig } from '../types';

describe('AudioProxyServer - Basic Tests', () => {
  let server: AudioProxyServer;

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
        port: 4000,
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

  describe('convenience functions', () => {
    it('should create proxy server with createProxyServer', () => {
      const config: ProxyConfig = { port: 4001 };
      server = createProxyServer(config);
      expect(server).toBeInstanceOf(AudioProxyServer);
    });

    it('should start proxy server with startProxyServer', async () => {
      const config: ProxyConfig = { port: 4002 };
      server = await startProxyServer(config);
      expect(server).toBeInstanceOf(AudioProxyServer);
      expect(server.getActualPort()).toBeGreaterThan(0);
    });
  });

  describe('basic server operations', () => {
    it('should start and stop server', async () => {
      server = new AudioProxyServer({ port: 4003 });

      await server.start();
      expect(server.getActualPort()).toBeGreaterThan(0);

      await server.stop();
    });

    it('should provide proxy URL', async () => {
      server = new AudioProxyServer({ port: 4004, host: 'localhost' });
      await server.start();

      const proxyUrl = server.getProxyUrl();
      expect(proxyUrl).toMatch(/^http:\/\/localhost:\d+$/);
    });
  });
});
