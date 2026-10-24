import { chromium } from 'playwright';

async function testClick() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('console', msg => console.log(`[BROWSER ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.log(`[PAGE ERROR]:`, err.message, err.stack));

  console.log('Navigating to http://localhost:4444/en with introSeen="1"...');
  await page.goto('http://localhost:4444/en');
  await page.evaluate(() => sessionStorage.setItem('introSeen', '1'));
  await page.goto('http://localhost:4444/en', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  console.log('Triggering click via element.click()...');
  await page.evaluate(() => {
    const btn = document.querySelector('button.home-page__about');
    console.log('Button found?', !!btn);
    btn.click();
  });

  await page.waitForTimeout(2000);
  console.log('Current URL:', page.url());

  const bodyText = await page.innerText('body');
  console.log('Body text includes "Something went wrong"?', bodyText.includes('Something went wrong'));
  console.log('Body text includes "Une erreur est survenue"?', bodyText.includes('Une erreur'));
  console.log('Body text preview:', bodyText.substring(0, 300));

  await browser.close();
}

testClick().catch(console.error);
