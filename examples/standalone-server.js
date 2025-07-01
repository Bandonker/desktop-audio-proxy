/**
 * Example: Standalone proxy server
 * Run this alongside any desktop app that needs audio CORS bypass
 */

import { startProxyServer } from '../dist/server.esm.js';

async function main() {
  console.log('Starting Desktop Audio Proxy Server...');
  
  try {
    const server = await startProxyServer({
      port: 3002,
      host: 'localhost',
      corsOrigins: '*',
      timeout: 60000,
      maxRedirects: 20,
      userAgent: 'DesktopAudioProxy/1.1.0',
      enableLogging: true,
      enableTranscoding: false,
      cacheEnabled: true,
      cacheTTL: 3600,
    });

    console.log('Server started successfully!');
    console.log('Proxy endpoint: http://localhost:3002/proxy?url=YOUR_AUDIO_URL');
    console.log('Health check: http://localhost:3002/health');
    console.log('Stream info: http://localhost:3002/info?url=YOUR_AUDIO_URL');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down server...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nShutting down server...');
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };