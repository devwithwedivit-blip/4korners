import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('.perf-compare');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function measurePage(browser, pageUrl, width, height, label) {
  console.log(`\n=== Measuring ${pageUrl} (${label}, ${width}x${height}) ===`);
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  let totalBytes = 0;
  let imageBytes = 0;
  let requestCount = 0;
  let imageRequestCount = 0;
  let consoleErrors = 0;
  let mathildaRequests = 0;
  let non200Requests = 0;
  let avifCount = 0;

  const requests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(`  [Console Error]: ${msg.text()}`);
      consoleErrors++;
    }
  });

  page.on('response', async (res) => {
    try {
      requestCount++;
      const url = res.url();
      const status = res.status();
      const headers = res.headers();
      const contentType = headers['content-type'] || '';

      if (url.includes('mathildedechiara.com')) {
        mathildaRequests++;
      }

      if (status >= 400) {
        console.error(`  [HTTP ${status}]: ${url}`);
        non200Requests++;
      }

      let bodySize = 0;
      try {
        const buf = await res.body();
        bodySize = buf.length;
      } catch (e) {
        bodySize = parseInt(headers['content-length'] || '0', 10);
      }

      totalBytes += bodySize;
      const isImage = contentType.startsWith('image/') || /\.(png|jpe?g|webp|avif|svg|ico|gif)(\?.*)?$/i.test(url);
      if (isImage) {
        imageRequestCount++;
        imageBytes += bodySize;
        if (url.includes('.avif')) {
          avifCount++;
          if (!contentType.includes('image/avif')) {
            console.error(`  [Wrong Content-Type]: ${url} has ${contentType}`);
          }
        }
      }

      requests.push({
        url,
        status,
        contentType,
        bodySize,
        isImage
      });
    } catch (err) {}
  });

  await page.goto(pageUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Scroll 0%
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);
  const shot0 = path.join(OUT_DIR, `${label}_scroll_0.png`);
  await page.screenshot({ path: shot0, fullPage: false });

  // Scroll 50%
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  if (scrollHeight > 0) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollHeight * 0.5);
    await page.waitForTimeout(1500);
  }
  const shot50 = path.join(OUT_DIR, `${label}_scroll_50.png`);
  await page.screenshot({ path: shot50, fullPage: false });

  // Scroll 100%
  if (scrollHeight > 0) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollHeight);
    await page.waitForTimeout(1500);
  }
  const shot100 = path.join(OUT_DIR, `${label}_scroll_100.png`);
  await page.screenshot({ path: shot100, fullPage: false });

  await context.close();

  const totalMB = (totalBytes / 1048576).toFixed(2);
  const imageMB = (imageBytes / 1048576).toFixed(2);

  console.log(`Results for ${label}:`);
  console.log(`  Requests: ${requestCount} (Images: ${imageRequestCount}, AVIFs: ${avifCount})`);
  console.log(`  Total transferred: ${totalMB} MB`);
  console.log(`  Image transferred: ${imageMB} MB`);
  console.log(`  Non-200 responses: ${non200Requests}`);
  console.log(`  mathildedechiara.com requests: ${mathildaRequests}`);
  console.log(`  Console errors: ${consoleErrors}`);

  return {
    label,
    pageUrl,
    width,
    height,
    requestCount,
    imageRequestCount,
    avifCount,
    totalBytes,
    totalMB,
    imageBytes,
    imageMB,
    non200Requests,
    mathildaRequests,
    consoleErrors,
    screenshots: [shot0, shot50, shot100],
    requests
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  const runs = [
    { url: 'http://localhost:4444/en', w: 1920, h: 1080, label: 'en_desktop' },
    { url: 'http://localhost:4444/en', w: 390, h: 844, label: 'en_mobile' },
    { url: 'http://localhost:4444/en/project/abhay-banquet', w: 1920, h: 1080, label: 'project1_desktop' },
    { url: 'http://localhost:4444/en/project/abhay-banquet', w: 390, h: 844, label: 'project1_mobile' },
    { url: 'http://localhost:4444/en/project/agarwal-jewellers-by-mr-pallav-agarwal', w: 1920, h: 1080, label: 'project2_desktop' },
    { url: 'http://localhost:4444/en/project/agarwal-jewellers-by-mr-pallav-agarwal', w: 390, h: 844, label: 'project2_mobile' }
  ];

  const results = {};
  for (const r of runs) {
    results[r.label] = await measurePage(browser, r.url, r.w, r.h, r.label);
  }

  await browser.close();

  fs.writeFileSync(path.join(OUT_DIR, 'phase4_summary.json'), JSON.stringify(results, null, 2));
  console.log('\n=== PHASE 4 VERIFICATION COMPLETE ===');
})();
