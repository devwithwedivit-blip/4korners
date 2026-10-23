import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('.');

// Read all converted files from _originals/
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

const originalFiles = walk(ORIGINALS_DIR);
console.log(`Found ${originalFiles.length} moved original files in _originals/`);

// Build map: exact old filename -> exact new filename
// e.g. "villa-day.png" -> "villa-day.avif"
const replacementMap = new Map();
for (const orig of originalFiles) {
  const base = path.basename(orig);
  const ext = path.extname(orig);
  const avifBase = `${path.basename(orig, ext)}.avif`;
  replacementMap.set(base, avifBase);
}

console.log(`Replacement mappings created: ${replacementMap.size}`);

// Target files to update:
// 1. data_4korners.js
// 2. assets/index-D88q76o1.js
// 3. www.mathildedechiara.com/assets/index-D88q76o1.js
// 4. index.html
// 5. www.mathildedechiara.com/index.html
// 6. www.mathildedechiara.com/en.html
// 7. server.js

const targetFiles = [
  path.join(ROOT, 'data_4korners.js'),
  path.join(ROOT, 'assets', 'index-D88q76o1.js'),
  path.join(ROOT, 'www.mathildedechiara.com', 'assets', 'index-D88q76o1.js'),
  path.join(ROOT, 'index.html'),
  path.join(ROOT, 'www.mathildedechiara.com', 'index.html'),
  path.join(ROOT, 'www.mathildedechiara.com', 'en.html'),
  path.join(ROOT, 'server.js')
];

let totalReplacements = 0;

for (const tf of targetFiles) {
  if (!fs.existsSync(tf)) continue;
  let content = fs.readFileSync(tf, 'utf8');
  let fileReplacements = 0;

  for (const [oldName, newName] of replacementMap.entries()) {
    if (content.includes(oldName)) {
      // Split and join for exact match
      const parts = content.split(oldName);
      fileReplacements += (parts.length - 1);
      content = parts.join(newName);
    }
  }

  // Also update type="image/png" for preload links if villa-day or villa-night
  if (tf.endsWith('.html')) {
    content = content.replace(
      /<link rel="preload" href="\/assets\/villa-day\.avif" as="image" type="image\/png"/g,
      '<link rel="preload" href="/assets/villa-day.avif" as="image" type="image/avif"'
    );
    content = content.replace(
      /<link rel="preload" href="\/assets\/villa-night\.avif" as="image" type="image\/png"/g,
      '<link rel="preload" href="/assets/villa-night.avif" as="image" type="image/avif"'
    );
  }

  // Update server.js MIME_TYPES map if needed
  if (tf.endsWith('server.js')) {
    if (!content.includes("'.avif': 'image/avif'")) {
      content = content.replace(/['"]\.avif['"]:\s*['"]image\/avif['"],?/g, '');
      content = content.replace(/('\.webp': 'image\/webp',)/g, "$1\n  '.avif': 'image/avif',");
    }
  }

  fs.writeFileSync(tf, content);
  totalReplacements += fileReplacements;
  console.log(`Updated ${path.relative(ROOT, tf)}: ${fileReplacements} filename references replaced.`);
}

console.log(`Total references replaced: ${totalReplacements}`);
