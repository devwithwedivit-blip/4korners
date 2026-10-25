import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('.baseline-mobile');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const DEVICES = [
  {
    name: 'iPhone 14',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
  },
  {
    name: 'Pixel 7',
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
  }
];

// Frame time recorder injection script
const FRAME_RECORDER = `
(function() {
  window.__frameDeltas = [];
  let lastTime = performance.now();
  let recording = false;

  window.__startFrameRecording = function() {
    window.__frameDeltas = [];
    recording = true;
    lastTime = performance.now();
    function tick(now) {
      if (!recording) return;
      const delta = now - lastTime;
      lastTime = now;
      window.__frameDeltas.push(delta);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  };

  window.__stopFrameRecording = function() {
    recording = false;
    return window.__frameDeltas;
  };
})();
`;

async function measureDevice(browser, deviceConfig) {
  console.log(`\n======================================================`);
  console.log(`Measuring ${deviceConfig.name} (4x CPU Throttle + Fast 4G)`);
  console.log(`======================================================`);

  const context = await browser.newContext({
    viewport: deviceConfig.viewport,
    deviceScaleFactor: deviceConfig.deviceScaleFactor,
    isMobile: deviceConfig.isMobile,
    hasTouch: deviceConfig.hasTouch,
    userAgent: deviceConfig.userAgent
  });

  const page = await context.newPage();
  const client = await context.newCDPSession(page);

  // Apply 4x CPU throttle
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  // Apply Fast 4G network throttling
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: 10 * 1024 * 1024 / 8, // 10 Mbps
    uploadThroughput: 3 * 1024 * 1024 / 8,   // 3 Mbps
    latency: 40                              // 40ms
  });

  let totalTransferredBytes = 0;
  let totalImageBytes = 0;
  let requestCount = 0;
  let imageRequestCount = 0;

  page.on('response', async (res) => {
    try {
      requestCount++;
      const url = res.url();
      const headers = res.headers();
      const contentType = headers['content-type'] || '';
      let bodySize = 0;
      try {
        const buf = await res.body();
        bodySize = buf.length;
      } catch (e) {
        bodySize = parseInt(headers['content-length'] || '0', 10);
      }
      totalTransferredBytes += bodySize;
      const isImg = contentType.startsWith('image/') || /\.(png|jpe?g|webp|avif|svg|ico|gif)(\?.*)?$/i.test(url);
      if (isImg) {
        imageRequestCount++;
        totalImageBytes += bodySize;
      }
    } catch (e) {}
  });

  await page.addInitScript(FRAME_RECORDER);

  // Measure 1: Navigate to Home Page
  const homeNavStart = Date.now();
  await page.goto('http://localhost:4444/en', { waitUntil: 'domcontentloaded' });

  // Wait for intro to render
  await page.waitForTimeout(1500);

  // Measure scroll through intro to slider
  await page.evaluate(() => window.__startFrameRecording());
  
  // Smooth scroll down through intro & villa transition (simulating touch scroll gestures)
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, 150);
    await page.waitForTimeout(60);
  }

  const introScrollFrames = await page.evaluate(() => window.__stopFrameRecording());
  
  // Allow landing on slider
  await page.waitForTimeout(1000);

  // Measure 2: Navigate to Project Page
  console.log(`Navigating to /en/project/abhay-banquet...`);
  const projectNavStart = performance.now();
  
  await page.goto('http://localhost:4444/en/project/abhay-banquet', { waitUntil: 'domcontentloaded' });

  // Measure time until hero image appears (is decoded and rendered)
  const heroImageLoadTime = await page.evaluate(async () => {
    const startTime = performance.now();
    return new Promise((resolve) => {
      function checkImg() {
        const img = document.querySelector('.project-hero-img--redesigned') || document.querySelector('.project-hero-container--redesigned img');
        if (img && img.complete && img.naturalWidth > 0) {
          if (img.decode) {
            img.decode().then(() => resolve(performance.now() - startTime)).catch(() => resolve(performance.now() - startTime));
          } else {
            resolve(performance.now() - startTime);
          }
          return;
        }
        if (performance.now() - startTime > 10000) {
          resolve(performance.now() - startTime);
          return;
        }
        requestAnimationFrame(checkImg);
      }
      checkImg();
    });
  });

  // Measure scrolling on Project Page
  await page.evaluate(() => window.__startFrameRecording());
  for (let i = 0; i < 25; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(60);
  }
  const projectScrollFrames = await page.evaluate(() => window.__stopFrameRecording());

  await context.close();

  // Calculate metrics
  function calcStats(frames) {
    if (!frames || frames.length === 0) return { avg: 0, p95: 0, max: 0, fps: 0, droppedFrames: 0 };
    const sorted = [...frames].sort((a, b) => a - b);
    const sum = frames.reduce((a, b) => a + b, 0);
    const avg = sum / frames.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
    const max = sorted[sorted.length - 1];
    const fps = 1000 / avg;
    const droppedFrames = frames.filter(f => f > 33.3).length; // frames taking longer than ~30fps
    return {
      avg: Number(avg.toFixed(2)),
      p95: Number(p95.toFixed(2)),
      max: Number(max.toFixed(2)),
      fps: Number(fps.toFixed(1)),
      droppedFrames,
      totalFrames: frames.length
    };
  }

  const introScrollStats = calcStats(introScrollFrames);
  const projectScrollStats = calcStats(projectScrollFrames);
  const combinedScrollStats = calcStats([...introScrollFrames, ...projectScrollFrames]);

  const totalKB = Number((totalTransferredBytes / 1024).toFixed(1));
  const imageKB = Number((totalImageBytes / 1024).toFixed(1));

  console.log(`Results for ${deviceConfig.name}:`);
  console.log(`  Page Weight:`);
  console.log(`    Total Transferred: ${totalKB} KB (${requestCount} requests)`);
  console.log(`    Image Transferred: ${imageKB} KB (${imageRequestCount} requests)`);
  console.log(`  Image Load Time:`);
  console.log(`    Project Hero Image Appearance: ${heroImageLoadTime.toFixed(1)} ms`);
  console.log(`  Scroll Frame Time:`);
  console.log(`    Intro Scroll Avg Frame Time: ${introScrollStats.avg} ms (p95: ${introScrollStats.p95} ms, fps: ${introScrollStats.fps})`);
  console.log(`    Project Scroll Avg Frame Time: ${projectScrollStats.avg} ms (p95: ${projectScrollStats.p95} ms, fps: ${projectScrollStats.fps})`);
  console.log(`    Combined Scroll Avg Frame Time: ${combinedScrollStats.avg} ms (p95: ${combinedScrollStats.p95} ms)`);
  console.log(`    Dropped/Janky Frames (>33ms): ${combinedScrollStats.droppedFrames} / ${combinedScrollStats.totalFrames}`);

  return {
    device: deviceConfig.name,
    pageWeight: {
      totalKB,
      imageKB,
      totalBytes: totalTransferredBytes,
      imageBytes: totalImageBytes,
      requestCount,
      imageRequestCount
    },
    imageLoadTimeMs: Number(heroImageLoadTime.toFixed(1)),
    scrollFrameTime: {
      intro: introScrollStats,
      project: projectScrollStats,
      combined: combinedScrollStats
    }
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = {};

  for (const device of DEVICES) {
    results[device.name] = await measureDevice(browser, device);
  }

  await browser.close();

  const outPath = path.join(OUT_DIR, 'optimized-results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nOptimized measurements saved to ${outPath}`);

  // Print comparison if baseline exists
  const baselinePath = path.join(OUT_DIR, 'baseline-results.json');
  if (fs.existsSync(baselinePath)) {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    console.log('\n======================================================');
    console.log('         BEFORE vs AFTER PERFORMANCE COMPARISON       ');
    console.log('======================================================');

    for (const device of DEVICES) {
      const b = baseline[device.name];
      const o = results[device.name];
      if (!b || !o) continue;

      console.log(`\n--- ${device.name} ---`);
      console.log(`  Page Weight (Total):`);
      console.log(`    Before: ${b.pageWeight.totalKB} KB (${b.pageWeight.requestCount} reqs)`);
      console.log(`    After:  ${o.pageWeight.totalKB} KB (${o.pageWeight.requestCount} reqs)`);
      const weightDiff = (1 - o.pageWeight.totalKB / b.pageWeight.totalKB) * 100;
      console.log(`    Savings: ${weightDiff.toFixed(1)}% reduction (${(b.pageWeight.totalKB - o.pageWeight.totalKB).toFixed(1)} KB saved)`);

      console.log(`  Image Weight:`);
      console.log(`    Before: ${b.pageWeight.imageKB} KB (${b.pageWeight.imageRequestCount} reqs)`);
      console.log(`    After:  ${o.pageWeight.imageKB} KB (${o.pageWeight.imageRequestCount} reqs)`);
      const imgDiff = (1 - o.pageWeight.imageKB / b.pageWeight.imageKB) * 100;
      console.log(`    Savings: ${imgDiff.toFixed(1)}% reduction (${(b.pageWeight.imageKB - o.pageWeight.imageKB).toFixed(1)} KB saved)`);

      console.log(`  Project Hero Image Appearance Time:`);
      console.log(`    Before: ${b.imageLoadTimeMs} ms`);
      console.log(`    After:  ${o.imageLoadTimeMs} ms`);
      const imgSpeedup = (1 - o.imageLoadTimeMs / b.imageLoadTimeMs) * 100;
      console.log(`    Speedup: ${imgSpeedup.toFixed(1)}% faster`);

      console.log(`  Scroll Frame Time (Intro Scroll Avg):`);
      console.log(`    Before: ${b.scrollFrameTime.intro.avg} ms (p95: ${b.scrollFrameTime.intro.p95} ms, fps: ${b.scrollFrameTime.intro.fps})`);
      console.log(`    After:  ${o.scrollFrameTime.intro.avg} ms (p95: ${o.scrollFrameTime.intro.p95} ms, fps: ${o.scrollFrameTime.intro.fps})`);

      console.log(`  Scroll Frame Time (Combined Avg):`);
      console.log(`    Before: ${b.scrollFrameTime.combined.avg} ms (p95: ${b.scrollFrameTime.combined.p95} ms)`);
      console.log(`    After:  ${o.scrollFrameTime.combined.avg} ms (p95: ${o.scrollFrameTime.combined.p95} ms)`);
      const frameDiff = (1 - o.scrollFrameTime.combined.avg / b.scrollFrameTime.combined.avg) * 100;
      console.log(`    Improvement: ${frameDiff.toFixed(1)}% faster scroll frames`);

      console.log(`  Dropped/Janky Frames (>33ms):`);
      console.log(`    Before: ${b.scrollFrameTime.combined.droppedFrames} / ${b.scrollFrameTime.combined.totalFrames}`);
      console.log(`    After:  ${o.scrollFrameTime.combined.droppedFrames} / ${o.scrollFrameTime.combined.totalFrames}`);
    }
  }
})();
