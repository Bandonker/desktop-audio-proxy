import { startProxyServer } from '../dist/index.esm.js';
import { createServer } from 'net';

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();

    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close();
        reject(new Error('Failed to resolve an available port'));
        return;
      }

      const port = address.port;
      probe.close(() => resolve(port));
    });

    probe.once('error', reject);
  });
}

async function testServer() {
  const testPort = await getAvailablePort();
  console.log('Attempting to start server using exported startProxyServer...');
  let server;

  try {
    server = await startProxyServer({
      port: testPort,
      enableLogging: false,
      allowPrivateAddresses: true,
    });
    console.log(`Server started successfully on port ${testPort}.`);

    const response = await fetch(`http://localhost:${testPort}/health`);
    if (!response.ok) {
      throw new Error(`Health endpoint returned ${response.status}`);
    }

    const data = await response.json();
    console.log('Health check response:', data);

    if (data.status === 'ok' || data.status === 'healthy') {
      console.log('Health check passed.');
    } else {
      throw new Error(`Unexpected health status: ${data.status}`);
    }
  } catch (err) {
    console.error('Failed to test server:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      await server.stop();
      console.log('Server stopped.');
    }
  }
}

testServer();
