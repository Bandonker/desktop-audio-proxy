import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const distDirectory = path.join(projectRoot, 'dist');

if (path.dirname(distDirectory) !== projectRoot) {
  throw new Error(`Refusing to clean unexpected path: ${distDirectory}`);
}

await rm(distDirectory, { recursive: true, force: true });
