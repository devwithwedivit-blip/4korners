import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('.baseline');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function measureViewport(browser, width, height, label) {
  console.log(`\n--- Measuring ${label} (${width}x${height}) ---`);
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  let totalBytes = 0;
  let imageBytes = 0;
  let requestCount = 0;
  let imageRequestCount = 0;
  const requests = [];

  page.on('response', async (res) => {
    try {
      requestCount++;
      const url = res.url();
      const status = res.status();
      const headers = res.headers();
      const contentType = headers['content-type'] || '';
      
      let bodySize = 0;
      try {
        const buf = await res.body();
        bodySize = buf.length;
      } catch (e) {
        // e.g., redirect or 304 without body
        bodySize = parseInt(headers['content-length'] || '0', 10);
      }

      totalBytes += bodySize;
      const isImage = contentType.startsWith('image/') || /\.(png|jpe?g|webp|avif|svg|ico|gif)(\?.*)?$/i.test(url);
      if (isImage) {
        imageRequestCount++;
        imageBytes += bodySize;
      }

      requests.push({
        url,
        status,
        contentType,
        bodySize,
        isImage
      });
    } catch (err) {
      // ignore closed page
    }
  });

  // Navigate to /en
  await page.goto('http://localhost:4444/en', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000); // Allow animations/WebGL to settle

  // Scroll 0%
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);
  const shot0 = path.join(OUT_DIR, `${label}_scroll_0.png`);
  await page.screenshot({ path: shot0, fullPage: false });

  // Get max scroll height
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

  // Scroll 50%
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
  console.log(`  Total requests: ${requestCount}`);
  console.log(`  Total transferred: ${totalMB} MB (${totalBytes} bytes)`);
  console.log(`  Image requests: ${imageRequestCount}`);
  console.log(`  Image transferred: ${imageMB} MB (${imageBytes} bytes)`);
  console.log(`  Screenshots saved to: ${shot0}, ${shot50}, ${shot100}`);

  return {
    label,
    width,
    height,
    requestCount,
    totalBytes,
    totalMB,
    imageRequestCount,
    imageBytes,
    imageMB,
    screenshots: [shot0, shot50, shot100],
    requests
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  const desktop = await measureViewport(browser, 1920, 1080, 'desktop_1920x1080');
  const mobile = await measureViewport(browser, 390, 844, 'mobile_390x844');

  await browser.close();

  const summary = {
    timestamp: new Date().toISOString(),
    desktop,
    mobile
  };

  fs.writeFileSync(path.join(OUT_DIR, 'baseline_summary.json'), JSON.stringify(summary, null, 2));
  console.log('\nBaseline audit saved successfully in .baseline/baseline_summary.json');
})();
