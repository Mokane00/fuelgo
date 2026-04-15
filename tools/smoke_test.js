const puppeteer = require('puppeteer');

(async () => {
  const result = { success: false, errors: [], details: {} };
  let browser;

  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(60000);

    page.on('console', msg => console.log('[PAGE]', msg.text()));
    page.on('pageerror', err => console.log('[PAGEERR]', err.message));

    // Open the site
    await page.goto('http://localhost:5000', { waitUntil: 'domcontentloaded' });
    result.details.url = page.url();

    // Wait for login fields
    await page.waitForSelector('#email');
    await page.waitForSelector('#password');
    await page.waitForSelector('#login-btn');

    // Fill login credentials
    await page.type('#email', 'admin@fuelgo.ls', { delay: 20 });
    await page.type('#password', 'Admin@2025', { delay: 20 });

    // Click login
    await page.click('#login-btn');

    // Wait for token in localStorage
    try {
      await page.waitForFunction(
        () => localStorage.getItem('fuelgo_token') !== null,
        { timeout: 15000 }
      );
    } catch (e) {
      result.errors.push("Login token not detected.");
    }

    // Check token
    const token = await page.evaluate(() => localStorage.getItem('fuelgo_token'));
    result.details.tokenPresent = !!token;

    // Capture error text if present
    if (!token) {
      const errText = await page.evaluate(() =>
        document.querySelector('#error-text')?.textContent || null
      );
      if (errText) result.errors.push("Login error banner: " + errText);
    }

    // Screenshot
    try {
      await page.screenshot({
        path: '/tmp/fuelgo_smoke.png',
        fullPage: true
      });
      result.details.screenshot = '/tmp/fuelgo_smoke.png';
    } catch (e) {
      console.log('[SMOKE] Screenshot failed:', e.message);
    }

    result.success = result.details.tokenPresent && result.errors.length === 0;

  } catch (e) {
    result.errors.push(e.message);
  } finally {
    if (browser) await browser.close();

    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      process.exit(0);
    } else {
      process.exit(2);
    }
  }
})();
