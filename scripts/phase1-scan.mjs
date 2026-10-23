import fs from 'fs';
import path from 'path';

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  let files = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.cache', '.baseline', '.perf-compare', '_originals'].includes(f.name)) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) files.push(...walk(p));
    else if (/\.(html|js|mjs|cjs|css|json|webmanifest)$/i.test(f.name) && !f.name.endsWith('.bak') && !f.name.endsWith('.orig')) {
      files.push(p);
    }
  }
  return files;
}

const files = walk('.');

console.log('=== PHASE 1 CODE & REFERENCE DEPENDENCY AUDIT ===\n');

// 1. Files containing image extensions
const extMatches = {};
const extRegex = /\.(jpe?g|png|webp|avif|gif|bmp|tif|tiff)/gi;

// 2. mimeType / extension field occurrences
const fieldMatches = [];

// 3. Code logic / regexes that check extensions or media types
const codeMatches = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  
  // check extensions
  const exts = content.match(extRegex);
  if (exts) {
    extMatches[file] = {};
    for (const e of exts) {
      const el = e.toLowerCase();
      extMatches[file][el] = (extMatches[file][el] || 0) + 1;
    }
  }

  // check fields
  let idx = 0;
  while ((idx = content.indexOf('mimeType', idx)) !== -1) {
    const snippet = content.substring(Math.max(0, idx - 40), Math.min(content.length, idx + 60)).replace(/\r?\n/g, ' ');
    fieldMatches.push({ file, field: 'mimeType', snippet });
    idx += 8;
  }
  idx = 0;
  while ((idx = content.indexOf('"extension"', idx)) !== -1) {
    const snippet = content.substring(Math.max(0, idx - 40), Math.min(content.length, idx + 60)).replace(/\r?\n/g, ' ');
    fieldMatches.push({ file, field: 'extension', snippet });
    idx += 11;
  }

  // check code regexes / logic
  const codePatterns = [
    /\\\.(?:jpe\?g|png|webp|avif|gif|svg)/gi,
    /image\/(?:png|jpeg|webp|avif|gif)/gi,
    /srcset/gi,
    /as=["']image["']/gi,
    /type=["']image\/[^"']+["']/gi,
    /\.(?:png|jpe?g|webp|avif)['"`]/gi
  ];

  for (const pat of codePatterns) {
    let m;
    while ((m = pat.exec(content)) !== null) {
      // Don't report data_4korners.js pure data URLs
      if (file === 'data_4korners.js' && !pat.source.includes('\\\\')) {
        continue;
      }
      const matchIdx = m.index;
      const snippet = content.substring(Math.max(0, matchIdx - 50), Math.min(content.length, matchIdx + 80)).replace(/\r?\n/g, ' ');
      codeMatches.push({ file, pattern: pat.source, match: m[0], snippet });
    }
  }
}

console.log('--- 1. Files containing image extensions ---');
for (const [file, counts] of Object.entries(extMatches)) {
  console.log(`${file}: ${JSON.stringify(counts)}`);
}

console.log('\n--- 2. Fields "mimeType" or "extension" found ---');
console.log(`Total occurrences: ${fieldMatches.length}`);
fieldMatches.slice(0, 15).forEach(m => console.log(`  [${m.file}] ${m.field}: ...${m.snippet}...`));
if (fieldMatches.length > 15) {
  console.log(`  ... and ${fieldMatches.length - 15} more in data_4korners.js`);
}

console.log('\n--- 3. Code-dependency findings (regexes, MIME checks, image tags, srcset, preload) ---');
console.log(`Total code dependencies: ${codeMatches.length}`);
// Deduplicate snippets per file & pattern
const seen = new Set();
for (const cm of codeMatches) {
  const key = `${cm.file}:${cm.match}:${cm.snippet.trim()}`;
  if (!seen.has(key)) {
    seen.add(key);
    console.log(`[${cm.file}] (${cm.match}): ...${cm.snippet}...`);
  }
}
