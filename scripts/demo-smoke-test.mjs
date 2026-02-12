#!/usr/bin/env node

import { spawn } from 'child_process';

const STARTUP_TIMEOUT_MS = 180_000;
const FETCH_TIMEOUT_MS = 10_000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForReady(getState) {
  const start = Date.now();
  while (!getState().ready && Date.now() - start < STARTUP_TIMEOUT_MS) {
    if (getState().exitCode !== null) {
      break;
    }
    await delay(250);
  }
}

async function shutdownDemo(child) {
  if (child.exitCode !== null) {
    return;
  }

  child.kill('SIGTERM');

  const start = Date.now();
  while (child.exitCode === null && Date.now() - start < 5000) {
    await delay(100);
  }

  if (child.exitCode === null) {
    child.kill('SIGKILL');
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertRouteOk(baseUrl, route, containsText) {
  const response = await fetchWithTimeout(`${baseUrl}${route}`);
  const body = await response.text();

  assert(
    response.status === 200,
    `Expected 200 for ${route}, got ${response.status}`
  );
  assert(
    body.includes(containsText),
    `Expected response for ${route} to contain "${containsText}"`
  );
}

async function assertBinaryRoute(baseUrl, route) {
  const response = await fetchWithTimeout(`${baseUrl}${route}`);
  assert(
    response.status === 200,
    `Expected 200 for ${route}, got ${response.status}`
  );
}

async function assertLegacyRedirect(baseUrl) {
  const response = await fetchWithTimeout(
    `${baseUrl}/examples/react-video-player.tsx`,
    { redirect: 'manual' }
  );
  const location = response.headers.get('location');

  assert(
    response.status === 302,
    `Expected legacy route redirect status 302, got ${response.status}`
  );
  assert(
    location === '/examples/react-example.tsx',
    `Expected legacy redirect to /examples/react-example.tsx, got ${location}`
  );
}

async function run() {
  const child = spawn(process.execPath, ['demo/start-demo.js'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  let demoPort = 8080;
  let ready = false;
  let exitCode = null;

  child.stdout.on('data', chunk => {
    const output = chunk.toString();
    stdout += output;

    const portMatch = output.match(/Web server is now listening on port\s+(\d+)/i);
    if (portMatch) {
      demoPort = Number(portMatch[1]);
    }

    if (output.includes('Demo is ready!')) {
      ready = true;
    }
  });

  child.stderr.on('data', chunk => {
    stderr += chunk.toString();
  });

  child.on('exit', code => {
    exitCode = code;
  });

  try {
    await waitForReady(() => ({ ready, exitCode }));

    assert(ready, 'Demo server did not report ready state before timeout');

    const baseUrl = `http://localhost:${demoPort}`;
    await assertRouteOk(baseUrl, '/', 'Desktop Audio Proxy - Live Demo');
    await assertRouteOk(baseUrl, '/react-player.html', 'React Video Demo');
    await assertRouteOk(
      baseUrl,
      '/telemetry-dashboard.html',
      'Telemetry Dashboard'
    );
    await assertRouteOk(
      baseUrl,
      '/examples/react-example.tsx',
      'useAudioUrl'
    );
    await assertBinaryRoute(baseUrl, '/assets/logo.png');
    await assertBinaryRoute(baseUrl, '/dist/browser.esm.js');
    await assertLegacyRedirect(baseUrl);

    console.log(
      `Demo smoke test passed (port ${demoPort}): key routes + legacy redirect verified`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Demo smoke test failed: ${message}`);
    const stderrTail = stderr.split(/\r?\n/).slice(-40).join('\n');
    const stdoutTail = stdout.split(/\r?\n/).slice(-80).join('\n');
    console.error('--- stdout tail ---');
    console.error(stdoutTail);
    console.error('--- stderr tail ---');
    console.error(stderrTail);
    process.exitCode = 1;
  } finally {
    await shutdownDemo(child);
  }
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
