/**
 * Build script for Chrome extension.
 * Builds popup, background, content, and inject scripts separately.
 */

import { build } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, existsSync, mkdirSync, rmSync, readdirSync, renameSync, statSync, readFileSync, writeFileSync } from 'fs';

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

  // Inject version from package.json into dist/manifest.json
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
  const manifestPath = resolve(distDir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  manifest.version = pkg.version;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`manifest.json version set to ${pkg.version}`);

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
      preserveSymlinks: true,
      alias: {
        '@/shared': resolve(root, 'src/shared'),
        '@/sdk': resolve(root, 'src/sdk'),
        '@/components': resolve(root, 'src/components'),
        '@/platform': resolve(root, 'src/platform'),
      },
    },
    build: {
      outDir: resolve(root, 'dist'),
      emptyOutDir: false,
      lib: {
        entry: resolve(root, 'src/platform/extension/background/index.ts'),
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
      preserveSymlinks: true,
      alias: {
        '@/shared': resolve(root, 'src/shared'),
        '@/sdk': resolve(root, 'src/sdk'),
        '@/components': resolve(root, 'src/components'),
        '@/platform': resolve(root, 'src/platform'),
      },
    },
    build: {
      outDir: resolve(root, 'dist'),
      emptyOutDir: false,
      lib: {
        entry: resolve(root, 'src/platform/extension/content/index.ts'),
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
      preserveSymlinks: true,
      alias: {
        '@/shared': resolve(root, 'src/shared'),
        '@/sdk': resolve(root, 'src/sdk'),
        '@/components': resolve(root, 'src/components'),
        '@/platform': resolve(root, 'src/platform'),
      },
    },
    build: {
      outDir: resolve(root, 'dist'),
      emptyOutDir: false,
      lib: {
        entry: resolve(root, 'src/platform/extension/inject/index.ts'),
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
