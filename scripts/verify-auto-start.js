import { createServer } from 'http';
import { AudioProxyClient } from '../dist/index.esm.js';

function listenOnEphemeralPort() {
  return new Promise((resolve, reject) => {
    const server = createServer((_request, response) => {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('occupied');
    });
    server.once('error', reject);
    server.listen(0, 'localhost', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not determine occupied test port'));
        return;
      }
      resolve({ server, port: address.port });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
}

const occupied = await listenOnEphemeralPort();
const telemetryEvents = [];
const client = new AudioProxyClient({
  proxyUrl: `http://localhost:${occupied.port}`,
  autoStartProxy: true,
  fallbackToOriginal: false,
  retryAttempts: 1,
  proxyServerConfig: {
    enableLogging: false,
  },
  telemetry: {
    enabled: true,
    onEvent: event => telemetryEvents.push(event.type),
  },
});

try {
  const playableUrl = await client.getPlayableUrl(
    'https://example.com/audio.mp3'
  );
  const runtimeProxyUrl = new URL(playableUrl);

  if (runtimeProxyUrl.pathname !== '/proxy') {
    throw new Error(`Unexpected proxy path: ${runtimeProxyUrl.pathname}`);
  }
  if (Number(runtimeProxyUrl.port) === occupied.port) {
    throw new Error('Client did not adopt the auto-started alternate port');
  }

  console.log(
    `Auto-start runtime verified: occupied ${occupied.port}, adopted ${runtimeProxyUrl.port}`
  );
} finally {
  await client.stopProxyServer();
  await closeServer(occupied.server);
}

for (const expectedEvent of ['proxy_start', 'proxy_stop']) {
  if (!telemetryEvents.includes(expectedEvent)) {
    throw new Error(`Missing ${expectedEvent} telemetry event`);
  }
}
