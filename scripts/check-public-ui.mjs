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
  for (const route of ['/', '/tim-san', '/giai-dau', '/ket-noi']) {
    await page.goto(origin + route);
    await page.locator('h1').first().waitFor();
    assert.equal(new URL(await page.locator('link[rel="canonical"]').getAttribute('href')).href, new URL(origin + route).href);
    assert.equal(await page.locator('meta[property="og:locale"]').getAttribute('content'), 'vi_VN');
    const preview = await page.locator('meta[property="og:image"]').getAttribute('content');
    assert.equal(preview, origin + '/media/share-default.png');
    assert.equal(await page.locator('meta[name="twitter:card"]').getAttribute('content'), 'summary_large_image');
  }
  const shareSize = await page.evaluate(async () => {
    const image = new Image(); image.src = '/media/share-default.png'; await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  });
  assert.deepEqual(shareSize, [1200, 630]);
  const sitemap = await (await context.request.get(origin + '/sitemap.xml')).text();
  assert.match(sitemap, /san-cau-giay/);
  assert.match(sitemap, /eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeef/);
  assert.doesNotMatch(sitemap, /eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee|san-cho-duyet|dat-san|chu-san|admin|ho-so/);
  console.log('OK: public canonical URLs, Vietnamese share preview and sitemap excludes private/draft records.');
  await page.setViewportSize({ width: 390, height: 1000 });
  for (const route of ['/', '/tim-san', '/san/san-cau-giay']) {
    await page.goto(origin + route); await page.locator('h1').first().waitFor();
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    await page.evaluate(() => document.fonts.ready);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route}: readable at 200% text size on mobile`);
    if (route === '/') {
      const header = page.locator('header').first();
      const brand = await header.getByRole('link', { name: 'Sân Ngon', exact: true }).boundingBox();
      const signIn = await header.getByRole('link', { name: 'Đăng nhập', exact: true }).boundingBox();
      assert(brand.x + brand.width <= signIn.x || brand.y + brand.height <= signIn.y, 'Large header logo and sign-in do not overlap');
      const slide = page.locator('[aria-roledescription="slide"][aria-hidden="false"]');
      const title = await slide.locator('h2').boundingBox();
      const cta = await slide.locator('a').boundingBox();
      assert(title.x >= 0 && title.x + title.width <= 391, 'Large hero text is not hidden by overflow');
      assert(cta.x >= 0 && cta.x + cta.width <= 391, 'Large hero CTA remains in view');
    }
    if (route === '/tim-san') {
      const date = await page.getByLabel('Ngày chơi', { exact: true }).boundingBox();
      assert(date.width >= 200, 'Native date input has room at 200% text size');
    }
    if (route === '/san/san-cau-giay') {
      await page.getByRole('button', { name: 'Chọn giờ sớm nhất · 10:00', exact: true }).click();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Selected schedule fits with large text');
      await page.getByRole('complementary', { name: 'Tóm tắt đặt sân' }).getByRole('button', { name: 'Tiếp tục đặt sân', exact: true }).click();
      await page.getByLabel('Tên người đặt', { exact: true }).fill('Người chơi kiểm tra chữ lớn');
      await page.getByLabel('Số điện thoại', { exact: true }).fill('0912345678');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Booking review fits with large text');
      assert.equal(await page.getByLabel('Tên người đặt', { exact: true }).inputValue(), 'Người chơi kiểm tra chữ lớn');
    }
    if (output) await page.screenshot({ path: `${output}/large-text-${route.replace(/[^a-z0-9]/gi, '-')}-390.png`, fullPage: true });
  }
  const quiet = await browser.newContext({ javaScriptEnabled: false });
  const fallback = await quiet.newPage();
  await fallback.goto(origin);
  assert(await fallback.locator('h1').isVisible());
  assert(await fallback.locator('.pf-reveal').evaluateAll(items => items.every(item => getComputedStyle(item).opacity === '1')));
  await quiet.close();
  assert.deepEqual(errors, []);
  console.log('OK: landing at five widths, compact footer, slider interaction, no-JS content.');
} finally { await context.close(); await browser.close(); }
