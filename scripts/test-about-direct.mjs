import { chromium } from 'playwright';

async function testAbout() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('console', msg => console.log(`[BROWSER ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.log(`[PAGE ERROR]:`, err.message, err.stack));

  console.log('Navigating directly to http://localhost:4444/en/about ...');
  await page.goto('http://localhost:4444/en/about', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const bodyText = await page.innerText('body');
  console.log('Direct About page body contains "Something went wrong"?', bodyText.includes('Something went wrong'));
  console.log('Body snippet:', bodyText.substring(0, 300));

  console.log('\nNow testing navigation from /en by clicking About button...');
  await page.goto('http://localhost:4444/en', { waitUntil: 'networkidle' });
  // Wait for intro or skip it
  await page.evaluate(() => {
    try { sessionStorage.setItem('introSeen', '1'); } catch(e) {}
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  console.log('Clicking button.home-page__about ...');
  await page.click('button.home-page__about');
  await page.waitForTimeout(1500);

  const bodyAfterClick = await page.innerText('body');
  console.log('After clicking About, contains "Something went wrong"?', bodyAfterClick.includes('Something went wrong'));
  console.log('URL after click:', page.url());
  console.log('Body snippet after click:', bodyAfterClick.substring(0, 300));

  await browser.close();
}

testAbout().catch(console.error);
