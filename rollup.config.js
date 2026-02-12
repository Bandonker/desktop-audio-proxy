import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

// Node.js built-in modules that should be external for browser builds
const nodeBuiltins = [
  'events', 'fs', 'stream', 'zlib', 'buffer', 'string_decoder', 'path',
  'querystring', 'url', 'http', 'https', 'crypto', 'util', 'net', 'tls',
  'os', 'assert', 'constants', 'timers', 'process'
];

export default [
  // Main entry - Browser-safe ES module build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'es',
      sourcemap: true,
      inlineDynamicImports: true
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist',
        rootDir: './src',
        compilerOptions: {
          skipLibCheck: true,
          noResolve: false,
          moduleResolution: "node",
          allowSyntheticDefaultImports: true,
          esModuleInterop: true
        }
      })
    ],
    external: ['axios', 'react', 'vue', 'express', 'cors', ...nodeBuiltins]
  },
  // Main entry - Browser-safe CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'auto',
      inlineDynamicImports: true
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        compilerOptions: {
          skipLibCheck: true,
          noResolve: false,
          moduleResolution: "node",
          allowSyntheticDefaultImports: true,
          esModuleInterop: true
        }
      })
    ],
    external: ['axios', 'react', 'vue', 'express', 'cors', ...nodeBuiltins]
  },
  // Browser entry - ES module
  {
    input: 'src/browser.ts',
    output: {
      file: 'dist/browser.esm.js',
      format: 'es',
      sourcemap: true,
      inlineDynamicImports: true
    },
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs({
        ignore: ['axios'] // Don't process axios with commonjs plugin
      }),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist'
      })
    ],
    external: (id) => {
      // External: axios, React, Vue, server-impl, and all Node.js built-ins
      if (id === 'axios' || id === 'react' || id === 'vue') return true;
      if (id.includes('server-impl')) return true; // Don't bundle server code in browser builds
      if (nodeBuiltins.includes(id)) return true;
      // Also external if it's a subpath of a built-in (like 'stream/web')
      return nodeBuiltins.some(builtin => id === builtin || id.startsWith(builtin + '/'));
    }
  },
  // Browser entry - CommonJS
  {
    input: 'src/browser.ts',
    output: {
      file: 'dist/browser.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'auto',
      inlineDynamicImports: true
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        compilerOptions: {
          skipLibCheck: true,
          noResolve: false,
          moduleResolution: "node",
          allowSyntheticDefaultImports: true,
          esModuleInterop: true
        }
      })
    ],
    external: ['axios', 'react', 'vue', ...nodeBuiltins]
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
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist'
      })
    ],
    external: ['axios', 'express', 'cors', ...nodeBuiltins, 'react', 'vue']
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
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        compilerOptions: {
          skipLibCheck: true,
          noResolve: false,
          moduleResolution: "node",
          allowSyntheticDefaultImports: true,
          esModuleInterop: true
        }
      })
    ],
    external: ['axios', 'express', 'cors', ...nodeBuiltins, 'react', 'vue']
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
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        compilerOptions: {
          skipLibCheck: true,
          noResolve: false,
          moduleResolution: "node",
          allowSyntheticDefaultImports: true,
          esModuleInterop: true
        }
      })
    ],
    external: ['axios', 'express', 'cors', ...nodeBuiltins, 'react', 'vue']
  },
  // React hooks - ES module
  {
    input: 'src/react.ts',
    output: {
      file: 'dist/react.esm.js',
      format: 'es',
      sourcemap: true,
      inlineDynamicImports: true
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist'
      })
    ],
    external: ['react', 'axios', 'express', 'cors', ...nodeBuiltins]
  },
  // React hooks - CommonJS
  {
    input: 'src/react.ts',
    output: {
      file: 'dist/react.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'auto',
      inlineDynamicImports: true
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        compilerOptions: {
          skipLibCheck: true,
          noResolve: false,
          moduleResolution: "node",
          allowSyntheticDefaultImports: true,
          esModuleInterop: true
        }
      })
    ],
    external: ['react', 'axios', 'express', 'cors', ...nodeBuiltins]
  },
  // Vue composables - ES module
  {
    input: 'src/vue.ts',
    output: {
      file: 'dist/vue.esm.js',
      format: 'es',
      sourcemap: true,
      inlineDynamicImports: true
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist'
      })
    ],
    external: ['vue', 'axios', 'express', 'cors', ...nodeBuiltins]
  },
  // Vue composables - CommonJS
  {
    input: 'src/vue.ts',
    output: {
      file: 'dist/vue.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'auto',
      inlineDynamicImports: true
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        compilerOptions: {
          skipLibCheck: true,
          noResolve: false,
          moduleResolution: "node",
          allowSyntheticDefaultImports: true,
          esModuleInterop: true
        }
      })
    ],
    external: ['vue', 'axios', 'express', 'cors', ...nodeBuiltins]
  }
];
