import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAW_DIR = path.resolve('.phase3-raw');
if (!fs.existsSync(RAW_DIR)) {
  fs.mkdirSync(RAW_DIR, { recursive: true });
}

const BASE_URL = 'http://localhost:4444/en';

// Helper to inject diagnostics instrumentation into pages
const INJECT_COUNTERS = `
(function() {
  if (window.__perfCounters) return;
  const c = {
    rafCount: 0,
    activeRafs: new Set(),
    canvasCount: 0,
    webglCount: 0,
    listenersCount: 0,
    intervalCount: 0,
    activeIntervals: new Set(),
    observerCount: 0,
    scrollTriggers: 0,
    longTasks: []
  };
  window.__perfCounters = c;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          c.longTasks.push({ duration: entry.duration, startTime: entry.startTime });
        }
      }
    });
    observer.observe({ type: 'longtask', buffered: true });
  } catch (e) {}

  const origRaf = window.requestAnimationFrame;
  const origCancelRaf = window.cancelAnimationFrame;
  window.requestAnimationFrame = function(cb) {
    c.rafCount++;
    const id = origRaf.call(window, function(ts) {
      c.activeRafs.delete(id);
      cb(ts);
    });
    c.activeRafs.add(id);
    return id;
  };
  window.cancelAnimationFrame = function(id) {
    c.activeRafs.delete(id);
    return origCancelRaf.call(window, id);
  };

  const origSetInterval = window.setInterval;
  const origClearInterval = window.clearInterval;
  window.setInterval = function(fn, delay) {
    c.intervalCount++;
    const id = origSetInterval.call(window, fn, delay);
    c.activeIntervals.add(id);
    return id;
  };
  window.clearInterval = function(id) {
    c.activeIntervals.delete(id);
    return origClearInterval.call(window, id);
  };

  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    if (!this.__tracked) {
      this.__tracked = true;
      c.canvasCount++;
      if (type && type.includes('webgl')) {
        c.webglCount++;
      }
    }
    return origGetContext.call(this, type, ...args);
  };

  const origAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, fn, opts) {
    c.listenersCount++;
    return origAddEventListener.call(this, type, fn, opts);
  };

  if (window.ResizeObserver) {
    const OrigResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class extends OrigResizeObserver {
      constructor(cb) {
        c.observerCount++;
        super(cb);
      }
    };
  }
})();
`;

async function getLiveDiagnostics(page) {
  return await page.evaluate(() => {
    const perf = window.__perfCounters || {};
    const heap = performance.memory ? performance.memory.usedJSHeapSize : 0;
    const canvases = document.querySelectorAll('canvas').length;
    const iframes = document.querySelectorAll('iframe').length;
    let stCount = 0;
    if (window.ScrollTrigger && window.ScrollTrigger.getAll) {
      stCount = window.ScrollTrigger.getAll().length;
    }

    const tbt = (perf.longTasks || []).reduce((acc, t) => acc + (t.duration - 50), 0);
    const longTaskCount = (perf.longTasks || []).length;

    return {
      heap,
      canvases,
      iframes,
      webglContexts: perf.webglCount || 0,
      activeRafs: perf.activeRafs ? perf.activeRafs.size : 0,
      activeIntervals: perf.activeIntervals ? perf.activeIntervals.size : 0,
      listenersCount: perf.listenersCount || 0,
      scrollTriggers: stCount,
      longTaskCount,
      tbt
    };
  });
}

// Measure frame times during smooth scroll
async function measureScrollFrameTimes(page, scrollSteps = 25) {
  return await page.evaluate(async (steps) => {
    return new Promise((resolve) => {
      const frameDeltas = [];
      let lastTime = 0;
      let step = 0;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

      function onFrame(now) {
        if (lastTime === 0) {
          lastTime = now;
          requestAnimationFrame(onFrame);
          return;
        }
        const delta = now - lastTime;
        lastTime = now;
        frameDeltas.push(delta);
        step++;

        const targetY = maxScroll > 0 ? (step / steps) * maxScroll : 0;
        window.scrollTo(0, targetY);

        if (step < steps) {
          requestAnimationFrame(onFrame);
        } else {
          const sorted = [...frameDeltas].sort((a, b) => a - b);
          const p95Idx = Math.min(Math.floor((sorted.length - 1) * 0.95), sorted.length - 1);
          const median = sorted[Math.floor((sorted.length - 1) * 0.5)] || 0;
          const p95 = sorted[p95Idx] || 0;
          const max = sorted[sorted.length - 1] || 0;
          resolve({ frameDeltas, median, p95, max });
        }
      }
      requestAnimationFrame(onFrame);
    });
  }, scrollSteps);
}

