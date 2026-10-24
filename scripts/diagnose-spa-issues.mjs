import { chromium } from 'playwright';

async function diagnose() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type().toUpperCase()}]:`, msg.text());
  });

  page.on('pageerror', err => {
    console.log(`[PAGE ERROR]:`, err.message, err.stack);
  });

  console.log('--- Step 1: Navigate to http://localhost:4444/en ---');
  await page.goto('http://localhost:4444/en', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Scroll down to complete intro
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(1000);

  console.log('\n--- Step 2: Clicking ABOUT button ---');
  await page.click('button.home-page__about');
  await page.waitForTimeout(1500);

  const iframes = await page.$$eval('iframe', els => els.map(e => ({ src: e.src, className: e.className, style: e.getAttribute('style') })));
  console.log('Iframes on /en/about:', iframes);

  // Check frames in playwright
  for (const frame of page.frames()) {
    console.log('Frame URL:', frame.url());
    if (frame.url().includes('about.html')) {
      const text = await frame.innerText('body').catch(e => e.message);
      console.log('About frame body text (first 200):', text.substring(0, 200));
      const imgs = await frame.$$eval('img', els => els.map(i => ({ src: i.src, complete: i.complete, naturalWidth: i.naturalWidth }))).catch(e => []);
      console.log('About frame images:', imgs);
    }
  }

  console.log('\n--- Step 3: Going back to home and testing scrolling ---');
  await page.goBack();
  await page.waitForTimeout(1000);

  const scrollInfo1 = await page.evaluate(() => {
    const y0 = window.scrollY;
    window.scrollBy(0, 400);
    const y1 = window.scrollY;
    const stCount = window.ScrollTrigger ? window.ScrollTrigger.getAll().length : 0;
    const stList = window.ScrollTrigger ? window.ScrollTrigger.getAll().map(s => ({
      trigger: s.trigger ? s.trigger.className || s.trigger.id || s.trigger.tagName : null,
      pin: !!s.pin,
      isActive: s.isActive,
      vars: s.vars ? { start: s.vars.start, end: s.vars.end } : null
    })) : [];
    return { y0, y1, stCount, stList };
  });
  console.log('Scroll test after returning to home:', scrollInfo1);

  // Test wheel scrolling on portfolio
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(500);
  const scrollAfter = await page.evaluate(() => window.scrollY);
  console.log('Wheel scroll test on home: before =', scrollBefore, 'after =', scrollAfter);

  // Check 3D logo iframe state on home
  const logoState = await page.evaluate(() => {
    const ifr = document.querySelector('iframe.site-intro-3d-iframe') || document.querySelector('iframe[src*="WITHOUT"]');
    const introSec = document.querySelector('.site-intro-section');
    return {
      iframeFound: !!ifr,
      iframeStyle: ifr ? ifr.getAttribute('style') : null,
      iframeClass: ifr ? ifr.className : null,
      introSecStyle: introSec ? introSec.getAttribute('style') : null,
      introSecDisplay: introSec ? window.getComputedStyle(introSec).display : null,
      introSecVisibility: introSec ? window.getComputedStyle(introSec).visibility : null,
      introSecOpacity: introSec ? window.getComputedStyle(introSec).opacity : null
    };
  });
  console.log('3D Logo state after returning to home:', logoState);

  await browser.close();
}

diagnose().catch(console.error);
