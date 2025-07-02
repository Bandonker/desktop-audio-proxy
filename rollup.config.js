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
    external: ['axios', 'react', 'vue']
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
    external: ['axios', 'react', 'vue']
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
    external: ['axios', 'react', 'vue']
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
    external: ['axios', 'react', 'vue']
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
    external: ['axios', 'express', 'cors', 'stream', 'net', 'react', 'vue']
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
    external: ['axios', 'express', 'cors', 'stream', 'net', 'react', 'vue']
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
    external: ['axios', 'express', 'cors', 'stream', 'net', 'react', 'vue']
  },
  // React hooks - ES module
  {
    input: 'src/react.ts',
    output: {
      file: 'dist/react.esm.js',
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
    external: ['react', 'axios']
  },
  // React hooks - CommonJS
  {
    input: 'src/react.ts',
    output: {
      file: 'dist/react.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'auto'
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
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
    external: ['react', 'axios']
  },
  // Vue composables - ES module
  {
    input: 'src/vue.ts',
    output: {
      file: 'dist/vue.esm.js',
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
    external: ['vue', 'axios']
  },
  // Vue composables - CommonJS
  {
    input: 'src/vue.ts',
    output: {
      file: 'dist/vue.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'auto'
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
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
    external: ['vue', 'axios']
  }
];