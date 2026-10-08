// Isolated headless Chromium. Read-only pages and intercepted booking writes.
// PLAYWRIGHT_MODULE may point to an existing Playwright install outside the repo.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.argv[2] || 'http://localhost:3100';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = process.env.UX_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const errors = [];
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
const overflow = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${page.viewportSize().width}px`);
const hero = page.getByRole('region', { name: 'Tìm cảm hứng ra sân' });
const ownerHeading = page.getByRole('heading', { name: /Bạn chăm sân/ });
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin);
    await page.locator('h1').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await overflow();
    const active = hero.locator('[aria-roledescription="slide"][aria-hidden="false"]');
    await active.locator('img').evaluate(image => image.decode());
    const cta = await active.getByRole('link').boundingBox();
    assert(cta.height >= 44 && cta.height <= 46 && cta.width < 260, 'Hero CTA should stay compact and touchable');
    if (output && [390, 1440].includes(width)) {
      for (let y = 0; y < await page.evaluate(() => document.body.scrollHeight); y += 650) {
        await page.evaluate(y => scrollTo(0, y), y); await page.waitForTimeout(120);
      }
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(650);
      await page.screenshot({ path: `${output}/home-${width}.png`, fullPage: true });
    }
    await page.goto(`${origin}/tim-san`);
    await page.locator('h1').waitFor(); await overflow();
    if (output && [390, 1440].includes(width)) await page.screenshot({ path: `${output}/search-${width}.png`, fullPage: true });
  }
  console.log('OK: landing and search at 320/390/768/1024/1440px; CTA 44px, no overflow.');
  await page.goto(origin);
  await hero.getByRole('button', { name: 'Xem Cầu lông', exact: true }).click();
  assert.equal(await hero.locator('[aria-roledescription="slide"][aria-hidden="false"]').getAttribute('aria-label'), '2 / 3 · Cầu lông');
  await hero.getByRole('button', { name: 'Ảnh tiếp theo', exact: true }).click();
  assert.equal(await hero.locator('[aria-roledescription="slide"][aria-hidden="false"]').getAttribute('aria-label'), '3 / 3 · Pickleball');
  await hero.getByRole('button', { name: 'Ảnh tiếp theo', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await hero.locator('[aria-roledescription="slide"][aria-hidden="false"]').getAttribute('aria-label'), '1 / 3 · Bóng đá');
  assert.equal(await hero.getByRole('button', { name: 'Tự chuyển ảnh', exact: true }).getAttribute('aria-pressed'), 'false');
  await hero.getByRole('button', { name: 'Tự chuyển ảnh', exact: true }).click();
  await page.locator('#q').focus(); await page.mouse.move(0, 0);
  await page.waitForFunction(() => document.querySelector('[data-hero-carousel]').dataset.playing === 'true');
  await hero.getByRole('button', { name: 'Dừng tự chuyển ảnh', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-hero-carousel]').dataset.playing === 'false');
  console.log('OK: slide tabs, wrapping, keyboard, pause/resume.');
  const videoButton = page.getByRole('button', { name: 'Dừng video nền', exact: true });
  await ownerHeading.scrollIntoViewIfNeeded(); await videoButton.waitFor();
  assert(await page.locator('video').evaluate(video => !video.paused), 'Video should play in view');
  await videoButton.click();
  assert(await page.locator('video').evaluate(video => video.paused));
  await page.getByRole('button', { name: 'Phát video nền', exact: true }).click(); await videoButton.waitFor();
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForFunction(() => document.querySelector('video')?.paused);
  console.log('OK: video plays in view, user pause/resume, stops offscreen.');
  const reduced = await browser.newContext({ reducedMotion: 'reduce' });
  const quiet = await reduced.newPage();
  await quiet.goto(origin); await quiet.locator('h1').waitFor();
  await quiet.getByRole('heading', { name: /Bạn chăm sân/ }).scrollIntoViewIfNeeded();
  assert.equal(await quiet.locator('video').count(), 0);
  assert.equal(await quiet.getByRole('button', { name: 'Tự chuyển ảnh', exact: true }).isDisabled(), true);
  assert(await quiet.locator('.pf-reveal').evaluateAll(elements => elements.every(element => getComputedStyle(element).opacity === '1')));
  await reduced.close();
  const saving = await browser.newContext();
  await saving.addInitScript(() => Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } }));
  const saver = await saving.newPage();
  await saver.goto(origin); await saver.locator('h1').waitFor();
  await saver.getByRole('heading', { name: /Bạn chăm sân/ }).scrollIntoViewIfNeeded();
  assert.equal(await saver.locator('video').count(), 0); await saving.close();
  const nojs = await browser.newContext({ javaScriptEnabled: false });
  const fallback = await nojs.newPage(); await fallback.goto(origin);
  assert(await fallback.locator('h1').isVisible());
  assert(await fallback.locator('.pf-reveal').evaluateAll(elements => elements.every(element => getComputedStyle(element).opacity === '1')));
  assert.equal(await fallback.locator('video').count(), 0); await nojs.close();
  console.log('OK: reduced motion, data saver, no-JS content/poster fallback.');
  const checkPicker = (await import('./check-venue-time-picker.mjs')).default;
  console.log(await checkPicker(page, origin));
  const region = page.getByRole('region', { name: 'Giờ chơi của cụm sân' });
  await region.locator('button:enabled').first().click();
  await page.getByRole('button', { name: 'Tiếp tục đặt sân' }).click();
  const stage = page.getByRole('region', { name: 'Thông tin đặt sân', exact: true });
  await stage.waitFor();
  assert(await stage.evaluate(element => document.activeElement === element), 'Focus should move to the booking form');
  const submit = stage.getByRole('button', { name: 'Đăng nhập để tiếp tục', exact: true });
  const box = await submit.boundingBox();
  assert(box.height >= 44 && box.height <= 46, 'Booking CTA must be 44px');
  await stage.getByRole('button', { name: 'Chọn lại', exact: true }).click();
  assert(await region.locator('button[aria-pressed="true"]').evaluate(element => document.activeElement === element), 'Focus should return to the selected time');
  console.log('OK: booking CTA size and keyboard focus across both steps.');
  assert.deepEqual(errors, [], 'Browser exceptions');
} finally { await context.close(); await browser.close(); }
