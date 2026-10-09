// Isolated localhost fixtures; all auth and booking writes are intercepted.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin = process.argv[2];
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = process.env.UX_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
const page = await context.newPage();
const errors = [], signupCalls = [], bookingCalls = [], recoveryCalls = [];
page.on('pageerror', error => errors.push(error.message));
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
await page.route('**/auth/v1/**', route => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) return route.continue();
  if (new URL(route.request().url()).pathname.endsWith('/signup')) {
    signupCalls.push(route.request().postDataJSON());
    return json(route, { user: { id, identities: [{ id }], email: 'fixture@example.invalid' }, session: null });
  }
  if (new URL(route.request().url()).pathname.endsWith('/recover')) {
    recoveryCalls.push({ body: route.request().postDataJSON(), url: route.request().url() });
    return json(route, {});
  }
  if (route.request().method() === 'PUT' && new URL(route.request().url()).pathname.endsWith('/user')) return json(route, { id, email: 'fixture@example.invalid', user_metadata: {}, app_metadata: {}, aud: 'authenticated' });
  return json(route, { message: 'Unmocked auth write rejected' }, 403);
});
await page.route('**/api/bookings', route => {
  bookingCalls.push(route.request().postDataJSON());
  return json(route, { error: 'Lỗi kiểm thử: thông tin được giữ lại.' }, 400);
});
async function screenshot(name) {
  await page.evaluate(() => document.fonts.ready);
  if (output) await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}
try {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const phone of ['0912 345 678', '+84 912 345 678', '+84 (912) 345-678', '0912345678']) {
      await page.goto(`${origin}/dang-ky`);
      await page.getByLabel('Tên của bạn', { exact: true }).fill('Khách đăng ký');
      await page.getByLabel('Số điện thoại', { exact: true }).fill(phone);
      await page.getByLabel('Email', { exact: true }).fill('fixture@example.invalid');
      await page.getByLabel('Mật khẩu', { exact: true }).fill('fixture-password-123');
      await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('fixture-password-123');
      const before = signupCalls.length;
      await page.getByRole('button', { name: 'Đăng ký và nhận mã OTP', exact: true }).click();
      await page.getByText('Nhập mã OTP', { exact: true }).waitFor();
      assert.equal(signupCalls.length, before + 1);
      assert.equal(signupCalls.at(-1).data.phone, '0912345678');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    for (const phone of ['09123456789', '+1 912 345 678', '0912345678x']) {
      await page.goto(`${origin}/dang-ky`);
      await page.getByLabel('Tên của bạn', { exact: true }).fill('Khách đăng ký');
      await page.getByLabel('Email', { exact: true }).fill('fixture@example.invalid');
      await page.getByLabel('Mật khẩu', { exact: true }).fill('fixture-password-123');
      await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('fixture-password-123');
      await page.getByLabel('Số điện thoại', { exact: true }).fill(phone);
      const before = signupCalls.length;
      await page.getByLabel('Số điện thoại', { exact: true }).press('Enter');
      await page.locator('main').getByRole('alert').filter({ hasText: 'Số điện thoại phải gồm 10 chữ số' }).waitFor();
      assert.equal(signupCalls.length, before, 'Invalid phone never sends a signup request');
    }
    await screenshot(`review-signup-phone-${width}`);
  }
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, exp, aud: 'authenticated', role: 'authenticated', fixture_role: 'admin' })}.fixture`;
  await context.addCookies([{ name: 'sb-127-auth-token', url: origin, sameSite: 'Lax', value: `base64-${b64({ access_token: token, refresh_token: 'fixture-only', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id, email: 'fixture@example.invalid' } })}` }]);
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const phone of ['0912 345 678', '+84 912 345 678', '+84 (912) 345-678', '0912345678', '0912345678x']) {
      await page.goto(`${origin}/san/san-cau-giay`);
      await page.getByRole('button', { name: 'Chọn giờ sớm nhất · 10:00', exact: true }).click();
      await page.getByRole('button', { name: 'Tiếp tục đặt sân', exact: true }).click();
      await page.getByLabel('Tên người đặt', { exact: true }).fill('Khách đặt sân');
      await page.getByLabel('Số điện thoại', { exact: true }).fill(phone);
      const before = bookingCalls.length;
      await page.getByLabel('Số điện thoại', { exact: true }).press('Enter');
      const feedback = page.getByRole('region', { name: 'Thông tin đặt sân', exact: true }).getByRole('alert');
      await feedback.waitFor();
      if (phone.endsWith('x')) {
        assert.equal(bookingCalls.length, before, 'Invalid phone never creates a booking');
        assert.match(await feedback.innerText(), /Số điện thoại phải gồm 10 chữ số/);
      } else {
        assert.equal(bookingCalls.length, before + 1);
        assert.equal(bookingCalls.at(-1).customer_phone, '0912345678');
        assert.equal(await page.getByLabel('Số điện thoại', { exact: true }).inputValue(), '0912345678');
      }
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await screenshot(`review-booking-phone-${width}`);
  }
  assert.deepEqual(errors, []);
  console.log('OK: signup and booking accept spaced/+84 phones, normalize before submit and reject invalid numbers with mouse or Enter. No real email or booking.');
} finally { await context.close(); await browser.close(); }
