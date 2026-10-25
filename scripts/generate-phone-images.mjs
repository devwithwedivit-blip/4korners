import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

sharp.cache(false);

const DIRS = [
  path.resolve('assets/4korners/uploads/featured_projects'),
  path.resolve('assets/4korners/uploads/hero-images')
];

async function generatePhoneVariants() {
  console.log('Generating phone-sized AVIF images (width: 600px)...');
  let count = 0;
  let totalOrigBytes = 0;
  let totalPhoneBytes = 0;

  for (const dir of DIRS) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.avif') && !f.endsWith('-phone.avif'));

    for (const file of files) {
      const src = path.join(dir, file);
      const dest = path.join(dir, file.replace(/\.avif$/, '-phone.avif'));

      const origSize = fs.statSync(src).size;
      totalOrigBytes += origSize;

      if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) {
        await sharp(src)
          .resize({ width: 600, withoutEnlargement: true })
          .avif({ quality: 65, effort: 4 })
          .toFile(dest);
      }

      const phoneSize = fs.statSync(dest).size;
      totalPhoneBytes += phoneSize;
      count++;
    }
  }

  // Also villa images
  const villaImages = [
    { src: path.resolve('assets/villa-day.avif'), dest: path.resolve('assets/villa-day-mobile.avif'), width: 750 },
    { src: path.resolve('assets/villa-night.avif'), dest: path.resolve('assets/villa-night-mobile.avif'), width: 750 }
  ];

  for (const { src, dest, width } of villaImages) {
    if (fs.existsSync(src)) {
      totalOrigBytes += fs.statSync(src).size;
      if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) {
        await sharp(src)
          .resize({ width, withoutEnlargement: true })
          .avif({ quality: 65, effort: 4 })
          .toFile(dest);
      }
      totalPhoneBytes += fs.statSync(dest).size;
      count++;
    }
  }

  console.log(`Generated ${count} phone-sized AVIF variants.`);
  console.log(`Original: ${(totalOrigBytes / 1024).toFixed(1)} KB -> Phone: ${(totalPhoneBytes / 1024).toFixed(1)} KB (${((1 - totalPhoneBytes / totalOrigBytes) * 100).toFixed(1)}% reduction)`);
}

generatePhoneVariants().catch(err => {
  console.error('Error generating phone images:', err);
  process.exit(1);
});
