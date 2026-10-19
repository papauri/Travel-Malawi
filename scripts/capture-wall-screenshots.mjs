import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = '/ms-playwright/chromium-1248/chrome-linux64/chrome';
const ARTIFACT_DIR = path.resolve('.aistudio/artifacts/brain/20082453-79ed-4d1e-9926-73d4e8b86739');
const PUBLIC_DIR = path.resolve('public/screenshots');

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function capture(page, filename) {
  const pubPath = path.join(PUBLIC_DIR, filename);
  const artPath = path.join(ARTIFACT_DIR, filename);
  await page.screenshot({ path: pubPath });
  fs.copyFileSync(pubPath, artPath);
  console.log(`Successfully saved ${filename}`);
}

async function run() {
  console.log('Launching Chromium via puppeteer-core at', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  // 1. Homepage Hero
  try {
    console.log('1. Capturing Homepage Hero...');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await sleep(3000);
    await capture(page, '01_homepage_hero.png');
  } catch (e) {
    console.error('Error 01:', e.message);
  }

  // 2. Homepage Stays Grid (with the newly added hosts)
  try {
    console.log('2. Capturing Homepage Stays Grid...');
    await page.evaluate(() => {
      window.scrollTo({ top: 680, behavior: 'instant' });
    });
    await sleep(2000);
    await capture(page, '02_homepage_stays_grid.png');
  } catch (e) {
    console.error('Error 02:', e.message);
  }

  // 3. Esthers Guest House - Boat house (Lilongwe) - Host Wonanji Esther Sande
  try {
    console.log('3. Capturing Esthers Guest House...');
    await page.goto('http://localhost:3000/hotel/9474db39-3478-48b2-9c05-b888fadb69bf', { waitUntil: 'domcontentloaded' });
    await sleep(3500);
    await capture(page, '03_esthers_boat_house.png');
  } catch (e) {
    console.error('Error 03:', e.message);
  }

  // 4. Soul Rebel Lodge & Backpackers (Nkhata Bay) - Host Felipe
  try {
    console.log('4. Capturing Soul Rebel Lodge...');
    await page.goto('http://localhost:3000/hotel/1c5eff0c-785d-4ea4-a5d2-e6f7aee22040', { waitUntil: 'domcontentloaded' });
    await sleep(3500);
    await capture(page, '04_soul_rebel_lodge.png');
  } catch (e) {
    console.error('Error 04:', e.message);
  }

  // 5. Rosalyn's beach hotel (Cape Maclear)
  try {
    console.log("5. Capturing Rosalyn's Beach Hotel...");
    await page.goto('http://localhost:3000/hotel/15e7aff0-98fa-42c8-95f6-5a426c1b2a5b', { waitUntil: 'domcontentloaded' });
    await sleep(3500);
    await capture(page, '05_rosalyns_beach_hotel.png');
  } catch (e) {
    console.error('Error 05:', e.message);
  }

  // 6. Mobile View (Host Showcase)
  try {
    console.log('6. Capturing Mobile Experience...');
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await sleep(2500);
    await page.evaluate(() => {
      window.scrollTo({ top: 400, behavior: 'instant' });
    });
    await sleep(1500);
    await capture(page, '06_mobile_experience.png');
  } catch (e) {
    console.error('Error 06:', e.message);
  }

  await browser.close();
  console.log('All screenshot jobs completed!');
}

run().catch((err) => {
  console.error('Fatal screenshot runner error:', err);
  process.exit(1);
});
