/**
 * Local-only proxy host for browser, Tauri sidecar, and Electron renderer demos.
 *
 * Optional environment variables:
 * - DAP_PORT=3002
 * - DAP_ALLOWED_HOSTS=ice1.somafm.com,*.trusted-cdn.example
 * - DAP_CORS_ORIGINS=http://localhost:5173,tauri://localhost
 */

import { startProxyServer } from '../dist/server.esm.js';
import url from 'url';

function readList(name) {
  const value = process.env[name]?.trim();
  return value
    ? value
        .split(',')
        .map(entry => entry.trim())
        .filter(Boolean)
    : undefined;
}

async function main() {
  console.log('Starting Desktop Audio Proxy Server...');

  try {
    const allowedHosts = readList('DAP_ALLOWED_HOSTS');
    const configuredOrigins = readList('DAP_CORS_ORIGINS');
    const server = await startProxyServer({
      port: Number(process.env.DAP_PORT ?? 3002),
      // Keep the unauthenticated example local-only. Bind a LAN address only
      // when the host application adds authentication and access controls.
      host: 'localhost',
      // Wildcard CORS is acceptable for this loopback-only demo because
      // credentialed cross-origin requests are disabled by the server.
      corsOrigins: configuredOrigins ?? '*',
      timeout: 60000,
      maxRedirects: 10,
      ...(allowedHosts ? { allowedHosts } : {}),
      allowPrivateAddresses: false,
      enableLogging: true,
      cacheEnabled: true,
      cacheTTL: 3600,
    });

    const proxyUrl = server.getProxyUrl();
    console.log('Server started successfully!');
    console.log('Accessible via:');
    console.log(`  - ${proxyUrl}/proxy?url=YOUR_MEDIA_URL`);
    console.log(`Health check: ${proxyUrl}/health`);
    console.log(`Stream info: ${proxyUrl}/info?url=YOUR_MEDIA_URL`);
    console.log(
      allowedHosts
        ? `Target allowlist: ${allowedHosts.join(', ')}`
        : 'Target policy: public HTTP(S) hosts; private networks remain blocked'
    );

    // Handle graceful shutdown
    let stopping = false;
    const shutdown = async signal => {
      if (stopping) return;
      stopping = true;
      console.log(`\nReceived ${signal}; shutting down server...`);
      await server.stop();
    };

    process.on('SIGINT', async () => {
      await shutdown('SIGINT');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await shutdown('SIGTERM');
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (
  process.argv[1] &&
  url.pathToFileURL(process.argv[1]).href === import.meta.url
) {
  main();
}

export { main };
