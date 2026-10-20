// Isolated headless Chromium, synthetic auth and provider fixtures only.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin = process.argv[2], mode = process.argv[3] ?? 'configured';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Ho_Chi_Minh', serviceWorkers: 'block' });
await context.route(/https:\/\/[^/]*(google-analytics|googletagmanager)\.com\//, route => route.abort('blockedbyclient'));
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
async function signIn(role) {
  await context.clearCookies();
  const id = role === 'admin' ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' : 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const access = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, exp, aud: 'authenticated', role: 'authenticated', fixture_role: role })}.fixture`;
  await context.addCookies([{ name: 'sb-127-auth-token', value: `base64-${b64({ access_token: access, refresh_token: 'fixture-only', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id } })}`, url: origin, sameSite: 'Lax' }]);
}
try {
  await page.goto(`${origin}/admin/thong-ke-truy-cap`);
  assert.equal(new URL(page.url()).pathname, '/dang-nhap');
  await signIn('owner'); await page.goto(`${origin}/admin/thong-ke-truy-cap`);
  assert.equal(new URL(page.url()).pathname, '/');
  await signIn('admin'); await page.goto(`${origin}/admin/thong-ke-truy-cap`);
  await page.getByRole('heading', { name: 'Thống kê truy cập', exact: true }).waitFor();
  if (['unconfigured', 'permission', 'quota'].includes(mode)) {
    assert(await page.getByRole('heading', { name: mode === 'unconfigured' ? 'Chưa kết nối báo cáo Google Analytics' : 'Chưa tải được báo cáo truy cập', exact: true }).isVisible());
    assert.equal(await page.getByRole('heading', { name: 'Người dùng hoạt động', exact: true }).count(), 0);
  } else {
    for (const title of ['Tỷ lệ thoát', 'Người dùng mới', 'Trang vào đầu tiên', 'Quốc gia', 'Giờ truy cập', 'Trình duyệt', 'Khám phá sân', 'Việc nên làm từ số liệu']) assert(await page.getByRole('heading', { name: title, exact: true }).isVisible(), title);
    assert(!(await page.locator('main').innerText()).includes('SANABC234'));
    assert(!(await page.locator('main').innerText()).includes('never-display'));
    if (mode === 'partial') assert(await page.getByText(/Một số bảng chưa tải được/).isVisible());
    if (mode === 'empty') assert(await page.getByText('Chưa có lượt xem trong kỳ.', { exact: true }).isVisible());
    if (mode === 'thresholded') assert(await page.getByText(/Google có áp dụng ngưỡng dữ liệu/).isVisible());
    if (mode === 'realtime-failed') assert(await page.getByText(/Chưa đọc được báo cáo thời gian thực/).isVisible());
    if (mode === 'configured') {
      for (const days of [7, 90]) { await page.getByRole('link', { name: `${days} ngày`, exact: true }).click(); await page.waitForURL(url => url.searchParams.get('period') === String(days)); assert(await page.getByText(new RegExp(`So với ${days} ngày liền trước`)).isVisible()); }
      await page.getByText('Xem số liệu từng ngày', { exact: true }).click();
      assert(await page.getByRole('table').isVisible());
      await mkdir('output/traffic', { recursive: true });
      for (const width of [1440, 1024, 768, 390, 360]) {
        await page.setViewportSize({ width, height: 1000 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`);
        if ([1440, 390].includes(width)) await page.screenshot({ path: `output/traffic/report-${width}.png`, fullPage: true });
      }
    }
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: traffic ${mode}, guest/owner/admin access, report state and responsive layout.`);
} finally { await context.close(); await browser.close(); }
