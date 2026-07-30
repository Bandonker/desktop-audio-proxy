import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import {
  compileScript,
  compileTemplate,
  parse as parseVue,
} from '@vue/compiler-sfc';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const sourceExamples = [
  ['examples/browser-radio-player.ts', 'ts'],
  ['examples/electron-integration.js', 'js'],
  ['examples/electron-preload.cjs', 'js'],
  ['examples/electron-renderer.ts', 'ts'],
  ['examples/react-example.tsx', 'tsx'],
  ['examples/standalone-server.js', 'js'],
  ['examples/tauri-integration.js', 'js'],
  ['examples/video-streaming.js', 'js'],
  ['demo/demo-full.js', 'js'],
  ['demo/react-example-entry.tsx', 'tsx'],
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const checkedSources = [];
for (const [relativePath, loader] of sourceExamples) {
  const source = await readFile(path.join(projectRoot, relativePath), 'utf8');
  await transform(source, {
    loader,
    format: 'esm',
    target: 'es2020',
    sourcefile: relativePath,
  });
  checkedSources.push([relativePath, source]);
}

const vuePath = 'examples/vue-example.vue';
const vueSource = await readFile(path.join(projectRoot, vuePath), 'utf8');
const { descriptor, errors } = parseVue(vueSource, { filename: vuePath });
assert(errors.length === 0, `Vue example parse failed: ${errors.join('\n')}`);
compileScript(descriptor, { id: 'desktop-audio-proxy-example' });
if (descriptor.template) {
  const result = compileTemplate({
    id: 'desktop-audio-proxy-example',
    filename: vuePath,
    source: descriptor.template.content,
  });
  assert(
    result.errors.length === 0,
    `Vue template compile failed: ${result.errors.join('\n')}`
  );
}
checkedSources.push([vuePath, vueSource]);

for (const [relativePath, source] of checkedSources) {
  assert(
    !/fallbackToOriginal\s*:\s*true/.test(source),
    `${relativePath} enables unsafe direct-URL fallback`
  );
  assert(
    !/\bv1\.1\.[0-7]\b/.test(source),
    `${relativePath} contains a stale package version`
  );
  assert(
    !/declare const (React|useAudioProxy|useAudioUrl)/.test(source),
    `${relativePath} still uses placeholder framework declarations`
  );
}

console.log(
  `Example source verified: ${checkedSources.length} JavaScript, TypeScript, TSX, and Vue files`
);
