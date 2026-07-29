import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const distDirectory = path.join(projectRoot, 'dist');

function addJavaScriptExtension(specifier) {
  return path.posix.extname(specifier) ? specifier : `${specifier}.js`;
}

function makeNodeNextCompatible(source) {
  return source
    .replace(
      /(\bfrom\s+['"])(\.{1,2}\/[^'"]+)(['"])/g,
      (_match, prefix, specifier, suffix) =>
        `${prefix}${addJavaScriptExtension(specifier)}${suffix}`
    )
    .replace(
      /(\bimport\s*\(\s*['"])(\.{1,2}\/[^'"]+)(['"]\s*\))/g,
      (_match, prefix, specifier, suffix) =>
        `${prefix}${addJavaScriptExtension(specifier)}${suffix}`
    );
}

const entries = await readdir(distDirectory, { withFileTypes: true });
let changedFiles = 0;

for (const entry of entries) {
  if (!entry.isFile() || !entry.name.endsWith('.d.ts')) {
    continue;
  }

  const declarationPath = path.join(distDirectory, entry.name);
  const source = await readFile(declarationPath, 'utf8');
  const updated = makeNodeNextCompatible(source);

  if (updated !== source) {
    await writeFile(declarationPath, updated, 'utf8');
    changedFiles += 1;
  }
}

console.log(
  `Prepared ${changedFiles} declaration file(s) for NodeNext consumers.`
);
