// Synthetic localhost data. Every booking mutation is intercepted, including simulated failures.
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
const errors = [];
const writes = [];
let responseMode = 'error';
page.on('pageerror', error => errors.push(error.message));
await page.route('**/api/bookings/**', route => {
  assert.equal(route.request().method(), 'POST');
  writes.push({ url: route.request().url(), body: route.request().postDataJSON() });
  if (responseMode === 'offline') return route.abort('failed');
  return route.fulfill({ status: responseMode === 'success' ? 200 : 400, contentType: 'application/json', body: JSON.stringify(responseMode === 'success' ? { ok: true } : { error: 'Lỗi kiểm thử: chưa cập nhật đơn.' }) });
});
async function screenshot(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(650);
  if (output) await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}
async function signIn(role) {
  const id = role === 'owner' ? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' : 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, exp, aud: 'authenticated', role: 'authenticated', fixture_role: role })}.fixture`;
  await context.addCookies([{ name: 'sb-127-auth-token', url: origin, sameSite: 'Lax', value: `base64-${b64({ access_token: token, refresh_token: 'fixture-only', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id, email: 'fixture@example.invalid' } })}` }]);
}
try {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${origin}/giai-dau`);
    await page.locator('.pf-tournament-card').first().waitFor();
    assert.equal(await page.locator('.pf-tournament-card').count(), 2);
    assert.equal(await page.locator('.pf-tournament-date').count(), 2);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const cta = await page.locator('.pf-tournament-cta').first().boundingBox();
    assert(cta.height >= 44);
    if ([390, 1440].includes(width)) await screenshot(`review-tournaments-${width}`);
  }
  await page.getByRole('link', { name: 'Dạng danh sách', exact: true }).click();
  await page.waitForURL(url => url.searchParams.get('layout') === 'list');
  await page.waitForTimeout(450);
  assert.equal(await page.locator('.pf-tournament-card[data-layout="list"]').count(), 2);
  const media = await page.locator('.pf-tournament-media').first().boundingBox();
  const title = await page.getByRole('heading', { name: 'Cầu lông Hà Nội mở rộng', exact: true }).boundingBox();
  assert(media.x + media.width <= title.x, 'List mode uses image and details side by side');
  await screenshot('review-tournaments-list-1440');

  await signIn('admin');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${origin}/don-cua-toi?filter=all`);
    await page.getByRole('heading', { name: 'Đơn của tôi', exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if ([390, 1440].includes(width)) await screenshot(`review-my-bookings-${width}`);
    const cancel = page.getByRole('button', { name: 'Hủy giữ chỗ', exact: true });
    await cancel.click();
    const dialog = page.getByRole('dialog', { name: 'Hủy giữ chỗ?', exact: true });
    await dialog.waitFor();
    assert.equal(writes.length, 0, 'Opening cancellation never sends a mutation');
    assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth));
    await dialog.getByRole('button', { name: 'Giữ lại đơn', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    assert(await cancel.evaluate(element => element === document.activeElement));
  }
  const cancel = page.getByRole('button', { name: 'Hủy giữ chỗ', exact: true });
  await cancel.click();
  const dialog = page.getByRole('dialog', { name: 'Hủy giữ chỗ?', exact: true });
  await dialog.getByRole('button', { name: 'Giữ lại đơn', exact: true }).focus();
  await page.keyboard.press('Tab');
  assert(await dialog.evaluate(element => element.contains(document.activeElement)));
  await dialog.getByRole('button', { name: 'Xác nhận hủy', exact: true }).click();
  await dialog.getByRole('alert').waitFor();
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].body, { pending_only: true });
  assert(await dialog.getByRole('button', { name: 'Xác nhận hủy', exact: true }).isEnabled());
  await screenshot('review-cancel-dialog-1440');
  responseMode = 'success';
  await dialog.getByRole('button', { name: 'Xác nhận hủy', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  assert.equal(writes.length, 2);
  await page.getByRole('group', { name: 'Lọc đơn đặt sân' }).getByRole('button', { name: /Lịch sử/ }).click();
  await page.getByRole('heading', { name: 'Chưa có lịch sử đặt sân', exact: true }).waitFor();
  await page.getByRole('group', { name: 'Lọc đơn đặt sân' }).getByRole('button', { name: /Tất cả/ }).click();
  const search = page.getByRole('searchbox', { name: 'Tìm đơn theo mã hoặc tên sân', exact: true });
  await search.fill('SANDEF567');
  await page.waitForTimeout(650);
  assert.equal(await search.inputValue(), 'SANDEF567');
  assert(await search.evaluate(element => element === document.activeElement));
  assert.equal(await page.locator('.pf-player-booking').count(), 1);

  await signIn('owner');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${origin}/chu-san/don`);
    await page.locator('.pf-booking-record time').first().waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.equal(await page.locator('.pf-booking-record time').count(), 2);
    if ([390, 1440].includes(width)) await screenshot(`review-owner-orders-${width}`);
  }
  const confirm = page.getByRole('button', { name: 'Đã nhận cọc — xác nhận tay', exact: true });
  responseMode = 'offline';
  await confirm.click();
  await page.getByRole('alert').filter({ hasText: 'Mất kết nối' }).waitFor();
  assert(await confirm.isEnabled(), 'Failed network request makes the action retryable');
  responseMode = 'error';
  await confirm.click();
  await page.getByRole('alert').filter({ hasText: 'Lỗi kiểm thử' }).waitFor();
  assert(await confirm.isEnabled());
  assert.equal(writes.length, 4, 'Only explicitly clicked actions send requests');

  await page.goto(`${origin}/san/san-cau-giay`);
  await page.getByRole('button', { name: 'Chọn giờ sớm nhất · 10:00', exact: true }).click();
  const summary = page.getByRole('complementary', { name: 'Tóm tắt đặt sân' });
  await summary.getByRole('button', { name: 'Tiếp tục đặt sân', exact: true }).click();
  await page.getByRole('heading', { name: 'Kiểm tra trước khi giữ chỗ', exact: true }).waitFor();
  await page.getByLabel('Tên người đặt', { exact: true }).fill('Người thử giao diện');
  await page.waitForTimeout(450);
  assert.equal(await page.getByLabel('Tên người đặt', { exact: true }).inputValue(), 'Người thử giao diện');
  assert.equal(await page.getByLabel('Tiến trình đặt sân').locator('[aria-current="step"]').textContent(), 'Thông tin');
  await screenshot('review-booking-form-1440');
  await page.getByRole('button', { name: 'Chọn lại', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: /^10:00, còn sân/ }).getAttribute('aria-pressed'), 'true');
  assert.equal(writes.length, 4, 'Reviewing contact information does not create a booking');
  assert.deepEqual(errors, []);
  console.log('OK: populated tournaments, adaptive orders, cancellation safety/focus, recoverable owner actions and booking review.');
} finally { await context.close(); await browser.close(); }
