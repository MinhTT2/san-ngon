// Public UI checks in an isolated headless browser; no remote data mutations.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.argv[2] || 'http://localhost:3100';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const output = process.env.UX_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin);
    const hero = page.getByRole('region', { name: 'Tìm cảm hứng ra sân' });
    await hero.getByRole('button', { name: 'Ảnh tiếp theo', exact: true }).click();
    await hero.getByRole('button', { name: 'Ảnh trước', exact: true }).click();
    const frame = await hero.boundingBox();
    const copy = await hero.locator('[aria-hidden="false"] h2').boundingBox();
    for (const name of ['Ảnh trước', 'Ảnh tiếp theo']) {
      const arrow = await hero.getByRole('button', { name, exact: true }).boundingBox();
      assert(arrow.x >= frame.x && arrow.x + arrow.width <= frame.x + frame.width, `${name}: outside image at ${width}`);
      assert(Math.abs(arrow.y + arrow.height / 2 - frame.y - frame.height / 2) < 2, `${name}: not centered over image`);
      assert(arrow.x + arrow.width <= copy.x || arrow.x >= copy.x + copy.width || arrow.y + arrow.height <= copy.y || arrow.y >= copy.y + copy.height, `${name}: overlaps heading at ${width}`);
    }
    assert.equal(await page.getByText('Ảnh giới thiệu:', { exact: false }).count(), 0);
  }
  await page.getByRole('link', { name: 'Nguồn hình ảnh', exact: true }).click();
  await page.waitForURL(`${origin}/nguon-hinh-anh`);
  await page.locator('h1').waitFor();
  assert(await page.locator('a[href="https://creativecommons.org/licenses/by-sa/4.0/"]').count());
  console.log('OK: arrows overlay images without covering headings; attribution reachable from footer.');
  for (const [route, params] of [
    ['tim-san', { q: 'FPT', district: 'Hoài Đức', indoor: '1', available: '1', sort: 'price' }],
    ['giai-dau', { status: 'completed' }],
    ['ket-noi', { location: 'Hà Nội' }],
  ]) {
    await page.goto(`${origin}/${route}?${new URLSearchParams(params)}`);
    const shortcut = page.getByRole('navigation', { name: 'Chọn nhanh môn chơi' }).getByRole('link', { name: 'Cầu lông', exact: true });
    const target = new URL(await shortcut.getAttribute('href'), origin);
    for (const [key, value] of Object.entries(params)) assert.equal(target.searchParams.get(key), value, `${route}: shortcut loses ${key}`);
    if (route === 'tim-san') assert.equal(target.searchParams.get('ngay'), await page.getByLabel('Ngày chơi', { exact: true }).inputValue());
    await shortcut.click();
    await page.waitForURL(url => url.searchParams.get('sport') === 'badminton');
    assert.equal(await page.getByRole('navigation', { name: 'Chọn nhanh môn chơi' }).getByRole('link', { name: 'Cầu lông', exact: true }).getAttribute('aria-current'), 'true');
  }
  console.log('OK: sport shortcuts apply filters and retain date, district, search, sorting, status and location.');
  await page.goto(`${origin}/tim-san`);
  const venueUrl = new URL(await page.locator('a[href^="/san/"]').first().getAttribute('href'), origin).href;
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(venueUrl);
    await page.locator('h1').waitFor();
    if (width < 640) assert((await page.locator('h1').boundingBox()).width >= width - 50, 'Venue title must have full mobile width');
    const nav = page.getByRole('navigation', { name: 'Các mục trong trang sân' });
    await nav.getByRole('link', { name: 'Giờ trống', exact: true }).click();
    await page.waitForTimeout(700);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Venue overflows at ${width}`);
    const title = await page.getByRole('heading', { name: 'Bạn muốn chơi ngày nào?', exact: true }).boundingBox();
    const navBox = await nav.boundingBox();
    assert(title.y >= navBox.y + navBox.height - 2, `Sticky nav covers schedule heading at ${width}`);
    if (output && [390, 1440].includes(width)) {
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `${output}/venue-${width}.png`, fullPage: true });
    }
  }
  await page.goto(`${origin}/san/san-cau-long-fpt`);
  if (await page.getByRole('button', { name: /^Mở ảnh 1 / }).count()) {
    const checkGallery = (await import('./check-venue-gallery.mjs')).default;
    console.log(await checkGallery(page, `${origin}/san/san-cau-long-fpt`));
  }
  assert.deepEqual(errors, []);
  console.log('OK: venue anchors and schedule fit 320/390/768/1024/1440px; no browser exceptions.');
} finally { await context.close(); await browser.close(); }
