import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      include: ['crypto', 'buffer', 'stream', 'zlib', 'vm'],
      globals: {
        Buffer: 'build',
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    // Keep symlink paths so SDK file: reference appears as node_modules path.
    // Without this, vite-plugin-node-polyfills processes sphere-sdk/dist/index.js
    // as source code and tries to inject Buffer shims that can't be resolved.
    preserveSymlinks: true,
    alias: [
      { find: '@/shared', replacement: resolve(__dirname, 'src/shared') },
      { find: '@/sdk', replacement: resolve(__dirname, 'src/sdk') },
      { find: '@/components', replacement: resolve(__dirname, 'src/components') },
      { find: '@/platform', replacement: resolve(__dirname, 'src/platform') },
      // Force nostr-js-sdk to resolve from extension's own node_modules (not sphere-sdk's).
      // sphere-sdk/node_modules/nostr-js-sdk was compiled with vite-plugin-node-polyfills
      // which leaves shim references that break when bundled in a different Vite project.
      { find: '@unicitylabs/nostr-js-sdk', replacement: resolve(__dirname, 'node_modules/@unicitylabs/nostr-js-sdk/dist/browser/index.js') },
    ],
  },
  optimizeDeps: {
    // Pre-bundle SDK and its external deps so vite-plugin-node-polyfills
    // injects Buffer shims at bundle time rather than at import resolution time.
    include: [
      '@unicitylabs/sphere-sdk',
      '@unicitylabs/nostr-js-sdk',
      'bip39',
      'crypto-js',
      'elliptic',
    ],
    exclude: [],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'public/popup.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    target: 'esnext',
    minify: false,
    sourcemap: true,
  },
  publicDir: false,
});
