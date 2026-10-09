// Isolated, read-only fixtures: SSR failures, section isolation and refresh recovery.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.argv[2];
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const screenshotDir = process.env.UX_SCREENSHOT_DIR;
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
const cases = [
  ['owner', '/chu-san', 'bookings', 'Chưa tải được lịch đặt sân', ['Hôm nay chưa có đơn nào.', 'Trống'], 'Theo dõi doanh thu'],
  ['owner', '/chu-san', 'refunds', 'Chưa tải được danh sách cần hoàn cọc', [], 'Đơn hôm nay'],
  ['owner', '/chu-san', 'get_owner_period_stats', 'Chưa tải được thống kê', ['Công suất sân'], 'Đơn hôm nay'],
  ['owner', '/chu-san', 'telegram', 'Chưa tải được kết nối Telegram', ['Kết nối Telegram'], 'Đơn hôm nay'],
  ['admin', '/admin', 'get_admin_stats', 'Chưa tải được thống kê giao dịch', ['Doanh thu theo ngày'], 'Hồ sơ cần xử lý'],
  ['admin', '/admin?view=owners', 'profiles', 'Chưa tải được hồ sơ sân và tài khoản', ['Không có hồ sơ'], 'Hồ sơ chủ sân'],
  ['admin', '/admin?view=bookings', 'bookings', 'Chưa tải được danh sách đơn đặt sân', ['Không có đơn'], 'Đơn đặt sân'],
  ['admin', '/admin?view=users', 'profiles', 'Chưa tải được danh sách tài khoản', ['Chưa có tài khoản'], 'Tài khoản gần đây'],
  ['owner', '/', 'home-count', 'Chưa tải được số liệu sân', ['sân cho bạn lựa chọn'], 'Tìm sân trống.'],
  ['owner', '/', 'featured', 'Chưa tải được lịch sân', ['Cách đọc lịch sân', 'Minh họa'], 'Tìm sân trống.'],
  ['owner', '/', 'get_venue_availability', 'Chưa tải được lịch sân', ['Cách đọc lịch sân', 'Minh họa'], 'Tìm sân trống.'],
];
const ids = { admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', owner: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };
async function session(context, role, failure) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ids[role], exp, aud: 'authenticated', role: 'authenticated', fixture_role: role, fixture_read_failure: failure })}.fixture`;
  const value = `base64-${b64({ access_token: token, refresh_token: 'fixture-only', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id: ids[role], email: 'fixture@example.invalid' } })}`;
  await context.addCookies([{ name: 'sb-127-auth-token', value, url: origin, sameSite: 'Lax' }]);
}
try {
  for (const width of [390, 1440]) for (const [role, path, failure, title, absent, retained] of cases) {
    const context = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', viewport: { width, height: 1000 } });
    try {
      await session(context, role, failure);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin + path);
      const alert = page.getByRole('alert').filter({ hasText: title });
      await alert.waitFor();
      for (const text of absent) assert.equal(await page.getByText(text, { exact: true }).count(), 0, `${failure}: no false empty/default content`);
      assert((await page.getByText(retained, { exact: false }).count()) > 0, `${failure}: successful content retained`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${failure}: no overflow at ${width}`);
      if (screenshotDir && ['bookings', 'refunds', 'home-count'].includes(failure)) await page.screenshot({ path: `${screenshotDir}/query-error-${role}-${failure}-${width}.png`, fullPage: true });
      await session(context, role, '');
      await alert.getByRole('button', { name: 'Thử lại', exact: true }).click();
      await alert.waitFor({ state: 'detached' });
      assert.deepEqual(errors, [], 'No browser exceptions');
      console.log(`OK ${role} ${failure} ${width}px: visible failure, retained content, recovery.`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
