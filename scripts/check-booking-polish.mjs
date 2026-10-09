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
let releaseWrite;
page.on('pageerror', error => errors.push(error.message));
await page.route('**/api/bookings/**', async route => {
  assert.equal(route.request().method(), 'POST');
  writes.push({ url: route.request().url(), body: route.request().postDataJSON() });
  if (responseMode === 'offline') return route.abort('failed');
  if (responseMode === 'delayed') await new Promise(resolve => { releaseWrite = resolve; });
  return route.fulfill({ status: ['success', 'delayed'].includes(responseMode) ? 200 : 400, contentType: 'application/json', body: JSON.stringify(['success', 'delayed'].includes(responseMode) ? { ok: true } : { error: 'Lỗi kiểm thử: chưa cập nhật đơn.' }) });
});
async function screenshot(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(650);
  if (output) await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}
async function signIn(role, refunds = false) {
  const id = role === 'owner' ? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' : 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, exp, aud: 'authenticated', role: 'authenticated', fixture_role: role, fixture_refunds: refunds })}.fixture`;
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
  await signIn('owner', true);
  const actions = [
    { opener: 'Đã nhận cọc — xác nhận tay', title: 'Xác nhận đã nhận cọc?', submit: 'Xác nhận đã nhận đủ cọc', busy: 'Đang xác nhận…', done: 'Đã xác nhận nhận cọc', endpoint: 'confirm', code: 'SANDEF567', customer: 'Mai Anh', amount: '120.000' },
    { opener: 'Đã hoàn — đánh dấu xong', title: 'Đánh dấu đã hoàn cọc?', submit: 'Xác nhận đã hoàn đủ cọc', busy: 'Đang cập nhật…', done: 'Đã đánh dấu hoàn cọc', endpoint: 'refund', code: 'SANABC234', customer: 'Lê Hải', amount: '100.000' },
  ];
  for (const path of ['/chu-san', '/chu-san/don']) {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${origin}${path}`);
      for (const action of actions) {
        const opener = page.getByRole('button', { name: action.opener, exact: true });
        const before = writes.length;
        await opener.click();
        const modal = page.getByRole('dialog', { name: action.title, exact: true });
        await modal.waitFor();
        assert.equal(writes.length, before, 'Opening owner confirmation never sends a mutation');
        const copy = await modal.innerText();
        assert(copy.includes(action.code) && copy.includes(action.customer) && copy.includes(action.amount) && copy.includes('Cầu lông 01'), 'Confirmation identifies the exact booking, person, court and amount');
        assert(await modal.evaluate(element => element.scrollWidth <= element.clientWidth), 'Confirmation fits the viewport');
        await modal.getByRole('button', { name: 'Quay lại', exact: true }).focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        assert(await modal.evaluate(element => element.contains(document.activeElement)), 'Keyboard focus stays inside confirmation');
        if ([390, 1440].includes(width)) await screenshot(`review-owner-${action.endpoint}-${path === '/chu-san' ? 'overview' : 'orders'}-${width}`);
        await page.keyboard.press('Escape');
        await modal.waitFor({ state: 'detached' });
        assert(await opener.evaluate(element => element === document.activeElement), 'Closing returns focus to the matching action');
        await opener.click();
        await modal.click({ position: { x: 2, y: 2 } });
        await modal.waitFor({ state: 'detached' });
        assert.equal(writes.length, before, 'Escaping or cancelling never changes money status');
      }
    }
  }
  for (const action of actions) {
    const opener = page.getByRole('button', { name: action.opener, exact: true });
    await opener.click();
    const modal = page.getByRole('dialog', { name: action.title, exact: true });
    const submit = modal.getByRole('button', { name: action.submit, exact: true });
    const before = writes.length;
    responseMode = 'error';
    await submit.click();
    const feedback = modal.getByRole('alert');
    await feedback.filter({ hasText: 'Lỗi kiểm thử' }).waitFor();
    assert.equal(writes.length, before + 1);
    assert(writes.at(-1).url.endsWith(`/${action.code}/${action.endpoint}`));
    assert(await submit.isEnabled(), 'A known server rejection permits retry');
    assert(await feedback.evaluate(element => element === document.activeElement), 'Failure receives focus inside the modal');
    if (action.endpoint === 'confirm') {
      responseMode = 'offline';
      await submit.click();
      await feedback.filter({ hasText: 'Mất kết nối' }).waitFor();
      assert.equal(await submit.count(), 0, 'An unknown network result requires reviewing current status before another mutation');
      await modal.getByRole('button', { name: 'Đóng và kiểm tra lại', exact: true }).click();
      await modal.waitFor({ state: 'detached' });
      await opener.click();
    }
    const beforeSuccess = writes.length;
    responseMode = 'delayed';
    releaseWrite = null;
    await submit.evaluate(element => { element.click(); element.click(); });
    await modal.getByRole('button', { name: action.busy, exact: true }).waitFor();
    assert.equal(writes.length, beforeSuccess + 1, 'Double clicking sends only one financial mutation');
    assert(await modal.getByRole('button', { name: 'Quay lại', exact: true }).isDisabled());
    await page.keyboard.press('Escape');
    await modal.getByRole('button', { name: 'Đóng', exact: true }).click();
    assert(await modal.isVisible(), 'Pending mutation keeps the confirmation open');
    releaseWrite();
    await modal.waitFor({ state: 'detached' });
    assert.equal(writes.length, beforeSuccess + 1);
    assert(await page.getByRole('button', { name: action.done, exact: true }).isDisabled(), 'Successful mutation cannot be submitted again while refreshed state is loading');
  }
  const ownerWrites = writes.length;

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
  assert.equal(writes.length, ownerWrites, 'Reviewing contact information does not create a booking');
  let bookingAttempts = 0;
  const bookingResponse = async route => {
    bookingAttempts++;
    assert.equal(route.request().method(), 'POST');
    await new Promise(resolve => setTimeout(resolve, 150));
    if (bookingMode === 'offline') return route.abort('failed');
    if (bookingMode === 'server') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Temporarily unavailable"}' });
    if (bookingMode === 'malformed') return route.fulfill({ status: 201, contentType: 'application/json', body: '{"booking":{}}' });
    if (bookingMode === 'invalid-json') return route.fulfill({ status: 201, contentType: 'application/json', body: 'broken' });
    return route.fulfill({ status: 409, contentType: 'application/json', body: '{"error":"Khung giờ vừa được đặt."}' });
  };
  let bookingMode = 'offline';
  await page.route('**/api/bookings', bookingResponse);
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (bookingMode of ['offline', 'server', 'malformed', 'invalid-json', 'rejected']) {
      await page.goto(`${origin}/san/san-cau-giay`);
      await page.getByRole('button', { name: 'Chọn giờ sớm nhất · 10:00', exact: true }).click();
      await page.getByRole('button', { name: 'Tiếp tục đặt sân', exact: true }).click();
      await page.getByLabel('Tên người đặt', { exact: true }).fill('Khách giữ thông tin');
      await page.getByLabel('Số điện thoại', { exact: true }).fill('0912345678');
      const create = page.getByRole('button', { name: 'Giữ chỗ 15 phút', exact: true });
      const before = bookingAttempts;
      await create.evaluate(button => { button.click(); button.click(); });
      const error = page.getByRole('region', { name: 'Thông tin đặt sân', exact: true }).getByRole('alert');
      await error.waitFor();
      assert.equal(bookingAttempts, before + 1, 'Duplicate clicks only send one create request');
      assert.equal(await page.getByLabel('Tên người đặt', { exact: true }).inputValue(), 'Khách giữ thông tin');
      await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'alert');
      assert(await error.evaluate(element => element === document.activeElement), 'Create error receives focus');
      if (bookingMode === 'rejected') {
        assert(await create.isEnabled(), 'Known rejection remains retryable');
        assert.equal(await page.getByRole('link', { name: 'Kiểm tra Đơn của tôi', exact: true }).count(), 0);
      } else {
        assert.match(await error.innerText(), /Đơn có thể đã được tạo/);
        assert.equal(await create.count(), 0, 'Unknown result never invites immediate resubmission');
        assert(await page.getByRole('button', { name: 'Chọn lại', exact: true }).isDisabled());
        const review = page.getByRole('link', { name: 'Kiểm tra Đơn của tôi', exact: true });
        assert.equal(await review.getAttribute('href'), '/don-cua-toi?filter=all');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (bookingMode === 'offline') await screenshot(`review-booking-unknown-${width}`);
        await review.click();
        await page.waitForURL('**/don-cua-toi?filter=all');
        await page.getByText('SANDEF567', { exact: true }).waitFor();
        assert.equal(bookingAttempts, before + 1, 'Reviewing existing bookings sends no second create request');
      }
    }
  }
  assert.deepEqual(errors, []);
  console.log('OK: populated tournaments, adaptive orders, cancellation safety/focus, owner confirmation context/cancellation/focus/duplicate-submit/recovery and booking review.');
} finally { await context.close(); await browser.close(); }
