// Isolated localhost fixtures. Read/profile requests are intercepted, never sent to the database.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { setTimeout as wait } from 'node:timers/promises';
import { chromium } from 'playwright';
const origin = process.argv[2];
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = process.env.UX_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
const page = await context.newPage();
const errors = [], writes = [];
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const exp = Math.floor(Date.now() / 1000) + 3600;
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, exp, aud: 'authenticated', role: 'authenticated', fixture_role: 'admin' })}.fixture`;
await context.addCookies([{ name: 'sb-127-auth-token', url: origin, sameSite: 'Lax', value: `base64-${b64({ access_token: token, refresh_token: 'fixture-only', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id, email: 'fixture@example.invalid' } })}` }]);
page.on('pageerror', error => errors.push(error.message));
let mode = 'offline';
await page.route('**/api/notifications/*/read', async route => {
  assert.equal(route.request().method(), 'POST');
  writes.push({ type: 'read', url: route.request().url() });
  await wait(150);
  if (mode === 'offline') return route.abort('failed');
  if (mode === 'expired') return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Bạn cần đăng nhập."}' });
  return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
});
await page.route('**/api/profile', async route => {
  assert.equal(route.request().method(), 'PATCH');
  writes.push({ type: 'profile', body: route.request().postDataJSON() });
  await wait(150);
  if (mode === 'offline') return route.abort('failed');
  return route.fulfill({ status: mode === 'error' ? 400 : 200, contentType: 'application/json', body: JSON.stringify(mode === 'error' ? { error: 'Số điện thoại chưa hợp lệ.' } : { profile: { full_name: 'Minh trên sân', phone: '0912345678' } }) });
});
async function screenshot(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(650);
  if (output) await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}
try {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${origin}/thong-bao`);
    await page.getByRole('heading', { name: 'Thông báo', exact: true }).waitFor();
    await page.locator('.pf-tab-rail[data-marker-ready="true"]').waitFor();
    assert.equal(await page.locator('[data-notification-id]').count(), 3);
    assert.equal(await page.getByRole('region', { name: /Thông báo ngày/ }).count(), 2);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if ([390, 1440].includes(width)) await screenshot(`review-notifications-${width}`);
  }
  const card = page.locator('[data-notification-id]').first();
  const read = card.getByRole('button', { name: /Đánh dấu đã đọc:/ });
  await read.click();
  await read.evaluate(button => button.click());
  await card.getByRole('alert').waitFor();
  assert.equal(writes.length, 1, 'Busy read blocks duplicate requests');
  assert(await read.isEnabled());
  mode = 'success';
  await read.click();
  await card.locator('[data-read-state="done"]').waitFor();
  assert.equal(writes.length, 2);
  await page.getByRole('navigation', { name: 'Lọc thông báo' }).getByRole('link', { name: /Chưa đọc/ }).click();
  await page.waitForURL('**status=unread**');
  await page.waitForTimeout(450);
  assert.equal(await page.locator('[data-notification-id]').count(), 2);
  const bell = page.getByRole('button', { name: 'Thông báo, 2 chưa đọc', exact: true });
  await bell.click();
  const popover = page.locator('[popover]:popover-open');
  await popover.waitFor();
  mode = 'offline';
  await popover.getByRole('button', { name: /Đánh dấu đã đọc:/ }).first().click();
  await popover.getByRole('alert').waitFor();
  assert(await popover.getByRole('button', { name: /Đánh dấu đã đọc:/ }).first().isEnabled());
  await page.keyboard.press('Escape');
  assert(await bell.evaluate(element => element === document.activeElement), await page.evaluate(() => `Focus after Escape: ${document.activeElement?.outerHTML}`));
  mode = 'expired';
  const unreadCard = page.locator('[data-notification-id]').last();
  await unreadCard.getByRole('button', { name: /Đánh dấu đã đọc:/ }).click();
  await unreadCard.getByRole('alert').filter({ hasText: 'Phiên đăng nhập đã hết.' }).waitFor();
  const login = unreadCard.getByRole('link', { name: 'Đăng nhập lại', exact: true });
  const returnURL = new URL(await login.getAttribute('href'), origin);
  assert.equal(returnURL.pathname, '/dang-nhap');
  assert.equal(returnURL.searchParams.get('next'), new URL(page.url()).pathname + new URL(page.url()).search);

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${origin}/tai-khoan`);
    await page.getByRole('heading', { name: 'Thông tin cá nhân', exact: true }).waitFor();
    assert(await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).isDisabled());
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if ([390, 1440].includes(width)) await screenshot(`review-profile-${width}`);
  }
  const name = page.getByLabel('Họ và tên', { exact: true });
  const phone = page.getByLabel('Số điện thoại', { exact: true });
  await name.fill('Minh chưa lưu');
  assert(await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).isEnabled());
  await page.getByRole('button', { name: 'Bỏ thay đổi', exact: true }).click();
  assert.equal(await name.inputValue(), 'Quản trị viên kiểm tra');
  assert(await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).isDisabled());
  await phone.fill('+84 901 234 567');
  await name.focus();
  assert.equal(await phone.inputValue(), '0901234567');
  assert(await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).isDisabled(), 'Phone formatting alone is not a change');
  await name.fill('Minh trên sân');
  await phone.fill('+84 912 345 678');
  mode = 'error';
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Số điện thoại chưa hợp lệ.' }).waitFor();
  assert.equal(await name.inputValue(), 'Minh trên sân');
  assert(await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).isEnabled());
  mode = 'offline';
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Không kết nối được.' }).waitFor();
  assert.equal(await name.inputValue(), 'Minh trên sân');
  mode = 'success';
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Đã lưu thông tin tài khoản.' }).waitFor();
  assert(await page.getByRole('button', { name: 'Đã lưu', exact: true }).isDisabled());
  assert.equal(await phone.inputValue(), '0912345678');
  await name.fill('Sửa sau khi lưu');
  await page.getByRole('button', { name: 'Bỏ thay đổi', exact: true }).click();
  assert.equal(await name.inputValue(), 'Minh trên sân', 'Discard returns to the last successfully saved value');
  assert.equal(writes.filter(write => write.type === 'profile').length, 3);
  assert.deepEqual(writes.at(-1).body, { full_name: 'Minh trên sân', phone: '0912345678' });

  const noJS = await browser.newContext({ javaScriptEnabled: false, storageState: await context.storageState() });
  const staticPage = await noJS.newPage();
  await staticPage.goto(`${origin}/thong-bao?status=unread&page=1`);
  const form = staticPage.locator('main form').first();
  assert.equal(await form.getAttribute('method'), 'post');
  assert.match(await form.getAttribute('action'), /\/api\/notifications\/.*\/read$/);
  assert.equal(await form.locator('input[name=status]').inputValue(), 'unread');
  assert.equal(await form.locator('input[name=page]').inputValue(), '1');
  assert(await form.getByRole('button', { name: /Đánh dấu đã đọc:/ }).isEnabled());
  await noJS.close();
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('OK: grouped inbox, read recovery/duplicate prevention, popover keyboard, no-JS forms, profile dirty/discard/normalization/save recovery at 320/390/768/1440px. Intercepted requests only.');
} finally { await context.close(); await browser.close(); }
