// Isolated headless contexts; all writes are intercepted, no real bookings or money.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin = process.argv[2];
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const storageKey = 'san-ngon:pending-booking-request';
const ids = { admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', owner: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };
async function signIn(context, role) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ids[role], exp, aud: 'authenticated', role: 'authenticated', fixture_role: role })}.fixture`;
  const value = `base64-${b64({ access_token: token, refresh_token: 'fixture-only', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id: ids[role], email: 'fixture@example.invalid' } })}`;
  await context.addCookies([{ name: 'sb-127-auth-token', value, url: origin, sameSite: 'Lax' }]);
}
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', viewport: { width, height: 1000 } });
    try {
      await signIn(context, 'admin');
      const page = await context.newPage();
      const errors = [], attempts = [];
      let mode = 'offline';
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/bookings', async route => {
        attempts.push(route.request().postDataJSON());
        await new Promise(resolve => setTimeout(resolve, 150));
        if (mode === 'offline') return route.abort('failed');
        return route.fulfill({ status: 201, contentType: 'application/json', body: '{"booking":{"code":"SANDEF567"}}' });
      });
      await page.goto(`${origin}/san/san-cau-giay`);
      await page.getByRole('button', { name: 'Chọn giờ sớm nhất · 10:00', exact: true }).click();
      await page.getByRole('button', { name: 'Tiếp tục đặt sân', exact: true }).click();
      await page.getByLabel('Tên người đặt', { exact: true }).fill('Khách khôi phục');
      await page.getByLabel('Số điện thoại', { exact: true }).fill('0912345678');
      await page.getByRole('button', { name: 'Giữ chỗ 15 phút', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Đơn có thể đã được tạo' }).waitFor();
      assert.equal(attempts.length, 1);
      assert.match(attempts[0].request_id, /^[0-9a-f-]{36}$/);
      assert.equal(attempts[0].request_user_id, ids.admin);
      await page.getByRole('link', { name: 'Kiểm tra Đơn của tôi', exact: true }).click();
      await page.getByRole('region', { name: 'Khôi phục đặt sân' }).waitFor();
      await page.reload();
      const recovery = page.getByRole('region', { name: 'Khôi phục đặt sân' });
      await recovery.waitFor();
      assert.equal(attempts.length, 1, 'reload never automatically creates a hold');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (process.env.UX_SCREENSHOT_DIR) {
        await mkdir(process.env.UX_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: `${process.env.UX_SCREENSHOT_DIR}/booking-recovery-${width}.png`, fullPage: true });
      }
      const saved = await page.evaluate(key => sessionStorage.getItem(key), storageKey);
      mode = 'success';
      await recovery.getByRole('button', { name: 'Tiếp tục lần đặt này', exact: true }).evaluate(button => { button.click(); button.click(); });
      await page.waitForURL('**/dat-san/SANDEF567');
      assert.equal(attempts.length, 2, 'double click sends one recovery request');
      assert.deepEqual(attempts[1], attempts[0], 'recovery sends same UUID and frozen contact/court/time');
      assert.equal(await page.evaluate(key => sessionStorage.getItem(key), storageKey), null, 'successful recovery clears only its pending intent');
      await page.goto(`${origin}/don-cua-toi`);
      await page.evaluate(([key, value]) => sessionStorage.setItem(key, value), [storageKey, saved]);
      await signIn(context, 'owner');
      await page.reload();
      await page.getByRole('heading', { name: 'Đơn của tôi', exact: true }).waitFor();
      assert.equal(await page.getByRole('region', { name: 'Khôi phục đặt sân' }).count(), 0, 'different account never reuses old intent');
      assert.equal(await page.evaluate(key => sessionStorage.getItem(key), storageKey), null);
      assert.equal(attempts.length, 2);
      await page.evaluate(key => sessionStorage.setItem(key, 'broken'), storageKey);
      await page.reload();
      assert.equal(await page.getByRole('region', { name: 'Khôi phục đặt sân' }).count(), 0, 'corrupt storage cannot generate a new request');
      assert.deepEqual(errors, []);
      console.log(`OK: booking recovery ${width}px, persisted UUID, reload, duplicate click, account isolation and corrupt storage.`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
