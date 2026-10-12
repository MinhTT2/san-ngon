import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.argv[2];
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = process.env.UX_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
const page = await context.newPage();
const errors = [];
const thirdPartyFonts = [];
page.on('request', request => { if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) thirdPartyFonts.push(request.url()); });
page.on('pageerror', error => errors.push({ url: page.url(), message: error.message }));
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin);
    await page.locator('h1').waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert(await page.getByRole('heading', { name: 'Cách đặt sân', exact: true }).count());
    assert(await page.getByRole('heading', { name: 'Thanh toán khi đặt sân', exact: true }).count());
    assert.equal(await page.getByText('Tối nay có kèo.', { exact: true }).count(), 0);
    const footer = page.locator('footer');
    assert((await footer.boundingBox()).height < (width < 768 ? 740 : 440), `Footer must remain compact at ${width}px (height ${(await footer.boundingBox()).height})`);
    const hero = page.locator('[data-hero-carousel]');
    const search = await page.locator('main form').first().boundingBox();
    const carousel = await hero.boundingBox();
    assert(search.y >= carousel.y + carousel.height, 'Homepage search follows carousel');
    await hero.getByRole('button', { name: 'Ảnh tiếp theo', exact: true }).click();
    assert.equal(await hero.locator('[aria-roledescription="slide"][aria-hidden="false"]').getAttribute('aria-label'), '2 / 3 · Cầu lông');
    if (output && [390, 1440].includes(width)) {
      for (let y = 0; y < await page.evaluate(() => document.body.scrollHeight); y += 650) {
        await page.evaluate(y => scrollTo(0, y), y); await page.waitForTimeout(150);
      }
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(1200);
      await page.screenshot({ path: `${output}/home-${width}.png`, fullPage: true });
    }
  }
  await page.goto(origin);
  const hero = page.locator('[data-hero-carousel]');
  await hero.getByRole('button', { name: 'Xem Cầu lông', exact: true }).click();
  const active = hero.locator('[aria-roledescription="slide"][aria-hidden="false"]');
  assert(await active.getByRole('heading', { name: 'Sân Cầu Giấy', exact: true }).isVisible(), 'Homepage shows the real published venue');
  const venueLink = active.getByRole('link', { name: 'Xem lịch sân này', exact: true });
  assert.equal(await venueLink.getAttribute('href'), '/san/san-cau-giay#lich-san');
  await active.locator('img[data-venue-photo]').evaluate(image => image.decode());
  assert(await active.getByText('Ảnh cụm sân do chủ sân cung cấp · Sân Cầu Giấy', { exact: true }).isVisible());
  assert.deepEqual(thirdPartyFonts, [], 'Fonts are served with the site, including Vietnamese');
  assert(await page.evaluate(() => document.fonts.check('700 20px "Bricolage Grotesque"', 'Sân Ngon') && document.fonts.check('400 16px "Be Vietnam Pro"', 'Đặt sân')));
  const quiet = await browser.newContext({ javaScriptEnabled: false });
  const fallback = await quiet.newPage();
  await fallback.goto(origin);
  assert(await fallback.locator('h1').isVisible());
  assert(await fallback.locator('.pf-reveal').evaluateAll(items => items.every(item => getComputedStyle(item).opacity === '1')));
  await quiet.close();
  assert.deepEqual(errors, []);
  console.log('OK: landing at five widths, compact footer, slider interaction, no-JS content.');
} finally { await context.close(); await browser.close(); }
