import { chromium } from 'playwright';

async function inspect() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('console', msg => console.log(`[BROWSER ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.log(`[PAGE ERROR]:`, err.message, err.stack));

  console.log('Navigating to http://localhost:4444/en with introSeen="1"...');
  await page.goto('http://localhost:4444/en');
  await page.evaluate(() => {
    sessionStorage.setItem('introSeen', '1');
  });
  await page.goto('http://localhost:4444/en', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const info = await page.evaluate(() => {
    const btn = document.querySelector('button.home-page__about');
    const intro = document.querySelector('.site-intro-section');
    const iframe = document.querySelector('.site-intro-3d-iframe');
    const villa = document.querySelector('.villa-transition-container');
    const pinSpacers = Array.from(document.querySelectorAll('.pin-spacer')).map(p => ({
      className: p.className,
      style: p.getAttribute('style')
    }));

    const btnRect = btn ? btn.getBoundingClientRect() : null;
    const hitEl = btnRect ? document.elementFromPoint(btnRect.x + btnRect.width/2, btnRect.y + btnRect.height/2) : null;

    return {
      btnExists: !!btn,
      btnRect,
      hitElement: hitEl ? {
        tagName: hitEl.tagName,
        className: hitEl.className,
        id: hitEl.id,
        outerHTML: hitEl.outerHTML.slice(0, 150)
      } : null,
      introStyle: intro ? intro.getAttribute('style') : null,
      introComputed: intro ? {
        visibility: window.getComputedStyle(intro).visibility,
        pointerEvents: window.getComputedStyle(intro).pointerEvents,
        display: window.getComputedStyle(intro).display,
        zIndex: window.getComputedStyle(intro).zIndex
      } : null,
      iframeComputed: iframe ? {
        pointerEvents: window.getComputedStyle(iframe).pointerEvents
      } : null,
      pinSpacers
    };
  });

  console.log('INSPECT RESULT:', JSON.stringify(info, null, 2));

  await browser.close();
}

inspect().catch(console.error);
