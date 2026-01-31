/**
 * Build script for Chrome extension.
 * Builds popup, background, content, and inject scripts separately.
 */

import { build } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, existsSync, mkdirSync, rmSync, readdirSync, renameSync, statSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

/**
 * Copy directory recursively
 */
function copyDir(src, dest, exclude = []) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  for (const file of readdirSync(src)) {
    if (exclude.includes(file)) continue;
    const srcPath = resolve(src, file);
    const destPath = resolve(dest, file);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath, exclude);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

async function buildExtension() {
  console.log('Building Chrome extension...\n');

  const distDir = resolve(root, 'dist');
  const publicDir = resolve(root, 'public');

  // Clean dist directory
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true });
  }
  mkdirSync(distDir, { recursive: true });

  // Build popup (React app)
  console.log('Building popup...');
  await build({
    configFile: resolve(root, 'vite.config.ts'),
    build: {
      outDir: 'dist',
      emptyOutDir: false,
    },
  });

  // Copy public assets (manifest.json, icons) - exclude popup.html since it's built
  console.log('Copying public assets...');
  copyDir(publicDir, distDir, ['popup.html']);

  // Move popup.html from dist/public to dist root
  const distPublicDir = resolve(distDir, 'public');
  if (existsSync(distPublicDir)) {
    const publicPopup = resolve(distPublicDir, 'popup.html');
    const rootPopup = resolve(distDir, 'popup.html');
    if (existsSync(publicPopup)) {
      renameSync(publicPopup, rootPopup);
    }
    rmSync(distPublicDir, { recursive: true });
  }

  // Build background script - MUST use publicDir: false to prevent copying public/popup.html
  console.log('\nBuilding background script...');
  await build({
    configFile: false,
    publicDir: false,
    plugins: [
      nodePolyfills({
        // Enable polyfills for crypto and zlib used by nostr-js-sdk
        include: ['crypto', 'buffer', 'stream', 'zlib', 'vm'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@/background': resolve(root, 'src/background'),
        '@/content': resolve(root, 'src/content'),
        '@/inject': resolve(root, 'src/inject'),
        '@/popup': resolve(root, 'src/popup'),
        '@/shared': resolve(root, 'src/shared'),
      },
    },
    build: {
      outDir: resolve(root, 'dist'),
      emptyOutDir: false,
      lib: {
        entry: resolve(root, 'src/background/index.ts'),
        name: 'background',
        formats: ['es'],
        fileName: () => 'background.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
      target: 'esnext',
      minify: false,
      sourcemap: true,
    },
  });

  // Build content script
  console.log('\nBuilding content script...');
  await build({
    configFile: false,
    publicDir: false,
    resolve: {
      alias: {
        '@/background': resolve(root, 'src/background'),
        '@/content': resolve(root, 'src/content'),
        '@/inject': resolve(root, 'src/inject'),
        '@/popup': resolve(root, 'src/popup'),
        '@/shared': resolve(root, 'src/shared'),
      },
    },
    build: {
      outDir: resolve(root, 'dist'),
      emptyOutDir: false,
      lib: {
        entry: resolve(root, 'src/content/index.ts'),
        name: 'content',
        formats: ['iife'],
        fileName: () => 'content.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
      target: 'esnext',
      minify: false,
      sourcemap: true,
    },
  });

  // Build inject script
  console.log('\nBuilding inject script...');
  await build({
    configFile: false,
    publicDir: false,
    resolve: {
      alias: {
        '@/background': resolve(root, 'src/background'),
        '@/content': resolve(root, 'src/content'),
        '@/inject': resolve(root, 'src/inject'),
        '@/popup': resolve(root, 'src/popup'),
        '@/shared': resolve(root, 'src/shared'),
      },
    },
    build: {
      outDir: resolve(root, 'dist'),
      emptyOutDir: false,
      lib: {
        entry: resolve(root, 'src/inject/index.ts'),
        name: 'inject',
        formats: ['iife'],
        fileName: () => 'inject.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
      target: 'esnext',
      minify: false,
      sourcemap: true,
    },
  });

  console.log('\n✅ Build complete!');
  console.log('Extension files are in the dist/ directory.');
  console.log('Load unpacked extension from dist/ in chrome://extensions');
}

buildExtension().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
