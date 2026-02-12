import { build } from 'esbuild';
import path from 'path';

// Use process.cwd() so paths resolve correctly on Windows and CI
const root = process.cwd();
const entry = path.join(root, 'demo', 'react-example-entry.tsx');
const outfile = path.join(root, 'demo', 'react-player.bundle.js');

(async () => {
  try {
    await build({
      entryPoints: [entry],
      bundle: true,
      minify: false,
      sourcemap: true,
      outfile,
      format: 'iife',
      globalName: 'DAPReactDemo',
      platform: 'browser',
      target: ['es2018']
    });
    console.log('Built demo bundle:', outfile);
  } catch (err) {
    console.error('esbuild failed:', err);
    process.exit(1);
  }
})();
