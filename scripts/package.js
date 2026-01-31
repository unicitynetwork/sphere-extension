/**
 * Package the built extension into a zip for distribution.
 * Usage: node scripts/package.js
 */

import { createWriteStream, readFileSync } from 'fs';
import { resolve, join, relative } from 'path';
import { execSync } from 'child_process';
import archiver from 'archiver';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
const version = pkg.version;
const outFile = join(ROOT, `sphere-wallet-v${version}.zip`);

const output = createWriteStream(outFile);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  const size = (archive.pointer() / 1024).toFixed(1);
  console.log(`\n✅ Packaged: sphere-wallet-v${version}.zip (${size} KB)`);
});

archive.on('error', (err) => { throw err; });
archive.pipe(output);
archive.directory(DIST, false);
archive.finalize();
