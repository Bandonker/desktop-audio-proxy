import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
if (packageJson.engines?.node !== '>=14.18.0') {
  throw new Error(
    'Published package must require Node >=14.18.0 for node:net BlockList'
  );
}
const npmExecutable = process.env.npm_execpath;
const command = npmExecutable
  ? process.execPath
  : process.platform === 'win32'
    ? process.env.ComSpec || 'cmd.exe'
    : 'npm';
const commandArguments = npmExecutable
  ? [npmExecutable, 'pack', '--dry-run', '--json']
  : process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm pack --dry-run --json']
    : ['pack', '--dry-run', '--json'];
const result = spawnSync(command, commandArguments, {
  cwd: process.cwd(),
  encoding: 'utf8',
  shell: false,
});

if (result.error || result.status !== 0) {
  throw new Error(
    `npm pack --dry-run failed with status ${result.status}: ${
      result.error?.message || result.stderr?.trim() || 'unknown error'
    }`
  );
}

const [artifact] = JSON.parse(result.stdout);
const paths = new Set(
  artifact.files.map(file => file.path.replaceAll('\\', '/'))
);
const requiredPaths = new Set(
  Object.values(packageJson.exports).flatMap(entry =>
    Object.values(entry).map(value => value.replace(/^\.\//, ''))
  )
);

for (const requiredPath of requiredPaths) {
  if (!paths.has(requiredPath)) {
    throw new Error(
      `Published package is missing export target: ${requiredPath}`
    );
  }
}

const forbiddenPaths = [...paths].filter(
  entry =>
    entry === 'dist/server.js' ||
    entry === 'dist/server.js.map' ||
    entry.startsWith('src/') ||
    entry.startsWith('demo/')
);

if (forbiddenPaths.length > 0) {
  throw new Error(
    `Published package contains unsupported files: ${forbiddenPaths.join(', ')}`
  );
}

console.log(
  `Package payload verified: ${artifact.entryCount} files, ${artifact.size} compressed bytes`
);
