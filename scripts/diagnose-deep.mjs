import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAW_DIR = path.resolve('.phase0-raw');

// 1. Analyze server.js and vercel.json headers
console.log('--- Checking server.js and vercel.json caching headers ---');
const serverJs = fs.readFileSync('server.js', 'utf8');
const vercelJson = fs.readFileSync('vercel.json', 'utf8');

const serverStaticMatch = serverJs.match(/static files in www[^\n]*\n([\s\S]*?)res\.writeHead\(200,\s*\{([\s\S]*?)\}/i);
console.log('server.js static serving headers:', serverStaticMatch ? serverStaticMatch[2].trim() : 'not found');

const vercelHeadersMatch = vercelJson.match(/"headers":\s*\[([\s\S]*?)\]/);
console.log('vercel.json /assets headers:', vercelHeadersMatch ? vercelHeadersMatch[1].trim() : 'not found');

// 2. Check CSS scroll-behavior and Lenis/scrollTo
console.log('\n--- Checking CSS and JS smooth scroll mechanisms ---');
const cssFiles = ['assets/villa-transition.css', 'index.html'];
for (const f of cssFiles) {
  if (fs.existsSync(f)) {
    const c = fs.readFileSync(f, 'utf8');
    if (c.includes('scroll-behavior')) {
      console.log(`Found scroll-behavior in ${f}:`);
      const lines = c.split('\n').filter(l => l.includes('scroll-behavior'));
      lines.forEach(l => console.log('  ', l.trim()));
    }
  }
}

// 3. Inspect what happens across cycles using Playwright CDP & Profiling
async function runDetailedProfiler() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);

  await client.send('Performance.enable');

  const INJECT = `
    window.__cycleAudit = {
      rafHandles: new Set(),
      intervals: new Set(),
      listeners: 0,
      scrollRestoration: history.scrollRestoration
    };
    const _raf = window.requestAnimationFrame;
    const _craf = window.cancelAnimationFrame;
    window.requestAnimationFrame = function(cb) {
      const id = _raf.call(window, function(ts) {
        window.__cycleAudit.rafHandles.delete(id);
        cb(ts);
      });
      window.__cycleAudit.rafHandles.add(id);
      return id;
    };
    window.cancelAnimationFrame = function(id) {
      window.__cycleAudit.rafHandles.delete(id);
      return _craf.call(window, id);
    };

    const _si = window.setInterval;
    const _ci = window.clearInterval;
    window.setInterval = function(fn, delay) {
      const id = _si.call(window, fn, delay);
      window.__cycleAudit.intervals.add(id);
      return id;
    };
    window.clearInterval = function(id) {
      window.__cycleAudit.intervals.delete(id);
      return _ci.call(window, id);
    };

    const _ael = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(t, fn, o) {
      window.__cycleAudit.listeners++;
      return _ael.call(this, t, fn, o);
    };
  `;

  await page.addInitScript(INJECT);
  await page.goto('http://localhost:4444/en', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  console.log('\n--- Checking history.scrollRestoration ---');
  const scrollRest = await page.evaluate(() => history.scrollRestoration);
  console.log('history.scrollRestoration:', scrollRest);

  // Check 5 cycles of Project -> Home detailed telemetry
  console.log('\n--- 5 CYCLES DETAILED FORENSIC TELEMETRY ---');
  const slugs = [
    'abhay-banquet',
    'agarwal-jewellers-by-mr-pallav-agarwal',
    'amish-sagar-residential-interior',
    'ashok-arora-residence',
    'ayushman-hospital'
  ];

  for (let i = 0; i < 5; i++) {
    const slug = slugs[i];

    // Navigate to Project
    const t0 = performance.now();
    await page.goto(`http://localhost:4444/en/project/${slug}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const projMetrics = await client.send('Performance.getMetrics');
    const getMetric = (name) => {
      const m = projMetrics.metrics.find(x => x.name === name);
      return m ? m.value : 0;
    };

    const projInfo = await page.evaluate(() => {
      const iframes = document.querySelectorAll('iframe').length;
      const canvases = document.querySelectorAll('canvas').length;
      const images = Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src,
        loading: img.loading,
        decoding: img.decoding,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        displayWidth: img.width,
        displayHeight: img.height,
        complete: img.complete
      }));
      let gsapTickerCount = 0;
      if (window.gsap && window.gsap.ticker) {
        gsapTickerCount = window.gsap.ticker._listeners ? window.gsap.ticker._listeners.length : 1;
      }
      return {
        iframes,
        canvases,
        imagesCount: images.length,
        imagesLazy: images.filter(x => x.loading === 'lazy').length,
        imagesAsync: images.filter(x => x.decoding === 'async').length,
        imagesMissingDimensions: images.filter(x => !x.displayWidth || !x.displayHeight).length,
        activeRafs: window.__cycleAudit.rafHandles.size,
        activeIntervals: window.__cycleAudit.intervals.size,
        listeners: window.__cycleAudit.listeners,
        gsapTickerCount
      };
    });

    console.log(`Cycle ${i + 1} Inside Project (/en/project/${slug}):`);
    console.log(`  Canvases: ${projInfo.canvases}, iframes: ${projInfo.iframes}, Active rAFs: ${projInfo.activeRafs}, Active Intervals: ${projInfo.activeIntervals}`);
    console.log(`  Images total: ${projInfo.imagesCount}, Lazy: ${projInfo.imagesLazy}, Async: ${projInfo.imagesAsync}, Missing dims: ${projInfo.imagesMissingDimensions}`);
    console.log(`  JS Heap: ${Math.round(getMetric('JSHeapUsedSize') / 1048576)} MB, ScriptDuration: ${getMetric('ScriptDuration').toFixed(2)}s`);

    // Navigate back to Home
    await page.goto('http://localhost:4444/en', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const homeMetrics = await client.send('Performance.getMetrics');
    const getHomeMetric = (name) => {
      const m = homeMetrics.metrics.find(x => x.name === name);
      return m ? m.value : 0;
    };

    const homeInfo = await page.evaluate(() => {
      let stCount = 0;
      if (window.ScrollTrigger && window.ScrollTrigger.getAll) {
        stCount = window.ScrollTrigger.getAll().length;
      }
      return {
        iframes: document.querySelectorAll('iframe').length,
        canvases: document.querySelectorAll('canvas').length,
        activeRafs: window.__cycleAudit.rafHandles.size,
        activeIntervals: window.__cycleAudit.intervals.size,
        listeners: window.__cycleAudit.listeners,
        scrollTriggers: stCount
      };
    });

    console.log(`Cycle ${i + 1} Back on Home (/en):`);
    console.log(`  Canvases: ${homeInfo.canvases}, iframes: ${homeInfo.iframes}, Active rAFs: ${homeInfo.activeRafs}, ScrollTriggers: ${homeInfo.scrollTriggers}, Listeners: ${homeInfo.listeners}`);
    console.log(`  JS Heap: ${Math.round(getHomeMetric('JSHeapUsedSize') / 1048576)} MB, ScriptDuration: ${getHomeMetric('ScriptDuration').toFixed(2)}s, LayoutCount: ${getHomeMetric('LayoutCount')}`);
  }

  // 4. Intro Investigation: Inspect the 3D logo iframe and timeline
  console.log('\n--- INTRO DETAILED INVESTIGATION ---');
  await page.goto('http://localhost:4444/en', { waitUntil: 'commit' });
  const introDiag = await page.evaluate(async () => {
    const checks = [];
    checks.push({ t: performance.now(), msg: 'Start' });
    
    // Check fonts
    const fontReady = document.fonts.status;
    checks.push({ t: performance.now(), fontReady });

    const iframe = document.querySelector('iframe[src*="WITHOUT"]');
    checks.push({
      t: performance.now(),
      iframeFound: !!iframe,
      iframeOpacity: iframe ? getComputedStyle(iframe).opacity : null,
      iframeVisibility: iframe ? getComputedStyle(iframe).visibility : null
    });

    return checks;
  });
  console.log('Intro initial state:', introDiag);

  await context.close();
  await browser.close();
}

runDetailedProfiler().catch(console.error);
