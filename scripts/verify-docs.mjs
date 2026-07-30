import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const readmePath = path.join(projectRoot, 'README.md');
const readme = await readFile(readmePath, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const requiredReferences = [
  'examples/browser-radio-player.ts',
  'examples/react-example.tsx',
  'examples/vue-example.vue',
  'examples/electron-integration.js',
  'examples/electron-preload.cjs',
  'examples/electron-renderer.ts',
  'examples/tauri-integration.js',
  'examples/video-streaming.js',
  'assets/demo-overview.png',
  'assets/demo-radio-lab.png',
  'assets/demo-react-radio.png',
  'assets/cli-overview.png',
  'assets/cli-menu.png',
  'assets/proxy-server.png',
];

for (const reference of requiredReferences) {
  assert(readme.includes(reference), `README is missing ${reference}`);
}

assert(
  readme.includes('fallbackToOriginal: false'),
  'README is missing the media controller fail-closed default'
);
assert(
  readme.includes('allowedHosts'),
  'README is missing the proxy host allowlist guidance'
);
assert(
  readme.includes('source tree declares version `1.1.9`') &&
    readme.includes('npm `latest` is `1.1.8`') &&
    readme.includes('`npm view desktop-audio-proxy version`') &&
    readme.includes('`npm install desktop-audio-proxy@1.1.9`'),
  'README must distinguish the 1.1.9 candidate from npm latest'
);
assert(
  /does\s+not ship the native metadata extractor/.test(readme),
  'README must disclose the optional native bridge boundary'
);
assert(
  /third-party HLS\s+dialects have not been exhaustively validated/.test(
    readme
  ),
  'README must disclose the HLS verification boundary'
);
assert(
  readme.includes('WebKit Compatibility Scope') &&
    /not macOS\/iOS WKWebView\s+certification/.test(readme),
  'README must state the verified WebKit scope and native platform boundary'
);
assert(
  readme.includes('playBest([') && readme.includes('npm run test:webkit'),
  'README is missing source-selection or WebKit verification guidance'
);

const forbiddenClaims = [
  ['audioClient.enableDebug()', /audioClient\.enableDebug\(\)/],
  [
    'automatic library build detection',
    /Automatically finds and loads available library builds/i,
  ],
  ['universal media claim', /Universal Media Streaming/i],
  ['full video support claim', /fully supports video streaming/i],
  ['unverified telemetry timing claim', /less than 1ms/i],
  ['browser-free CLI claim', /No browser needed/i],
  ['legacy enhanced-version label', /Enhanced v1\.1\.\d/i],
  ['legacy CLI screenshot', /assets\/clidemo\d+\.PNG/i],
  ['legacy proxy screenshot', /assets\/cliproxy1\.PNG/i],
  ['CORS bypass product claim', /\b(?:bypasses|bypassing) CORS\b/i],
  ['codec repair claim', /\bfix(?:es|ing)? WebKit codecs?\b/i],
];

for (const [label, pattern] of forbiddenClaims) {
  assert(!pattern.test(readme), `README contains ${label}`);
}

const localTargets = new Set();
for (const match of readme.matchAll(/!?\[[^\]]*]\(([^)]+)\)/g)) {
  localTargets.add(match[1]);
}
for (const match of readme.matchAll(
  /<(?:img|a)\b[^>]+(?:src|href)="([^"]+)"/g
)) {
  localTargets.add(match[1]);
}

let checkedLinks = 0;
for (const rawTarget of localTargets) {
  if (/^(?:https?:|mailto:|#)/i.test(rawTarget) || rawTarget.includes('{{')) {
    continue;
  }

  const target = decodeURIComponent(rawTarget.split('#', 1)[0]);
  if (!target) continue;
  await access(path.resolve(projectRoot, target));
  checkedLinks += 1;
}

console.log(
  `README verified: ${requiredReferences.length} required references, ${forbiddenClaims.length} rejected overclaims, and ${checkedLinks} local links`
);
