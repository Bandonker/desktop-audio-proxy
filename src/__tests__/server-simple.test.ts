import { AudioProxyServer } from '../server-impl';

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
  });

  describe('basic server operations', () => {
    it('should start and stop server', async () => {
      server = new AudioProxyServer({ port: 0, enableLogging: false });

      await server.start();
      expect(server.getActualPort()).toBeGreaterThan(0);

      await server.stop();
    });

    it('should provide proxy URL', async () => {
      server = new AudioProxyServer({
        port: 0,
        host: 'localhost',
        enableLogging: false,
      });
      await server.start();

      const proxyUrl = server.getProxyUrl();
      expect(proxyUrl).toBe(`http://localhost:${server.getActualPort()}`);
    });
  });
});
