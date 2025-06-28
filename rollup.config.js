import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default [
  // Main entry - Browser-safe ES module build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'es',
      sourcemap: true
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist',
        rootDir: './src'
      })
    ],
    external: ['axios']
  },
  // Main entry - Browser-safe CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'auto'
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json'
      })
    ],
    external: ['axios']
  },
  // Browser entry - ES module
  {
    input: 'src/browser.ts',
    output: {
      file: 'dist/browser.esm.js',
      format: 'es',
      sourcemap: true
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist'
      })
    ],
    external: ['axios']
  },
  // Browser entry - CommonJS
  {
    input: 'src/browser.ts',
    output: {
      file: 'dist/browser.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'auto'
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json'
      })
    ],
    external: ['axios']
  },
  // Server entry - ES module
  {
    input: 'src/server.ts',
    output: {
      file: 'dist/server.esm.js',
      format: 'es',
      sourcemap: true
    },
    plugins: [
      resolve({ preferBuiltins: true }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist'
      })
    ],
    external: ['axios', 'express', 'cors', 'stream']
  },
  // Server entry - CommonJS
  {
    input: 'src/server.ts',
    output: {
      file: 'dist/server.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'auto'
    },
    plugins: [
      resolve({ preferBuiltins: true }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json'
      })
    ],
    external: ['axios', 'express', 'cors', 'stream']
  },
  // Legacy server build (for compatibility)
  {
    input: 'src/server-impl.ts',
    output: {
      file: 'dist/server.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'auto'
    },
    plugins: [
      resolve({ preferBuiltins: true }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json'
      })
    ],
    external: ['axios', 'express', 'cors', 'stream']
  }
];