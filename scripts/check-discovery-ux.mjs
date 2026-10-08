// Isolated headless Chromium. Requires Playwright available to Node; optionally set
// PLAYWRIGHT_MODULE to its index.mjs and CHROMIUM_EXECUTABLE to the browser binary.
// Run against a running app: node scripts/check-discovery-ux.mjs http://localhost:3100
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.argv[2] || 'http://localhost:3100';
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const output = process.env.UX_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
try {
  for (const route of ['giai-dau', 'ket-noi', 'tim-san']) {
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${origin}/${route}`);
      await page.locator('h1').first().waitFor();
      await page.getByText('Đang tải…', { exact: true }).waitFor({ state: 'hidden' });
      await page.evaluate(() => document.fonts.ready);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route}: overflow at ${width}px`);
      if (route !== 'tim-san') {
        if (route === 'giai-dau' && width < 1024) await page.getByRole('button', { name: 'Bộ lọc', exact: true }).click();
        const select = await page.locator('main select').first().boundingBox();
        assert(select.height >= 44 && select.width >= 120, `${route}: filter must remain usable`);
        if (width === 390) {
          const guide = page.locator('main details');
          assert.equal(await guide.getAttribute('open'), null);
          await guide.locator('summary').focus();
          await page.keyboard.press('Enter');
          assert.notEqual(await guide.getAttribute('open'), null);
          await page.keyboard.press('Enter');
        }
      }
      if (output && [390, 1440].includes(width)) await page.screenshot({ path: `${output}/${route}-${width}.png`, fullPage: true });
    }
    console.log(`OK: ${route} at 390/768/1024/1440px`);
  }
  await page.goto(`${origin}/giai-dau`);
  await page.getByLabel('Môn thi đấu').selectOption('badminton');
  await page.getByRole('button', { name: 'Lọc giải' }).click();
  await page.waitForURL(/sport=badminton/);
  assert.equal(await page.getByLabel('Môn thi đấu').inputValue(), 'badminton');
  await page.getByRole('link', { name: 'Xóa bộ lọc', exact: true }).first().click();
  await page.waitForURL(url => !url.searchParams.has('sport'));
  await page.getByRole('link', { name: 'Đã đăng ký', exact: true }).click();
  await page.waitForURL(/dang-nhap/);
  assert.equal(new URL(page.url()).searchParams.get('next'), '/giai-dau?view=registered');
  await page.goto(`${origin}/ket-noi`);
  await page.getByLabel('Khu vực', { exact: true }).fill('UX-check-no-matching-district');
  await page.getByRole('button', { name: 'Tìm người chơi', exact: true }).click();
  await page.waitForURL(/UX-check-no-matching-district/);
  await page.getByRole('link', { name: 'Xem tất cả người chơi' }).click();
  await page.waitForURL(`${origin}/ket-noi`);
  assert.deepEqual(errors, []);
  console.log('OK: keyboard guide, filters, reset, login return path; no browser exceptions.');
} finally {
  await context.close();
  await browser.close();
}
