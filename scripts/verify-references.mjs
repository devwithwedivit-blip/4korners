import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('.');
const ORIGINALS_DIR = path.join(ROOT, '_originals');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const originalFiles = walk(ORIGINALS_DIR).map(f => path.basename(f));
console.log(`Checking against ${originalFiles.length} moved original filenames...`);

// Scan source files
const filesToScan = [
  'data_4korners.js',
  'assets/index-D88q76o1.js',
  'www.mathildedechiara.com/assets/index-D88q76o1.js',
  'index.html',
  'www.mathildedechiara.com/index.html',
  'www.mathildedechiara.com/en.html',
  'about.html',
  'www.mathildedechiara.com/about.html'
];

let leakedReferences = 0;
for (const f of filesToScan) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  const content = fs.readFileSync(p, 'utf8');

  for (const oldName of originalFiles) {
    if (content.includes(oldName)) {
      console.error(`LEAK: Found moved original reference "${oldName}" in ${f}`);
      leakedReferences++;
    }
  }
}

if (leakedReferences === 0) {
  console.log('PASS: Zero references to moved original files found across all source files.');
} else {
  console.error(`FAIL: Found ${leakedReferences} references to moved originals.`);
  process.exit(1);
}

// Now check that every referenced image in data_4korners.js exists on disk in assets/
const d = fs.readFileSync(path.join(ROOT, 'data_4korners.js'), 'utf8');
const assetUrls = [...new Set(d.match(/\/assets\/4korners\/[^"'\s]+/g) || [])];
console.log(`\nVerifying ${assetUrls.length} unique asset URLs from data_4korners.js...`);

let missingAssets = 0;
for (const u of assetUrls) {
  const relPath = u.replace(/^\//, '').split('?')[0];
  const diskPath = path.join(ROOT, relPath);
  if (!fs.existsSync(diskPath)) {
    console.error(`MISSING ASSET: ${relPath} not found on disk!`);
    missingAssets++;
  }
}

if (missingAssets === 0) {
  console.log(`PASS: All ${assetUrls.length} referenced assets exist on disk in assets/4korners!`);
} else {
  console.error(`FAIL: ${missingAssets} referenced assets are missing on disk!`);
  process.exit(1);
}
