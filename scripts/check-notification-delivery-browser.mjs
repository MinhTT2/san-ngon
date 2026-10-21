import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const origin = process.argv[2];
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  assert.equal((await context.request.post(origin + '/api/sepay/notifications')).status(), 401, 'scheduler POST reaches its own credential guard');
  const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, exp, aud: 'authenticated', role: 'authenticated', fixture_role: 'admin' })}.fixture`;
  await context.addCookies([{ name: 'sb-127-auth-token', url: origin, value: `base64-${b64({ access_token: token, refresh_token: 'fixture', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id, email: 'fixture@example.invalid' } })}` }]);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin + '/admin/van-hanh');
    await page.getByRole('heading', { name: 'Gửi thông báo', exact: true }).waitFor();
    await page.getByText('Chủ sân kiểm tra · Gửi thất bại · 6 lần thử', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Đưa vào hàng đợi lại', exact: true }).count(), 1);
    let requestBody;
    await page.route('**/api/admin/notification-deliveries/*/retry', async route => {
      requestBody = route.request().postDataJSON(); return route.fulfill({ json: { ok: true } });
    });
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Đưa vào hàng đợi lại', exact: true }).click();
    await page.getByText('Đã đưa vào hàng đợi.', { exact: true }).waitFor();
    assert.equal(requestBody.updated_at, '2026-10-01T03:00:00Z');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (process.env.UX_SCREENSHOT_DIR) {
      await mkdir(process.env.UX_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: `${process.env.UX_SCREENSHOT_DIR}/notification-delivery-${width}.png`, fullPage: true });
    }
  }
  await context.clearCookies(); await page.goto(origin + '/admin/van-hanh');
  await page.waitForURL(url => url.pathname === '/dang-nhap');
  await context.close();
  console.log('OK: admin outbox 390/1440, clear statuses, private projection, explicit retry with concurrency timestamp and anonymous access.');
} finally { await browser.close(); }
