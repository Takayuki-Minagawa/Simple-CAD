import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const buildId = (process.env.GITHUB_SHA ?? `local-${Date.now().toString(36)}`)
  .slice(0, 24)
  .replace(/[^a-zA-Z0-9_-]/g, '_')

function offlineAssetManifest(): Plugin {
  return {
    name: 'offline-asset-manifest',
    generateBundle(_options, bundle) {
      this.emitFile({
        type: 'asset',
        fileName: 'offline-assets.json',
        source: JSON.stringify(Object.keys(bundle).sort()),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), offlineAssetManifest()],
  define: {
    __SIMPLE_CAD_BUILD_ID__: JSON.stringify(buildId),
  },
  base: process.env.GITHUB_PAGES === 'true' ? '/Simple-CAD/' : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    // A generated offline manifest lets the service worker cache lazy chunks
    // and web workers as well as the initial entry.
    // The only chunk above Vite's default warning is the lazy-loaded Three.js
    // viewer; scripts/check-bundle-size.mjs enforces both raw and gzip budgets.
    chunkSizeWarningLimit: 1200,
    // Public Pages deployments do not need to ship multi-megabyte source maps.
    // Opt in explicitly for release diagnostics with SOURCE_MAPS=true.
    sourcemap: process.env.SOURCE_MAPS === 'true',
  },
})
