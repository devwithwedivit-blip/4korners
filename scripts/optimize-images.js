const fs = require('fs'), path = require('path');
const sharp = require('sharp');
const DIR = path.join(__dirname, '..', 'assets', '4korners', 'uploads', 'featured_projects');
(async () => {
  for (const f of fs.readdirSync(DIR)) {
    if (!/\.png$/i.test(f)) continue;
    const src = path.join(DIR, f);
    const out = src.replace(/\.png$/i, '.webp');
    await sharp(src).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 78 }).toFile(out);
    fs.unlinkSync(src);
    console.log(f + ' -> ' + path.basename(out));
  }
})();
