import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\4bd2f41e-f7d7-4f98-91e5-b32798fe4b30';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('Launching Chrome via puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  // 1. Homepage Hero & Search
  console.log('Navigating to Homepage...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await sleep(3500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'screenshot_01_homepage.png') });
  console.log('Saved screenshot_01_homepage.png');

  // 2. Auth Modal
  console.log('Opening Auth Modal...');
  try {
    const signInBtn = await page.$('nav button:last-child');
    if (signInBtn) {
      await signInBtn.click();
      await sleep(1500);

      // Find "Create Account" tab
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Create Account')) {
          await btn.click();
          await sleep(1000);
          break;
        }
      }

      await page.screenshot({ path: path.join(OUTPUT_DIR, 'screenshot_02_auth_modal.png') });
      console.log('Saved screenshot_02_auth_modal.png');

      await page.keyboard.press('Escape');
      await sleep(500);
    }
  } catch (err) {
    console.error('Error taking auth modal screenshot:', err.message);
  }

  // 3. Homepage Listings (Scroll down)
  console.log('Scrolling to Listings...');
  await page.evaluate(() => {
    window.scrollTo(0, 850);
  });
  await sleep(2500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'screenshot_01b_listings.png') });
  console.log('Saved screenshot_01b_listings.png');

  // 4. Hotel Details
  console.log('Navigating to Hotel Details (Pumulani Lodge)...');
  await page.goto('http://localhost:3000/hotel/CVLioXMAPYkxR9kHBiS8', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'screenshot_03_hotel_details.png') });
  console.log('Saved screenshot_03_hotel_details.png');

  // 5. List Property Wizard
  console.log('Navigating to List Property...');
  await page.goto('http://localhost:3000/list-your-property', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'screenshot_04_list_property.png') });
  console.log('Saved screenshot_04_list_property.png');

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch(err => {
  console.error('Fatal error capturing screenshots:', err);
  process.exit(1);
});
