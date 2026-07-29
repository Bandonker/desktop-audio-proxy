import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const sourceDirectory = path.join(repositoryRoot, 'test', 'native');
const outputDirectory = path.join(sourceDirectory, 'dist');

await mkdir(outputDirectory, { recursive: true });
await copyFile(
  path.join(sourceDirectory, 'index.html'),
  path.join(outputDirectory, 'index.html')
);
await build({
  entryPoints: [path.join(sourceDirectory, 'renderer.ts')],
  outfile: path.join(outputDirectory, 'renderer.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome120', 'safari17'],
  sourcemap: true,
  logLevel: 'info',
});

console.log(`Native smoke renderer built at ${outputDirectory}`);
