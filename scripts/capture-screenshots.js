const { chromium } = require('./frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/home/noor/.local/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  if (!fs.existsSync('docs/screenshots')) {
    fs.mkdirSync('docs/screenshots', { recursive: true });
  }

  // 1. Desktop Screenshots of Homepage (#top-buys-now)
  console.log('1. Capturing Desktop Homepage & Aura 10...');
  const page = await browser.newPage({
    viewport: { width: 1440, height: 950 },
    deviceScaleFactor: 2
  });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  
  // Wait explicitly for the live #top-buys-now component to render
  const topBuys = await page.waitForSelector('#top-buys-now', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Capture isolated widget
  await topBuys.screenshot({ path: 'docs/screenshots/the_aura_10_desktop.png' });
  console.log(' -> docs/screenshots/the_aura_10_desktop.png');

  // Scroll to it and capture in-context view
  await topBuys.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/screenshots/homepage_in_context.png' });
  console.log(' -> docs/screenshots/homepage_in_context.png');

  // 2. Mobile Screenshot of Homepage (#top-buys-now)
  console.log('2. Capturing Mobile Homepage & Aura 10...');
  const mobilePage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  await mobilePage.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  const mobileTopBuys = await mobilePage.waitForSelector('#top-buys-now', { timeout: 15000 });
  await mobilePage.waitForTimeout(1000);

  // Temporarily hide fixed bottom navigation so it doesn't clip element screenshot
  await mobilePage.evaluate(() => {
    document.querySelectorAll('.fixed').forEach(el => {
      if (window.getComputedStyle(el).bottom === '0px') {
        el.style.display = 'none';
      }
    });
  });

  await mobileTopBuys.screenshot({ path: 'docs/screenshots/the_aura_10_mobile.png' });
  console.log(' -> docs/screenshots/the_aura_10_mobile.png');

  // 3. Desktop Screenshot of /today (#today-executive-dossier)
  console.log('3. Capturing Desktop /today Dossier...');
  const todayPage = await browser.newPage({
    viewport: { width: 1440, height: 950 },
    deviceScaleFactor: 2
  });

  await todayPage.goto('http://localhost:3000/today', { waitUntil: 'domcontentloaded' });
  const todayDossier = await todayPage.waitForSelector('#today-executive-dossier', { timeout: 15000 });
  await todayPage.waitForTimeout(1000);

  await todayDossier.screenshot({ path: 'docs/screenshots/today_executive_brief.png' });
  console.log(' -> docs/screenshots/today_executive_brief.png');

  // 4. Mobile Screenshot of /today
  console.log('4. Capturing Mobile /today Dossier...');
  const todayMobilePage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  await todayMobilePage.goto('http://localhost:3000/today', { waitUntil: 'domcontentloaded' });
  const todayMobileDossier = await todayMobilePage.waitForSelector('#today-executive-dossier', { timeout: 15000 });
  await todayMobilePage.waitForTimeout(1000);

  await todayMobilePage.evaluate(() => {
    document.querySelectorAll('.fixed').forEach(el => {
      if (window.getComputedStyle(el).bottom === '0px') {
        el.style.display = 'none';
      }
    });
  });

  await todayMobileDossier.screenshot({ path: 'docs/screenshots/today_executive_brief_mobile.png' });
  console.log(' -> docs/screenshots/today_executive_brief_mobile.png');

  await browser.close();
  console.log('All screenshots successfully refreshed and captured!');
})().catch(e => {
  console.error('Error during capture:', e);
  process.exit(1);
});