// -------------------------------------------------------------
// 1. Scroll Test (5 cycles of: Open Project -> Scroll -> Back -> Scroll Home)
// -------------------------------------------------------------
async function runScrollBenchmark(browser, cpuThrottle = 1, globalErrors, globalRequests) {
  const label = cpuThrottle === 1 ? 'normal_cpu' : `throttle_${cpuThrottle}x`;
  console.log(`\n=== Running Scroll Benchmark (${label}, 1440x900) ===`);

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      globalErrors.push({ source: 'console.error', text: msg.text(), url: page.url() });
    }
  });
  page.on('pageerror', err => {
    globalErrors.push({ source: 'pageerror', text: err.message, url: page.url() });
  });
  page.on('request', req => {
    const url = req.url();
    globalRequests.push(url);
  });
  page.on('response', resp => {
    if (resp.status() === 404) {
      globalErrors.push({ source: '404', text: `404 Not Found: ${resp.url()}` });
    }
  });

  const client = await context.newCDPSession(page);

  if (cpuThrottle > 1) {
    await client.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
  }

  const tracePath = path.join(RAW_DIR, `trace_scroll_${label}.json`);
  await context.tracing.start({ screenshots: true, snapshots: true });

  await page.addInitScript(INJECT_COUNTERS);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const baselineDiag = await getLiveDiagnostics(page);
  console.log(`Baseline on /en: Heap=${Math.round(baselineDiag.heap/1048576)}MB, STs=${baselineDiag.scrollTriggers}, Canvases=${baselineDiag.canvases}, iframes=${baselineDiag.iframes}`);

  const cyclesData = [];
  const projectSlugs = [
    'abhay-banquet',
    'agarwal-jewellers-by-mr-pallav-agarwal',
    'amish-sagar-residential-interior',
    'ashok-arora-residence',
    'ayushman-hospital'
  ];

  for (let cycle = 1; cycle <= 5; cycle++) {
    const slug = projectSlugs[cycle - 1] || projectSlugs[0];
    console.log(`\n--- Cycle ${cycle}/5: Opening /en/project/${slug} ---`);

    // 1. Open project
    const tNavStart = Date.now();
    await page.goto(`http://localhost:4444/en/project/${slug}`, { waitUntil: 'networkidle' });
    const navDuration = Date.now() - tNavStart;
    await page.waitForTimeout(1000);

    // 2. Scroll through project
    const projScroll = await measureScrollFrameTimes(page, 20);

    const projectDiag = await getLiveDiagnostics(page);
    console.log(`  Inside project: Heap=${Math.round(projectDiag.heap/1048576)}MB, Active rAFs=${projectDiag.activeRafs}, Canvases=${projectDiag.canvases}`);

    // 3. Go back
    const tBackStart = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const backDuration = Date.now() - tBackStart;
    await page.waitForTimeout(1000);

    // 4. Scroll home page
    const homeScroll = await measureScrollFrameTimes(page, 25);

    const homeDiag = await getLiveDiagnostics(page);
    console.log(`  Back on home: Heap=${Math.round(homeDiag.heap/1048576)}MB, STs=${homeDiag.scrollTriggers}, Active rAFs=${homeDiag.activeRafs}, Scroll p95=${homeScroll.p95.toFixed(1)}ms, Max=${homeScroll.max.toFixed(1)}ms, LongTasks=${homeDiag.longTaskCount}`);

    cyclesData.push({
      cycle,
      slug,
      navDuration,
      backDuration,
      projectDiag,
      homeDiag,
      projScroll: { median: projScroll.median, p95: projScroll.p95, max: projScroll.max },
      homeScroll: { median: homeScroll.median, p95: homeScroll.p95, max: homeScroll.max }
    });
  }

  await context.tracing.stop({ path: tracePath });
  await context.close();

  return {
    label,
    cpuThrottle,
    baselineDiag,
    cyclesData,
    tracePath
  };
}

