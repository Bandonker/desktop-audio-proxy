/**
 * Example: Standalone proxy server
 * Run this alongside any desktop app that needs audio CORS bypass
 */

import { startProxyServer } from '../dist/server.esm.js';
import url from 'url';

async function main() {
  console.log('Starting Desktop Audio Proxy Server...');
  
  try {
    const server = await startProxyServer({
      port: 3002,
      host: '0.0.0.0', // Listen on all interfaces (works for both IPv4 and IPv6)
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
    console.log('Accessible via:');
    console.log('  - http://localhost:3002/proxy?url=YOUR_AUDIO_URL');
    console.log('  - http://127.0.0.1:3002/proxy?url=YOUR_AUDIO_URL');
    console.log('  - http://[::1]:3002/proxy?url=YOUR_AUDIO_URL');
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

if (process.argv[1] && url.pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}

export { main };