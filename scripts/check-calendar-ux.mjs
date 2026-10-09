// Local synthetic fixtures only. Every closure mutation is intercepted in Chromium.
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
const id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, exp, aud: 'authenticated', role: 'authenticated', fixture_role: 'owner' })}.fixture`;
await context.addCookies([{ name: 'sb-127-auth-token', url: origin, sameSite: 'Lax', value: `base64-${b64({ access_token: token, refresh_token: 'fixture-only', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id, email: 'fixture@example.invalid' } })}` }]);
page.on('pageerror', error => errors.push(error.message));
let readMode = 'slow', writeMode = 'offline', hasClosure = true;
const days = ['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'];
function schedule(date) {
  const empty = readMode === 'empty';
  return { date, days: days.map(date => ({ date, free: 8, booked: 2, closed: hasClosure ? 1 : 0 })),
    slots: empty ? [] : [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map(hour => ({ starts_at: `${date}T${String(hour).padStart(2, '0')}:00:00+07:00`, ends_at: `${date}T${String(hour + 1).padStart(2, '0')}:00:00+07:00`, price: 100000, status: hour === 8 ? 'confirmed' : hour === 10 ? 'pending' : hour === 12 && hasClosure ? 'closed' : 'free' })),
    bookings: empty ? [] : [8, 10].map(hour => ({ code: hour === 8 ? 'SANABC234' : 'SANDEF567', starts_at: `${date}T${hour === 8 ? '01' : '03'}:00:00Z`, ends_at: `${date}T${hour === 8 ? '02' : '04'}:00:00Z`, status: hour === 8 ? 'confirmed' : 'pending', customer_name: `${date}: ${hour === 8 ? 'Lê Hải' : 'Mai Anh'}`, customer_phone: '0901234567' })),
    closures: hasClosure ? [{ id: 'fixture-closure', starts_at: `${date}T12:00:00+07:00`, ends_at: `${date}T13:00:00+07:00`, reason: 'Bảo trì mặt sân' }] : [],
  };
}
await page.route('**/api/courts/*/schedule?*', async route => {
  const date = new URL(route.request().url()).searchParams.get('date');
  const mode = readMode;
  const data = schedule(date);
  if (mode === 'slow' || mode === 'race' && date === days[1]) await wait(800);
  if (mode === 'offline') return route.abort('failed');
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ schedule: data }) }).catch(() => {});
});
await page.route('**/api/courts/*/closures*', async route => {
  writes.push({ method: route.request().method(), body: route.request().postDataJSON() });
  await wait(150);
  if (writeMode === 'offline') return route.abort('failed');
  if (writeMode === 'error') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Khoảng giờ này đã có đơn đặt.' }) });
  hasClosure = route.request().method() === 'POST';
  return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
});
const calendar = page.locator('[data-court-calendar]');
const timeline = page.getByRole('region', { name: 'Lịch trong ngày', exact: true });
async function selectDate(date) { await page.getByLabel('Đến ngày', { exact: true }).fill(date); }
async function ready() { await timeline.locator('[aria-label*="xem đơn SANABC234"]').waitFor(); await page.waitForFunction(() => document.querySelector('[aria-label="Lịch trong ngày"]')?.getAttribute('aria-busy') === 'false'); }
async function capture(name) { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(450); if (output) await page.screenshot({ path: `${output}/${name}.png`, fullPage: true }); }
try {
  await page.goto(`${origin}/chu-san/lich`);
  await timeline.getByRole('status').waitFor();
  assert.equal(await calendar.getByText('Ngày này không có khung hoạt động.', { exact: true }).count(), 0, 'Loading must not look like an empty day');
  assert(await calendar.getByRole('button', { name: 'Khóa lịch', exact: true }).isDisabled());
  readMode = 'success';
  await ready();
  await selectDate(days[0]); await ready();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Calendar overflow at ${width}`);
    if ([390, 1440].includes(width)) await capture(`review-calendar-${width}`);
    const booked = timeline.getByRole('button', { name: /08:00–09:00.*xem đơn SANABC234/ });
    await booked.click();
    const detail = page.getByRole('dialog', { name: 'Đơn SANABC234', exact: true });
    assert.equal(await detail.getByRole('link', { name: '0901234567' }).getAttribute('href'), 'tel:0901234567');
    assert(await detail.evaluate(element => element.scrollWidth <= element.clientWidth));
    if (width === 1440) await capture('review-calendar-booking-1440');
    await page.keyboard.press('Escape');
    await detail.waitFor({ state: 'detached' });
    assert(await booked.evaluate(element => document.activeElement === element));
  }

  readMode = 'race';
  await selectDate(days[1]);
  await timeline.getByRole('status').waitFor();
  assert.equal(await timeline.getByRole('button', { name: /xem đơn/ }).count(), 0, 'Old slots disappear as soon as another date is selected');
  await selectDate(days[2]); await ready();
  await page.waitForTimeout(950);
  assert.equal(await page.getByLabel('Đến ngày', { exact: true }).inputValue(), days[2]);
  await calendar.getByText(`${days[2]}: Lê Hải`, { exact: false }).waitFor();
  assert.equal(await calendar.getByText(`${days[1]}: Lê Hải`, { exact: false }).count(), 0, 'Late response cannot replace the selected date');

  readMode = 'offline';
  await selectDate(days[3]);
  await timeline.getByRole('alert').waitFor();
  assert.equal(await calendar.getByText('Ngày này không có khung hoạt động.', { exact: true }).count(), 0, 'Failed requests must not look like empty data');
  assert.equal(await calendar.getByText('Chưa có đơn nào trong ngày này.', { exact: true }).count(), 0);
  assert(await calendar.getByRole('button', { name: 'Khóa lịch', exact: true }).isDisabled());
  readMode = 'success';
  await timeline.getByRole('button', { name: 'Thử lại', exact: true }).click(); await ready();
  readMode = 'offline';
  await timeline.getByRole('button', { name: 'Tải lại lịch', exact: true }).click();
  await timeline.getByRole('alert').filter({ hasText: 'Đang hiển thị lịch lần tải trước' }).waitFor();
  assert(await calendar.getByRole('button', { name: 'Mở lại', exact: true }).isDisabled());
  readMode = 'success';
  await timeline.getByRole('button', { name: 'Thử lại', exact: true }).click(); await ready();

  const closeButton = calendar.getByRole('button', { name: 'Khóa lịch', exact: true });
  await closeButton.click();
  const closeDialog = page.getByRole('dialog', { name: 'Khóa lịch', exact: true });
  await closeDialog.getByLabel('Chỉ khóa một khoảng giờ').check();
  await closeDialog.getByLabel('Từ', { exact: true }).fill('14:00');
  await closeDialog.getByLabel('Đến', { exact: true }).fill('15:00');
  await closeDialog.getByLabel('Lý do (không bắt buộc)').fill('Bảo trì mặt sân');
  const submit = closeDialog.getByRole('button', { name: 'Khóa khoảng giờ', exact: true });
  await submit.evaluate(element => { element.click(); element.click(); });
  await closeDialog.getByRole('alert').waitFor();
  assert.equal(writes.length, 1, 'Duplicate closures are prevented');
  assert.equal(await closeDialog.getByLabel('Từ', { exact: true }).inputValue(), '14:00');
  assert(await submit.isEnabled(), 'Network failure releases the busy state');
  writeMode = 'error'; await submit.click();
  await closeDialog.getByRole('alert').filter({ hasText: 'Khoảng giờ này đã có đơn đặt.' }).waitFor();
  assert.equal(await closeDialog.getByLabel('Lý do (không bắt buộc)').inputValue(), 'Bảo trì mặt sân');
  await capture('review-calendar-error-1440');
  writeMode = 'success'; await submit.click();
  await closeDialog.waitFor({ state: 'detached' });
  await calendar.getByRole('status').filter({ hasText: 'Đã khóa lịch.' }).waitFor();
  assert.deepEqual(writes.at(-1).body, { date: days[3], start_time: '14:00', end_time: '15:00', reason: 'Bảo trì mặt sân' });
  await ready();
  writeMode = 'offline'; await calendar.getByRole('button', { name: 'Mở lại', exact: true }).click();
  await calendar.getByRole('alert').waitFor();
  assert(await calendar.getByRole('button', { name: 'Mở lại', exact: true }).isEnabled());
  writeMode = 'success'; await calendar.getByRole('button', { name: 'Mở lại', exact: true }).click();
  await calendar.getByRole('status').filter({ hasText: 'Đã mở lại khoảng giờ.' }).waitFor();
  assert.equal(writes.at(-1).method, 'DELETE');
  readMode = 'empty'; await selectDate(days[4]);
  await calendar.getByText('Ngày này không có khung hoạt động.', { exact: true }).waitFor();
  await calendar.getByText('Chưa có đơn nào trong ngày này.', { exact: true }).waitFor();

  await page.goto(`${origin}/tai-khoan`);
  const trigger = page.getByRole('button', { name: /^Menu tài khoản:/ });
  await trigger.focus(); await page.keyboard.press('ArrowDown');
  const menu = page.getByRole('menu', { name: 'Tài khoản', exact: true });
  await menu.waitFor();
  const items = menu.getByRole('menuitem');
  assert(await items.first().evaluate(element => document.activeElement === element));
  await page.keyboard.press('ArrowUp');
  assert(await items.last().evaluate(element => document.activeElement === element));
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  assert(await items.nth(1).evaluate(element => document.activeElement === element));
  await page.keyboard.press('End');
  assert(await items.last().evaluate(element => document.activeElement === element));
  await page.keyboard.press('Escape'); await menu.waitFor({ state: 'detached' });
  assert(await trigger.evaluate(element => document.activeElement === element));
  await page.keyboard.press('ArrowUp'); await menu.waitFor();
  assert(await items.last().evaluate(element => document.activeElement === element));
  await page.keyboard.press('Shift+Tab'); await menu.waitFor({ state: 'detached' });
  assert(await trigger.evaluate(element => document.activeElement === element));
  await trigger.click(); await menu.waitFor(); await page.keyboard.press('Tab');
  await menu.waitFor({ state: 'detached' });
  assert(await page.evaluate(() => document.activeElement !== document.body), 'Tab exits the menu with a visible focus target');
  assert.deepEqual(errors, []);
  console.log('OK: calendar at 320/390/768/1440px, loading/empty/error, out-of-order days, stale actions, booking detail/focus, close/reopen network recovery and keyboard menu. All mutations intercepted.');
} finally { await context.close(); await browser.close(); }
