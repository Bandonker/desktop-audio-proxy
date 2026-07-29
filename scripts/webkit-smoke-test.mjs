import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { webkit } from 'playwright';
import { AudioProxyServer } from '../dist/server.esm.js';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const smokeDirectory = path.join(repositoryRoot, 'test', 'native', 'dist');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

function stop(server) {
  return new Promise(resolve => server.close(() => resolve()));
}

const wave = Buffer.alloc(44 + 4_000);
wave.write('RIFF', 0);
wave.writeUInt32LE(wave.length - 8, 4);
wave.write('WAVEfmt ', 8);
wave.writeUInt32LE(16, 16);
wave.writeUInt16LE(1, 20);
wave.writeUInt16LE(1, 22);
wave.writeUInt32LE(8_000, 24);
wave.writeUInt32LE(16_000, 28);
wave.writeUInt16LE(2, 32);
wave.writeUInt16LE(16, 34);
wave.write('data', 36);
wave.writeUInt32LE(4_000, 40);

const upstream = http.createServer((request, response) => {
  const range = request.headers.range;
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    const start = Number(match?.[1]);
    const end = Math.min(
      match?.[2] ? Number(match[2]) : wave.length - 1,
      wave.length - 1
    );
    const payload = wave.subarray(start, end + 1);
    response.writeHead(206, {
      'Content-Type': 'audio/wav',
      'Content-Length': payload.length,
      'Content-Range': `bytes ${start}-${end}/${wave.length}`,
      'Accept-Ranges': 'bytes',
    });
    response.end(payload);
    return;
  }
  response.writeHead(200, {
    'Content-Type': 'audio/wav',
    'Content-Length': wave.length,
    'Accept-Ranges': 'bytes',
  });
  response.end(wave);
});
const staticServer = http.createServer(async (request, response) => {
  const file = request.url?.startsWith('/renderer.js')
    ? 'renderer.js'
    : 'index.html';
  const content = await readFile(path.join(smokeDirectory, file));
  response.writeHead(200, {
    'Content-Type':
      file === 'renderer.js' ? 'text/javascript' : 'text/html; charset=utf-8',
  });
  response.end(content);
});

const upstreamPort = await listen(upstream);
const staticPort = await listen(staticServer);
const proxy = new AudioProxyServer({
  port: await (async () => {
    const temporary = http.createServer();
    const port = await listen(temporary);
    await stop(temporary);
    return port;
  })(),
  host: '127.0.0.1',
  allowPrivateAddresses: true,
  enableLogging: false,
});
let browser;

try {
  await proxy.start();
  browser = await webkit.launch({ headless: true });
  const page = await browser.newPage();
  const query = new URLSearchParams({
    host: 'web',
    proxy: proxy.getProxyUrl(),
    upstream: `http://127.0.0.1:${upstreamPort}`,
  });
  await page.goto(`http://127.0.0.1:${staticPort}/?${query}`);
  await page.waitForFunction(
    () =>
      window.__DAP_SMOKE_RESULT?.ok === true ||
      window.__DAP_SMOKE_RESULT?.ok === false,
    undefined,
    { timeout: 30_000 }
  );
  const result = await page.evaluate(() => window.__DAP_SMOKE_RESULT);
  if (!result?.ok || result.engine !== 'webkit' || !result.range) {
    throw new Error(`WebKit smoke failed: ${JSON.stringify(result)}`);
  }
  console.log(
    `WebKit engine smoke passed: environment=${result.environment}, range=${result.range}`
  );
} finally {
  await browser?.close();
  await proxy.stop();
  await stop(staticServer);
  await stop(upstream);
}
