// Synthetic sessions and read-only localhost fixtures; every purchase write is intercepted.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin = process.argv[2];
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = process.env.UX_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
async function signIn(context, state, role = 'owner') {
  const id = role === 'admin' ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' : 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const exp = Math.floor(Date.now() / 1000) + 3600, b64 = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, exp, aud: 'authenticated', role: 'authenticated', fixture_role: role, fixture_vip: state })}.fixture`;
  await context.addCookies([{ name: 'sb-127-auth-token', url: origin, sameSite: 'Lax', value: `base64-${b64({ access_token: token, refresh_token: 'fixture', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id } })}` }]);
}
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', viewport: { width, height: 1000 } });
    const page = await context.newPage(), errors = [], writes = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://qr.sepay.vn/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="white"/></svg>' }));
    await page.route('**/api/vip', async route => {
      writes.push({ method: route.request().method(), body: route.request().postDataJSON() });
      await signIn(context, route.request().method() === 'POST' ? 'awaiting_payment' : 'pending');
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await signIn(context, '');
    await page.goto(`${origin}/vip`);
    await page.getByRole('button', { name: 'Mua / gia hạn VIP · 49.000đ' }).click();
    const submit = page.getByRole('button', { name: 'Tôi đã chuyển khoản · Gửi admin duyệt' });
    await submit.waitFor();
    const qr = new URL(await page.locator('img[alt^="QR mua VIP"]').getAttribute('src'));
    assert.equal(qr.searchParams.get('amount'), '49000');
    assert.equal(qr.searchParams.get('acc'), '0691920022005');
    assert.equal(qr.searchParams.get('des'), 'VIPABCDEF123456');
    assert.match(await page.locator('main').innerText(), /VIP chưa hoạt động/);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (output) await page.screenshot({ path: `${output}/vip-purchase-${width}.png`, fullPage: true });
    await submit.click();
    await page.getByRole('status').filter({ hasText: 'Đã gửi admin đối soát' }).waitFor();
    assert.equal(await page.getByRole('img', { name: /^QR mua VIP/ }).count(), 0);
    assert.equal(await page.getByRole('heading', { name: 'Đã kích hoạt VIP', exact: true }).count(), 0);
    assert.equal(writes.length, 2);
    assert.equal(writes[1].body.id, 'f2500000-0000-4000-8000-000000000001');
    assert.match(await page.locator('main').innerText(), /VIP chưa hoạt động/);
    await signIn(context, 'approved');
    await page.goto(`${origin}/vip`);
    await page.getByText('VIP đang hoạt động', { exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Đã kích hoạt VIP', exact: true }).waitFor();
    assert.equal(await page.getByRole('img', { name: /^QR mua VIP/ }).count(), 0);
    assert.equal(await page.getByRole('heading', { name: 'Ba bước để dùng VIP' }).count(), 0);
    if (output) await page.screenshot({ path: `${output}/vip-activated-${width}.png`, fullPage: true });
    await signIn(context, 'active_renewal');
    await page.goto(`${origin}/vip`);
    await page.getByRole('heading', { name: 'Đã kích hoạt VIP', exact: true }).waitFor();
    assert(!(await page.getByRole('img', { name: /^QR mua VIP/ }).isVisible()));
    await page.getByText('Xem yêu cầu gia hạn VIP', { exact: true }).click();
    await page.getByRole('heading', { name: 'Gia hạn VIP · chờ chuyển khoản' }).waitFor();
    assert(await page.getByRole('img', { name: /^QR mua VIP/ }).isVisible());
    if (output) await page.screenshot({ path: `${output}/vip-renewal-${width}.png`, fullPage: true });
    await signIn(context, 'approved');
    await page.goto(`${origin}/san/san-cau-giay`);
    await page.getByRole('button', { name: 'Chọn giờ sớm nhất · 10:00', exact: true }).click();
    await page.getByRole('button', { name: 'Tiếp tục đặt sân', exact: true }).click();
    await page.getByText('Ưu đãi VIP 10%', { exact: true }).waitFor();
    const form = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Kiểm tra trước khi giữ chỗ' }) });
    assert.match(await form.innerText(), /90\.000/);
    assert.match(await form.innerText(), /không phải trả thêm 10%/);
    assert(await page.getByRole('button', { name: 'Giữ chỗ 15 phút', exact: true }).isEnabled());
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (output) await page.screenshot({ path: `${output}/vip-booking-${width}.png`, fullPage: true });
    await signIn(context, '', 'admin');
    await page.route('**/api/admin/vip', async route => {
      const body = route.request().postDataJSON();
      assert.equal(body.approve, true); assert.equal(body.verified, true); assert.equal(body.transaction_id, '990002501');
      await route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"Giao dịch đã dùng để thanh toán."}' });
    });
    await page.goto(`${origin}/admin/vip`);
    const approve = page.getByRole('button', { name: 'Duyệt VIP 1 tháng' });
    assert(await approve.isDisabled());
    await page.getByLabel('ID giao dịch SePay', { exact: true }).fill('990002501');
    assert(await approve.isDisabled());
    await page.getByRole('checkbox').check();
    assert(await approve.isEnabled());
    await approve.click();
    await page.getByRole('alert').filter({ hasText: 'Giao dịch đã dùng' }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (output) await page.screenshot({ path: `${output}/vip-admin-${width}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('OK: VIP QR receiver/price, pending review, discounted booking and admin verification on desktop/mobile.');
} finally { await browser.close(); }
