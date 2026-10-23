/**
 * Vercel build script: copies assets/4korners/ into the output directory so
 * it is served as static files at /assets/4korners/*.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'www.mathildedechiara.com');

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) {
    console.log('  SKIP (not found): ' + src);
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

console.log('=== Vercel Build: copying client assets into output directory ===');
const count = copyDirSync(
  path.join(ROOT, 'assets', '4korners'),
  path.join(OUT, 'assets', '4korners')
);
console.log('  assets/4korners: ' + count + ' files copied');
if (count === 0) {
  console.error('ERROR: no client assets were copied. Failing the build.');
  process.exit(1);
}
console.log('=== Build complete ===');
