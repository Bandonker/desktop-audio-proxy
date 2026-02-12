import { startProxyServer } from '../dist/server.esm.js';

(async function main() {
  try {
    console.log('Debug: starting proxy...');
    const server = await startProxyServer({
      port: 3002,
      host: 'localhost',
      corsOrigins: '*',
      timeout: 60000,
      maxRedirects: 20,
      userAgent: 'DesktopAudioProxy-Debug/1.0',
      enableLogging: true,
    });

    console.log('Debug: server started on', server.getUrl ? server.getUrl() : 'unknown');

    process.on('SIGINT', async () => {
      console.log('\nDebug: shutting down...');
      await server.stop();
      process.exit(0);
    });
  } catch (err) {
    console.error('Debug: failed to start proxy:', err);
    process.exit(1);
  }
})();
