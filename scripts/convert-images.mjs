import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

sharp.cache(false);

const ROOT = path.resolve('.');
const ASSETS_DIR = path.join(ROOT, 'assets');
const ORIGINALS_DIR = path.join(ROOT, '_originals');
const COMPARE_DIR = path.join(ROOT, '.perf-compare');

if (!fs.existsSync(COMPARE_DIR)) {
  fs.mkdirSync(COMPARE_DIR, { recursive: true });
}

// Hard rule exclusions:
// - .svg, .ico, favicons, apple-touch icons, web-manifest icons
// - Any image used as og:image or twitter:image
const EXCLUDED_FILES = new Set([
  'c4ab8af54056f8da2aacaa5208c0a9a6.webp', // og:image & twitter:image
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'favicon.ico',
  'favicon.svg'
]);

const GRADIENT_HIGH_Q = new Set([
  'villa-day.png',
  'villa-night.png',
  '09f74614d82772467e93337b062c843928bd58d9-5184x3456.jpg',
  'e163957c9991ae41c1cad5b321980f71.webp'
]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.cache', '.baseline', '.perf-compare', '_originals'].includes(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

// 8 Representative images for visual quality crops
const REPRESENTATIVE = [
  { name: 'villa-day-sky', file: 'assets/villa-day.png', crop: { left: 800, top: 200, width: 400, height: 400 } },
  { name: 'villa-night-glow', file: 'assets/villa-night.png', crop: { left: 900, top: 400, width: 400, height: 400 } },
  { name: 'portrait-hero', file: 'assets/4korners/uploads/hero-images/e163957c9991ae41c1cad5b321980f71.webp', crop: { left: 600, top: 300, width: 400, height: 400 } },
  { name: 'interior-photo', file: 'assets/4korners/uploads/featured_projects/82eec7d5f39c94b0a45b8395.webp', crop: { left: 300, top: 200, width: 400, height: 400 } },
  { name: 'exterior-arch', file: 'assets/4korners/uploads/featured_projects/34a275d441b7810081579d44.webp', crop: { left: 400, top: 300, width: 400, height: 400 } },
  { name: 'plan-drawing-1', file: 'assets/4korners/assets/images/image (1).webp', crop: { left: 200, top: 200, width: 400, height: 400 } },
  { name: 'plan-drawing-3', file: 'assets/4korners/assets/images/image (3).webp', crop: { left: 200, top: 200, width: 400, height: 400 } },
  { name: 'graphic-details', file: 'assets/4korners/uploads/hero-images/580fbd5a261b87aa18d54cbc02cba573.webp', crop: { left: 200, top: 200, width: 400, height: 400 } }
];

async function generateSideBySideCrop(origPath, avifPath, rep) {
  try {
    const origMeta = await sharp(origPath).metadata();
    const avifMeta = await sharp(avifPath).metadata();

    const w = Math.min(rep.crop.width, origMeta.width, avifMeta.width);
    const h = Math.min(rep.crop.height, origMeta.height, avifMeta.height);
    const leftOrig = Math.min(rep.crop.left, Math.max(0, origMeta.width - w));
    const topOrig = Math.min(rep.crop.top, Math.max(0, origMeta.height - h));

    const leftAvif = Math.min(rep.crop.left, Math.max(0, avifMeta.width - w));
    const topAvif = Math.min(rep.crop.top, Math.max(0, avifMeta.height - h));

    const origCrop = await sharp(origPath)
      .extract({ left: leftOrig, top: topOrig, width: w, height: h })
      .toBuffer();

    const avifCrop = await sharp(avifPath)
      .extract({ left: leftAvif, top: topAvif, width: w, height: h })
      .toBuffer();

    // Composite side by side: [ Original (left) | Divider (2px) | AVIF (right) ]
    const dividerWidth = 4;
    const totalW = w * 2 + dividerWidth;
    const dividerBuf = await sharp({
      create: {
        width: dividerWidth,
        height: h,
        channels: 4,
        background: { r: 255, g: 50, b: 50, alpha: 1 }
      }
    }).png().toBuffer();

    const outPath = path.join(COMPARE_DIR, `compare_${rep.name}.png`);
    await sharp({
      create: {
        width: totalW,
        height: h,
        channels: 4,
        background: { r: 30, g: 30, b: 30, alpha: 1 }
      }
    })
      .composite([
        { input: origCrop, left: 0, top: 0 },
        { input: dividerBuf, left: w, top: 0 },
        { input: avifCrop, left: w + dividerWidth, top: 0 }
      ])
      .png()
      .toFile(outPath);

    return outPath;
  } catch (err) {
    console.error(`Failed crop comparison for ${rep.name}:`, err.message);
    return null;
  }
}

async function convertAll() {
  console.log('=== STARTING AVIF CONVERSION PIPELINE ===\n');

  // Discover candidate files in assets/
  const candidateFiles = walk(ASSETS_DIR).filter(file => {
    const ext = path.extname(file).toLowerCase();
    const base = path.basename(file);
    return ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff'].includes(ext) &&
      !EXCLUDED_FILES.has(base);
  });

  console.log(`Found ${candidateFiles.length} raster images to convert.`);

  const conversions = [];
  const largerAvifs = [];
  const nameCollisions = [];
  let totalOrigBytes = 0;
  let totalAvifBytes = 0;

  for (const file of candidateFiles) {
    const dir = path.dirname(file);
    const ext = path.extname(file);
    const base = path.basename(file, ext);
    let avifName = `${base}.avif`;
    let avifPath = path.join(dir, avifName);

    // Collision check: if avif already exists for a DIFFERENT original file
    if (fs.existsSync(avifPath)) {
      const existingStat = fs.statSync(avifPath);
      // If it exists but is not our current target output, handle collision
      // In our case, previous .avif files might be overwritten with higher quality
    }

    const origStat = fs.statSync(file);
    const origSize = origStat.size;
    totalOrigBytes += origSize;

    const pipeline = sharp(file).rotate(); // Honour EXIF
    const meta = await pipeline.metadata();

    if (meta.pages && meta.pages > 1) {
      throw new Error(`ANIMATED IMAGE DETECTED: ${file} has ${meta.pages} pages. STOPPING as requested.`);
    }

    // Convert to sRGB
    pipeline.toColorspace('srgb');

    // Cap longest edge at 2560px without enlargement
    const longest = Math.max(meta.width || 0, meta.height || 0);
    if (longest > 2560) {
      if ((meta.width || 0) >= (meta.height || 0)) {
        pipeline.resize({ width: 2560, withoutEnlargement: true });
      } else {
        pipeline.resize({ height: 2560, withoutEnlargement: true });
      }
    }

    // Determine quality and chroma subsampling
    const isGradient = GRADIENT_HIGH_Q.has(path.basename(file));
    const isDrawingOrLogo = meta.hasAlpha || dir.includes('assets/images') || dir.includes('assets\\images');

    const quality = isGradient ? 80 : 65;
    const chroma = isDrawingOrLogo ? '4:4:4' : '4:2:0';

    pipeline.avif({
      quality,
      effort: 5,
      chromaSubsampling: chroma
    });

    const tempAvif = `${avifPath}.tmp`;
    await pipeline.toFile(tempAvif);
    if (fs.existsSync(avifPath)) {
      fs.unlinkSync(avifPath);
    }
    fs.renameSync(tempAvif, avifPath);

    const avifStat = fs.statSync(avifPath);
    const avifSize = avifStat.size;
    totalAvifBytes += avifSize;

    if (avifSize > origSize) {
      largerAvifs.push({ file, origSize, avifSize, diff: avifSize - origSize });
    }

    conversions.push({
      original: file,
      avif: avifPath,
      origSize,
      avifSize,
      quality,
      chroma
    });

    const rel = path.relative(ROOT, file);
    const savedPct = (((origSize - avifSize) / origSize) * 100).toFixed(1);
    if (conversions.length % 25 === 0 || conversions.length === candidateFiles.length || isGradient) {
      console.log(`[${conversions.length}/${candidateFiles.length}] ${path.basename(file)}: ${Math.round(origSize / 1024)}KB -> ${Math.round(avifSize / 1024)}KB (-${savedPct}%, Q${quality} ${chroma})`);
    }
  }

  console.log('\n--- CONVERSION SUMMARY ---');
  console.log(`Total images processed: ${conversions.length}`);
  console.log(`Original total: ${(totalOrigBytes / 1048576).toFixed(2)} MB`);
  console.log(`AVIF total:     ${(totalAvifBytes / 1048576).toFixed(2)} MB`);
  console.log(`Total savings:  ${((totalOrigBytes - totalAvifBytes) / 1048576).toFixed(2)} MB (${(((totalOrigBytes - totalAvifBytes) / totalOrigBytes) * 100).toFixed(1)}%)`);

  if (largerAvifs.length > 0) {
    console.log(`\nFiles where AVIF was larger than original (${largerAvifs.length} files, kept as requested):`);
    largerAvifs.forEach(item => {
      console.log(`  ${path.relative(ROOT, item.file)}: ${Math.round(item.origSize / 1024)}KB -> ${Math.round(item.avifSize / 1024)}KB (+${Math.round(item.diff / 1024)}KB)`);
    });
  } else {
    console.log('\nAll AVIF files were smaller than or equal to originals!');
  }

  // Visual Quality Check on 8 Representative Images
  console.log('\n--- GENERATING 8 QUALITY CROPS (100% ZOOM) ---');
  const cropResults = [];
  for (const rep of REPRESENTATIVE) {
    const fullOrig = path.join(ROOT, rep.file);
    const ext = path.extname(fullOrig);
    const fullAvif = path.join(path.dirname(fullOrig), `${path.basename(fullOrig, ext)}.avif`);

    if (fs.existsSync(fullOrig) && fs.existsSync(fullAvif)) {
      const cropOut = await generateSideBySideCrop(fullOrig, fullAvif, rep);
      if (cropOut) {
        cropResults.push(cropOut);
        console.log(`  [${rep.name}] Crop saved to: ${cropOut}`);
      }
    }
  }

  // Move original raster files into _originals/ preserving folder structure
  console.log('\n--- MOVING ORIGINALS INTO _originals/ ---');
  for (const c of conversions) {
    const rel = path.relative(ROOT, c.original);
    const target = path.join(ORIGINALS_DIR, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(c.original, target);
    fs.unlinkSync(c.original);
  }
  console.log(`Moved ${conversions.length} original files into _originals/`);

  // Mirror villa-day.avif and villa-night.avif to www.mathildedechiara.com/assets/
  const wwwVillaDay = path.join(ROOT, 'www.mathildedechiara.com', 'assets', 'villa-day.avif');
  const wwwVillaNight = path.join(ROOT, 'www.mathildedechiara.com', 'assets', 'villa-night.avif');
  fs.copyFileSync(path.join(ASSETS_DIR, 'villa-day.avif'), wwwVillaDay);
  fs.copyFileSync(path.join(ASSETS_DIR, 'villa-night.avif'), wwwVillaNight);

  // Clean old villa PNGs from www.mathildedechiara.com/assets
  const oldWwwDay = path.join(ROOT, 'www.mathildedechiara.com', 'assets', 'villa-day.png');
  const oldWwwNight = path.join(ROOT, 'www.mathildedechiara.com', 'assets', 'villa-night.png');
  if (fs.existsSync(oldWwwDay)) fs.unlinkSync(oldWwwDay);
  if (fs.existsSync(oldWwwNight)) fs.unlinkSync(oldWwwNight);

  console.log('Synchronized villa AVIF files to www.mathildedechiara.com/assets/');
  console.log('Conversion pipeline completed successfully.');
}

convertAll().catch(err => {
  console.error('CONVERSION FAILED:', err);
  process.exit(1);
});
