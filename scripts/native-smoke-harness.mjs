import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';
import { AudioProxyServer } from '../dist/server.esm.js';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const host = process.argv[2];
if (host !== 'electron' && host !== 'tauri') {
  throw new Error(
    'Usage: node scripts/native-smoke-harness.mjs <electron|tauri>'
  );
}

function createWave() {
  const sampleRate = 8_000;
  const sampleCount = 2_000;
  const dataSize = sampleCount * 2;
  const wave = Buffer.alloc(44 + dataSize);
  wave.write('RIFF', 0);
  wave.writeUInt32LE(36 + dataSize, 4);
  wave.write('WAVEfmt ', 8);
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(sampleRate, 24);
  wave.writeUInt32LE(sampleRate * 2, 28);
  wave.writeUInt16LE(2, 32);
  wave.writeUInt16LE(16, 34);
  wave.write('data', 36);
  wave.writeUInt32LE(dataSize, 40);
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const value = Math.round(
      Math.sin((sample / sampleRate) * 2 * Math.PI * 440) * 4_000
    );
    wave.writeInt16LE(value, 44 + sample * 2);
  }
  return wave;
}

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

async function reservePort() {
  const server = net.createServer();
  const port = await listen(server);
  await new Promise((resolve, reject) =>
    server.close(error => (error ? reject(error) : resolve()))
  );
  return port;
}

function stop(server) {
  return new Promise(resolve => server.close(() => resolve()));
}

const wave = createWave();
const upstream = http.createServer((request, response) => {
  if (!request.url?.startsWith('/tone.wav')) {
    response.writeHead(404).end();
    return;
  }
  const range = request.headers.range;
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    const start = match ? Number(match[1]) : Number.NaN;
    const requestedEnd = match?.[2] ? Number(match[2]) : wave.length - 1;
    const end = Math.min(requestedEnd, wave.length - 1);
    if (!Number.isInteger(start) || start < 0 || start > end) {
      response.writeHead(416, { 'Content-Range': `bytes */${wave.length}` });
      response.end();
      return;
    }
    const payload = wave.subarray(start, end + 1);
    response.writeHead(206, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': payload.length,
      'Content-Range': `bytes ${start}-${end}/${wave.length}`,
      'Accept-Ranges': 'bytes',
    });
    response.end(payload);
    return;
  }
  response.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Length': wave.length,
    'Accept-Ranges': 'bytes',
  });
  response.end(wave);
});

const upstreamPort = await listen(upstream);
const proxyPort = await reservePort();
const proxy = new AudioProxyServer({
  port: proxyPort,
  host: '127.0.0.1',
  allowPrivateAddresses: true,
  enableLogging: false,
});

try {
  await proxy.start();
  const executable =
    host === 'electron'
      ? electronPath
      : path.join(
          repositoryRoot,
          'test',
          'native',
          'tauri',
          'src-tauri',
          'target',
          'debug',
          `dap-native-smoke${process.platform === 'win32' ? '.exe' : ''}`
        );
  const args =
    host === 'electron'
      ? [path.join(repositoryRoot, 'test', 'native', 'electron', 'main.cjs')]
      : [];
  const child = spawn(executable, args, {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      DAP_SMOKE_PROXY: proxy.getProxyUrl(),
      DAP_SMOKE_UPSTREAM: `http://127.0.0.1:${upstreamPort}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', chunk => {
    output += chunk;
    process.stdout.write(chunk);
  });
  child.stderr.on('data', chunk => {
    output += chunk;
    process.stderr.write(chunk);
  });
  const exitCode = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`${host} native smoke timed out after 45 seconds`));
    }, 45_000);
    child.once('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', code => {
      clearTimeout(timeout);
      resolve(code);
    });
  });
  const marker = output
    .split(/\r?\n/)
    .find(line => line.startsWith('DAP_NATIVE_SMOKE:'));
  if (!marker) {
    throw new Error(`${host} exited with ${exitCode} without a result marker`);
  }
  const result = JSON.parse(marker.slice('DAP_NATIVE_SMOKE:'.length));
  if (exitCode !== 0 || !result.ok || result.environment !== host) {
    throw new Error(`${host} smoke failed: ${JSON.stringify(result)}`);
  }
  console.log(
    `${host} native smoke passed: environment=${result.environment}, range=${result.range}`
  );
} finally {
  await proxy.stop();
  await stop(upstream);
}
