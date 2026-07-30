#!/usr/bin/env node

import { spawn, spawnSync } from 'child_process';
import { readFile } from 'fs/promises';

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

async function assertInlineScriptsParse(relativePaths) {
  for (const relativePath of relativePaths) {
    const html = await readFile(relativePath, 'utf8');
    const scriptPattern = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
    let match;
    let checkedScripts = 0;

    while ((match = scriptPattern.exec(html)) !== null) {
      const [, attributes, body] = match;
      if (/\bsrc\s*=/i.test(attributes)) continue;

      if (/type\s*=\s*["']importmap["']/i.test(attributes)) {
        JSON.parse(body);
        continue;
      }

      const isModule = /type\s*=\s*["']module["']/i.test(attributes);
      const result = spawnSync(
        process.execPath,
        ['--check', ...(isModule ? ['--input-type=module'] : []), '-'],
        {
          input: body,
          encoding: 'utf8',
        }
      );
      assert(
        result.status === 0,
        `Inline script syntax failed in ${relativePath}: ${result.stderr.trim()}`
      );
      checkedScripts += 1;
    }

    void checkedScripts;
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

async function assertHeadRoute(baseUrl, route) {
  const response = await fetchWithTimeout(`${baseUrl}${route}`, {
    method: 'HEAD',
  });
  const body = await response.text();

  assert(response.status === 200, `Expected HEAD 200 for ${route}`);
  assert(body.length === 0, `Expected an empty HEAD response for ${route}`);
}

async function assertMethodNotAllowed(baseUrl, route) {
  const response = await fetchWithTimeout(`${baseUrl}${route}`, {
    method: 'POST',
  });

  assert(response.status === 405, `Expected POST 405 for ${route}`);
  assert(
    response.headers.get('allow') === 'GET, HEAD, OPTIONS',
    `Expected a restrictive Allow header for ${route}`
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
  await assertInlineScriptsParse([
    'demo/index.html',
    'demo/telemetry-dashboard.html',
    'demo/react-player.html',
  ]);

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

    const portMatch = output.match(
      /Web server is now listening on port\s+(\d+)/i
    );
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
    await assertRouteOk(baseUrl, '/', 'Radio Integration Demo');
    await assertRouteOk(baseUrl, '/react-player.html', 'React Radio Demo');
    await assertRouteOk(
      baseUrl,
      '/telemetry-dashboard.html',
      'Telemetry Dashboard'
    );
    await assertRouteOk(baseUrl, '/examples/react-example.tsx', 'useAudioUrl');
    await assertRouteOk(
      baseUrl,
      '/examples/browser-radio-player.ts',
      'createMediaElementController'
    );
    await assertRouteOk(
      baseUrl,
      '/examples/vue-example.vue',
      'fallbackToOriginal: false'
    );
    await assertRouteOk(
      baseUrl,
      '/examples/electron-renderer.ts',
      'getProxyUrl'
    );
    await assertBinaryRoute(baseUrl, '/assets/logo.png');
    await assertBinaryRoute(baseUrl, '/dist/browser.esm.js');
    await assertHeadRoute(baseUrl, '/assets/logo.png');
    await assertMethodNotAllowed(baseUrl, '/index.html');
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
