import { defineConfig } from 'vite';
import path from 'path';

// Node CLI build: bundles src/cli + the pure domain core (and ajv) into a
// single self-contained ESM file. No browser APIs may enter this graph.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  ssr: {
    noExternal: true,
  },
  build: {
    ssr: 'src/cli/index.ts',
    outDir: 'dist-cli',
    target: 'node18',
    sourcemap: false,
    emptyOutDir: true,
  },
})