// -------------------------------------------------------------
// 2. Intro Test (20 reloads: 10 normal, 10 cache-disabled)
// -------------------------------------------------------------
async function runIntroBenchmark(browser, globalErrors, globalRequests) {
  console.log('\n=== Running Intro Benchmark (20 reloads, 1440x900) ===');
  const results = [];

  for (let i = 1; i <= 20; i++) {
    const disableCache = i > 10;
    const mode = disableCache ? 'cache_disabled' : 'normal';

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1
    });

    const page = await context.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error') {
        globalErrors.push({ source: 'console.error', text: msg.text(), url: page.url() });
      }
    });
    page.on('pageerror', err => {
      globalErrors.push({ source: 'pageerror', text: err.message, url: page.url() });
    });
    page.on('request', req => {
      const url = req.url();
      globalRequests.push(url);
    });
    page.on('response', resp => {
      if (resp.status() === 404) {
        globalErrors.push({ source: '404', text: `404 Not Found: ${resp.url()}` });
      }
    });

    const client = await context.newCDPSession(page);

    if (disableCache) {
      await client.send('Network.setCacheDisabled', { cacheDisabled: true });
    }

    const frames = [];
    const startTime = Date.now();

    await page.goto(BASE_URL, { waitUntil: 'commit' });

    while (Date.now() - startTime < 3000) {
      const elapsed = Date.now() - startTime;
      try {
        const buf = await page.screenshot({ fullPage: false });
        frames.push({ elapsed, bufSize: buf.length, buf });
      } catch (e) {}
      await page.waitForTimeout(180);
    }

    const analysis = await page.evaluate(() => {
      const iframe = document.querySelector('iframe[src*="WITHOUT"]');
      const isReady = document.documentElement.classList.contains('logo-ready');
      const clsEntries = performance.getEntriesByType('layout-shift') || [];
      const cls = clsEntries.reduce((sum, entry) => sum + (entry.hadRecentInput ? 0 : entry.value), 0);
      return {
        hasIframe: !!iframe,
        isReady,
        cls
      };
    });

    let maxDiff = 0;
    let blankFrameCount = 0;
    for (let f = 1; f < frames.length; f++) {
      const prev = frames[f - 1].buf;
      const curr = frames[f].buf;
      const sizeDiff = Math.abs(curr.length - prev.length);
      if (sizeDiff > maxDiff) maxDiff = sizeDiff;
      if (curr.length < 5000) blankFrameCount++;
    }

    console.log(`Reload #${i} (${mode}): CLS=${analysis.cls.toFixed(3)}, FrameCount=${frames.length}, MaxDelta=${maxDiff}B, BlankFrames=${blankFrameCount}`);

    results.push({
      run: i,
      mode,
      analysis,
      blankFrameCount,
      maxDiff
    });

    await context.close();
  }

  return results;
}

(async () => {
  const globalErrors = [];
  const globalRequests = [];

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-gpu',
      '--use-gl=angle',
      '--use-angle=d3d11',
      '--enable-features=Vulkan,DefaultANGLEVulkan'
    ]
  });

  const scrollNormal = await runScrollBenchmark(browser, 1, globalErrors, globalRequests);
  const scroll4x = await runScrollBenchmark(browser, 4, globalErrors, globalRequests);
  const introData = await runIntroBenchmark(browser, globalErrors, globalRequests);

  await browser.close();

  // Validate mathildedechiara.com requests
  const externalLeakedRequests = globalRequests.filter(u => u.includes('mathildedechiara.com'));
  const notFoundErrors = globalErrors.filter(e => e.source === '404');

  const summary = {
    timestamp: new Date().toISOString(),
    scrollNormal,
    scroll4x,
    introData,
    globalErrors,
    externalLeakedRequestsCount: externalLeakedRequests.length,
    notFoundErrorsCount: notFoundErrors.length
  };

  fs.writeFileSync(path.join(RAW_DIR, 'phase3_summary.json'), JSON.stringify(summary, (key, value) => {
    if (key === 'buf') return undefined;
    return value;
  }, 2));

  console.log('\n========================================');
  console.log('=== PHASE 3 VERIFICATION RESULTS ===');
  console.log('========================================');
  console.log(`External requests to mathildedechiara.com: ${externalLeakedRequests.length}`);
  console.log(`404 responses: ${notFoundErrors.length}`);
  console.log(`Console / Page errors: ${globalErrors.length}`);
  if (globalErrors.length > 0) {
    console.log('Errors:', JSON.stringify(globalErrors.slice(0, 5), null, 2));
  }

  console.log('\n--- Normal CPU Scroll p95 (Target: < 20ms) ---');
  scrollNormal.cyclesData.forEach(c => {
    console.log(`  Cycle ${c.cycle}: Home p95 = ${c.homeScroll.p95.toFixed(1)}ms, Max = ${c.homeScroll.max.toFixed(1)}ms | Proj p95 = ${c.projScroll.p95.toFixed(1)}ms`);
  });

  console.log('\n--- 4x Throttled CPU Scroll p95 (Target: < 33ms) ---');
  scroll4x.cyclesData.forEach(c => {
    console.log(`  Cycle ${c.cycle}: Home p95 = ${c.homeScroll.p95.toFixed(1)}ms, Max = ${c.homeScroll.max.toFixed(1)}ms | Proj p95 = ${c.projScroll.p95.toFixed(1)}ms`);
  });

  console.log('\n--- Intro 20 Reloads (Target: CLS=0, Blank=0) ---');
  const maxCls = Math.max(...introData.map(d => d.analysis.cls));
  const totalBlankFrames = introData.reduce((s, d) => s + d.blankFrameCount, 0);
  console.log(`  Max CLS = ${maxCls}`);
  console.log(`  Total Blank Frames = ${totalBlankFrames}`);
})();
