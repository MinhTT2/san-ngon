import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.argv[2];
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext();
const page = await context.newPage();
let refreshes = 0;
const isRefresh = request => request.url().includes('/tim-san') && request.headers().rsc === '1';
page.on('request', request => { if (isRefresh(request)) refreshes++; });
try {
  await page.goto(`${origin}/tim-san`);
  await page.locator('h1').waitFor(); await page.waitForTimeout(1000);
  // Native refresh interval runs without user clicks.
  await page.waitForRequest(isRefresh, { timeout: 17000 });
  await page.waitForTimeout(500);
  const input = page.getByRole('searchbox');
  await input.fill('Chưa gửi bộ lọc');
  await page.getByRole('link', { name: 'Tìm sân', exact: true }).first().focus();
  const before = refreshes;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(700);
  assert.equal(refreshes, before, 'Unsaved form edits defer background refresh even after blur');
  assert.equal(await input.inputValue(), 'Chưa gửi bộ lọc');
  const resumed = page.waitForRequest(isRefresh);
  await page.locator('form[aria-label="Tìm và lọc sân"]').evaluate(form => form.reset());
  await resumed; await page.waitForTimeout(500);
  assert(refreshes > before, 'Reset resumes a pending update');
  await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }));
  const hidden = refreshes;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(700);
  assert.equal(refreshes, hidden, 'No request while tab is hidden');
  const visible = page.waitForRequest(isRefresh);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await visible;
  console.log('OK: automatic discovery updates, unsaved edit protection, reset and tab recovery.');
} finally { await context.close(); await browser.close(); }
