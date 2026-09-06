import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\4bd2f41e-f7d7-4f98-91e5-b32798fe4b30';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  // 1. Auth Modal
  console.log('Navigating to Homepage for Auth Modal...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await sleep(2500);

  // Find and click the Sign In button
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent.includes('Sign In'));
    if (btn) btn.click();
  });
  await sleep(1500);

  // Click "Create Account" in modal
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent.includes('Create Account'));
    if (btn) btn.click();
  });
  await sleep(1000);

  await page.screenshot({ path: path.join(OUTPUT_DIR, 'screenshot_02_auth_modal.png') });
  console.log('Saved screenshot_02_auth_modal.png');

  // 2. Hotel Details Rooms & Availability
  console.log('Navigating to Hotel Details Rooms & Calendar...');
  await page.goto('http://localhost:3000/hotel/CVLioXMAPYkxR9kHBiS8', { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  await page.evaluate(() => {
    window.scrollTo(0, 600);
  });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'screenshot_03b_rooms_calendar.png') });
  console.log('Saved screenshot_03b_rooms_calendar.png');

  await browser.close();
  console.log('Done!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
