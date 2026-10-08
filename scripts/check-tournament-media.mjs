// Read-only checks in isolated headless Chromium. No auth or remote writes.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.argv[2] || 'http://localhost:3112';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = process.env.UX_SCREENSHOT_DIR || 'output/tournament-media';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
const page = await context.newPage();
const errors = [];
let videoRequests = 0;
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.url().includes('/videos/tournament-guide.webm')) videoRequests++; });
const trigger = () => page.getByRole('button', { name: 'Xem video hướng dẫn tham gia giải', exact: true });
const dialog = () => page.getByRole('dialog', { name: 'Từ đăng ký đến ra sân', exact: true });
const fit = async label => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: overflow at ${page.viewportSize().width}`);
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${origin}/giai-dau`);
    await trigger().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await fit('List');
    assert.equal(await page.locator('video').count(), 0);
    if ([390, 1440].includes(width)) {
      await page.locator('main img').evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => {}))));
      await page.screenshot({ path: `${output}/list-${width}.png`, fullPage: true });
    }
    await trigger().click();
    await dialog().waitFor();
    await page.waitForFunction(() => document.querySelector('dialog video')?.readyState >= 2 && !document.querySelector('dialog video').paused);
    const metadata = await dialog().locator('video').evaluate(video => ({ duration: video.duration, muted: video.muted, width: video.videoWidth, height: video.videoHeight }));
    assert.equal(metadata.duration, 18); assert(metadata.muted); assert.equal(metadata.width, 1280); assert.equal(metadata.height, 720);
    await fit('Video');
    await dialog().locator('video').evaluate(video => { video.pause(); video.currentTime = 10; });
    await page.waitForFunction(() => Math.abs(document.querySelector('dialog video').currentTime - 10) < 0.2 && document.querySelector('dialog video').readyState >= 2);
    if ([390, 1440].includes(width)) await page.screenshot({ path: `${output}/video-${width}.png` });
    await page.keyboard.press('Escape');
    await dialog().waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    assert(await trigger().evaluate(button => button === document.activeElement));
  }
  assert(videoRequests > 0);
  console.log('OK: explicit video playback, finite duration/seeking, silent, responsive dialog, Escape/focus/scroll restoration.');
  const photoCard = page.getByRole('region', { name: 'Kết quả giải đấu' }).locator('li').filter({ has: page.locator('img[alt^="Ảnh sân tổ chức"]') }).first();
  if (await photoCard.count()) {
    const photo = photoCard.locator('img');
    assert((await photo.getAttribute('src')).includes('/venue-photos/'));
    await photo.evaluate(image => image.decode());
    const href = await photoCard.locator('a').getAttribute('href');
    await page.goto(`${origin}${href}`);
    const gallery = page.locator('#anh-san'); await gallery.waitFor();
    assert((await page.locator('meta[property="og:image"]').getAttribute('content')).includes('/venue-photos/'));
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 }); await fit('Detail gallery');
      if ([390, 1440].includes(width)) {
        await gallery.scrollIntoViewIfNeeded();
        await gallery.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => {}))));
        await page.screenshot({ path: `${output}/gallery-${width}.png` });
      }
    }
    await gallery.getByRole('button', { name: /^Mở ảnh 1 / }).click();
    const viewer = page.getByRole('dialog', { name: /^Ảnh / }); await viewer.waitFor();
    await viewer.getByRole('button', { name: 'Ảnh tiếp theo', exact: true }).click();
    assert.equal(await viewer.getByRole('button', { name: 'Xem ảnh 2', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape'); await viewer.waitFor({ state: 'hidden' });
    console.log('OK: linked venue photo fallback, social preview, real gallery, next image and Escape.');
  } else console.log('No live public tournament needs a venue photo fallback; gallery checks skipped.');
  await page.goto(`${origin}/giai-dau`);
  await page.route('**/videos/tournament-guide.webm', route => route.abort());
  await trigger().click();
  await dialog().getByText('Video chưa tải được.', { exact: false }).waitFor();
  await page.unroute('**/videos/tournament-guide.webm');
  await dialog().getByRole('button', { name: 'Thử lại video', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('dialog video')?.readyState >= 2 && !document.querySelector('dialog video').paused);
  await dialog().getByRole('button', { name: 'Đóng video', exact: true }).click();
  for (const kind of ['reduced', 'data-saver', 'no-js']) {
    const quiet = await browser.newContext(kind === 'reduced' ? { reducedMotion: 'reduce' } : kind === 'no-js' ? { javaScriptEnabled: false } : {});
    if (kind === 'data-saver') await quiet.addInitScript(() => Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } }));
    const qp = await quiet.newPage(); let requests = 0;
    qp.on('request', request => { if (request.url().includes('/videos/tournament-guide.webm')) requests++; });
    await qp.goto(`${origin}/giai-dau`); await qp.locator('h1').waitFor();
    assert.equal(await qp.locator('video').count(), 0); assert.equal(requests, 0);
    if (kind === 'no-js') assert(await qp.getByRole('link', { name: 'Mở video hướng dẫn', exact: true }).isVisible());
    await quiet.close();
  }
  assert.deepEqual(errors, []);
  console.log('OK: failed video retry, no initial video download in reduced-motion/data-saver/no-JS; no browser exceptions.');
} finally { await context.close(); await browser.close(); }