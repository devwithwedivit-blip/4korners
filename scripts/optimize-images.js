const fs = require('fs'), path = require('path');
const sharp = require('sharp');
sharp.cache(false);
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', '4korners');
const BACKUP = path.join(ROOT, '..', '4korners-originals');
const KEEP = new Set(['c4ab8af54056f8da2aacaa5208c0a9a6.webp']);
const QUALITY = 60, MAXW = 1920;

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(function (e) {
    return e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)];
  });
}

(async () => {
  const files = walk(SRC).filter(function (f) {
    return /\.(png|jpe?g|webp)$/i.test(f) && !KEEP.has(path.basename(f));
  });
  const map = [];
  let before = 0, after = 0;
  for (const f of files) {
    const out = f.replace(/\.(png|jpe?g|webp)$/i, '.avif');
    const s = fs.statSync(f).size;
    await sharp(f).rotate().resize({ width: MAXW, withoutEnlargement: true }).avif({ quality: QUALITY, effort: 4 }).toFile(out);
    const n = fs.statSync(out).size;
    if (n >= s) { fs.unlinkSync(out); console.log('skip (not smaller): ' + path.basename(f)); continue; }
    const rel = path.relative(SRC, f);
    const bk = path.join(BACKUP, rel);
    fs.mkdirSync(path.dirname(bk), { recursive: true });
    fs.copyFileSync(f, bk);
    fs.unlinkSync(f);
    map.push([path.basename(f), path.basename(out)]);
    before += s; after += n;
    console.log(path.basename(f) + ' ' + Math.round(s / 1024) + 'KB -> ' + Math.round(n / 1024) + 'KB');
  }
  const dp = path.join(ROOT, 'data_4korners.js');
  let txt = fs.readFileSync(dp, 'utf8');
  for (const m of map) txt = txt.split(m[0]).join(m[1]);
  fs.writeFileSync(dp, txt);
  console.log('DONE: ' + map.length + ' images, ' + (before / 1048576).toFixed(1) + ' MB -> ' + (after / 1048576).toFixed(1) + ' MB');
  const other = [];
  const WWW = path.join(ROOT, 'www.mathildedechiara.com');
  const scan = function (d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!/^(cdn\.sanity\.io|4korners)$/.test(e.name)) scan(p); }
      else if (/\.(html|js|css|json)$/i.test(e.name)) {
        const c = fs.readFileSync(p, 'utf8');
        if (map.some(function (m) { return c.includes(m[0]); })) other.push(p);
      }
    }
  };
  if (fs.existsSync(WWW)) scan(WWW);
  console.log('Other files still mentioning old names: ' + other.length);
  other.slice(0, 5).forEach(function (p) { console.log('  ' + p); });
})();
