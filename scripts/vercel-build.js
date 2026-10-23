/**
 * Vercel build script: copies assets/4korners/ and cdn.sanity.io/ into
 * the output directory (www.mathildedechiara.com/) so they are served
 * as static files at /assets/4korners/* and /cdn.sanity.io/*
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'www.mathildedechiara.com');

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`  SKIP (not found): ${src}`);
    return 0;
  }
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  }
  return count;
}

console.log('=== Vercel Build: copying static assets into output directory ===');

// 1. Copy assets/4korners/ → www.mathildedechiara.com/assets/4korners/
const src4k = path.join(ROOT, 'assets', '4korners');
const dest4k = path.join(OUT, 'assets', '4korners');
const count4k = copyDirSync(src4k, dest4k);
console.log(`  assets/4korners: ${count4k} files copied`);

// 2. Copy cdn.sanity.io/ → www.mathildedechiara.com/cdn.sanity.io/
const srcCdn = path.join(ROOT, 'cdn.sanity.io');
const destCdn = path.join(OUT, 'cdn.sanity.io');
const countCdn = copyDirSync(srcCdn, destCdn);
console.log(`  cdn.sanity.io: ${countCdn} files copied`);

console.log('=== Build complete ===');
