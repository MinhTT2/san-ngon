// Local, isolated Chromium only. Reads public routes; never submits booking/payment data.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.argv[2] || 'http://localhost:3100';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = process.env.UX_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext();
const errors = [];
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
try {
  for (const route of ['/tim-san', '/giai-dau', '/ket-noi', '/dang-nhap', '/dang-ky', '/lien-he', '/chinh-sach-huy', '/quen-mat-khau']) {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(origin + route); await page.locator('h1').waitFor();
      await page.waitForTimeout(650);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route}: overflow at ${width}`);
      assert(await page.locator('h1').isVisible(), `${route}: readable heading`);
      assert(await page.locator('[data-motion-seen]').count() > 0, `${route}: enhanced page entry`);
      if (output && ['/tim-san', '/ket-noi'].includes(route)) await page.screenshot({ path: `${output}/${route.slice(1)}-${width}.png`, fullPage: true });
    }
  }
  console.log('OK: public discovery, auth and support pages enter cleanly at mobile/desktop widths.');
  await page.goto(`${origin}/tim-san`);
  const scene = page.locator('[data-ambient-scene="court"]');
  await page.waitForFunction(() => {
    const video = document.querySelector('[data-ambient-scene="court"] video');
    return video && !video.paused && video.readyState >= 2;
  });
  assert.equal(await scene.getByRole('button').count(), 0, 'Ambient video has no playback button');
  const video = scene.locator('video');
  assert(await video.evaluate(element => !element.paused && element.videoWidth === 960 && element.muted));
  const time = await video.evaluate(element => element.currentTime);
  await page.waitForTimeout(300);
  assert(await video.evaluate((element, time) => element.currentTime > time, time), 'The new film advances');
  // Browser back and hydration must not replace a form while the user is typing.
  const input = page.getByRole('searchbox').first();
  await input.fill('Cầu Giấy');
  await page.waitForTimeout(500);
  assert.equal(await input.inputValue(), 'Cầu Giấy');
  assert(await input.evaluate(element => element === document.activeElement));
  await page.getByRole('navigation', { name: 'Chọn nhanh môn chơi' }).getByRole('link', { name: 'Cầu lông', exact: true }).click();
  await page.waitForURL(url => url.searchParams.get('sport') === 'badminton');
  await page.getByRole('status', { name: 'Đang mở trang', exact: true }).waitFor({ state: 'detached' });
  await page.waitForTimeout(650);
  assert(await page.locator('[data-motion-seen]').count() > 0, 'Filter navigation still receives motion');
  await page.goBack(); await page.waitForTimeout(650);
  assert(await page.locator('h1').isVisible());
  console.log('OK: new film plays without controls; typing retains value/focus; filter and back navigation settle.');

  for (const mode of ['reduced', 'save-data', 'no-js', 'failed-video']) {
    const quiet = await browser.newContext(mode === 'reduced' ? { reducedMotion: 'reduce' } : mode === 'no-js' ? { javaScriptEnabled: false } : {});
    if (mode === 'save-data') await quiet.addInitScript(() => Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } }));
    const fallback = await quiet.newPage();
    let requests = 0;
    fallback.on('request', request => { if (request.url().includes('/videos/')) requests++; });
    if (mode === 'failed-video') await fallback.route('**/videos/court-flow.webm', route => route.abort());
    await fallback.goto(`${origin}/tim-san`); await fallback.locator('h1').waitFor();
    await fallback.waitForTimeout(800);
    assert(await fallback.locator('h1').isVisible());
    await fallback.locator('[data-ambient-scene="court"] img').evaluate(image => image.decode());
    if (mode !== 'failed-video') assert.equal(requests, 0, `${mode}: no video downloaded`);
    if (mode === 'reduced') {
      assert.equal(await fallback.locator('[data-motion-seen]').count(), 0);
      assert(await fallback.locator('h1').evaluate(element => getComputedStyle(element).opacity === '1'));
    }
    if (mode === 'failed-video') assert.equal(await fallback.locator('[data-ambient-scene="court"] video').count(), 0);
    await quiet.close();
  }
  assert.deepEqual(errors, []);
  console.log('OK: reduced motion, data saver, no-JS and video failure keep readable content/posters.');
} finally { await context.close(); await browser.close(); }
