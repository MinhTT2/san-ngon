// Start dashboard-fixture-server.mjs and a LOCAL app using its URL/key before running.
// No real auth, database writes or money transfers. All UI mutation requests are intercepted.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.argv[2] || 'http://localhost:3101';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = process.env.UX_SCREENSHOT_DIR || 'output/dashboard-ui';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const errors = [];
let writes = 0;
const ids = { admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', owner: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };
async function createContext(role) {
  const context = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ids[role], exp, aud: 'authenticated', role: 'authenticated', fixture_role: role })}.fixture`;
  const value = `base64-${b64({ access_token: token, refresh_token: 'fixture-only', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id: ids[role], email: 'fixture@example.invalid' } })}`;
  await context.addCookies([{ name: 'sb-127-auth-token', value, url: origin, sameSite: 'Lax' }]);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    if (route.request().method() !== 'GET') { writes++; return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Lỗi kiểm tra giả lập. Vui lòng thử lại.' }) }); }
    if (route.request().url().includes('/schedule')) {
      const date = new URL(route.request().url()).searchParams.get('date');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ schedule: { date, days: [{ date, free: 2, booked: 1, closed: 0 }], slots: [{ starts_at: `${date}T10:00:00+07:00`, ends_at: `${date}T11:00:00+07:00`, price: 100000, status: 'free' }], bookings: [], closures: [] } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  return { context, page };
}
const admin = await createContext('admin');
const owner = await createContext('owner');
async function checkRoutes(page, role, routes) {
  for (const [route, title, active] of routes) {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(origin + route);
      await page.getByRole('heading', { name: title, exact: true, level: 1 }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route}: page overflow at ${width}`);
      const nav = page.getByRole('navigation', { name: role === 'admin' ? 'Điều hướng admin' : 'Điều hướng chủ sân' });
      assert.equal(await nav.locator('[aria-current=page]').count(), 1, `${route}: one selected nav item`);
      if (width < 1024) {
        const frame = await nav.boundingBox(), selected = await nav.locator('[aria-current=page]').boundingBox();
        assert(selected.x >= frame.x && selected.x + selected.width <= frame.x + frame.width + 1, 'Active mobile navigation must be in view');
      }
      if (active) assert.equal(await nav.locator('[aria-current=page]').innerText(), active);
      if (output && [390, 1440].includes(width)) await page.screenshot({ path: `${output}/${role}-${route.replace(/[^a-z0-9]/gi, '-')}-${width}.png`, fullPage: true });
    }
    console.log(`OK: ${route} at 320/390/768/1024/1440px.`);
  }
}
try {
  if (process.env.DASHBOARD_TEST_ROLE !== 'owner') {
  await checkRoutes(admin.page, 'admin', [
    ['/admin', 'Tổng quan vận hành', 'Tổng quan'],
    ['/admin?view=owners', 'Hồ sơ chủ sân', 'Hồ sơ chủ sân'],
    ['/admin?view=venues', 'Hồ sơ cụm sân', 'Hồ sơ sân'],
    ['/admin?view=bookings', 'Đơn đặt sân', 'Đơn đặt sân'],
    ['/admin/users', 'Người dùng', 'Người dùng'],
    ['/admin/phi-dich-vu', 'Phí sử dụng của chủ sân', 'Phí chủ sân'],
    ['/admin/giai-dau', 'Duyệt giải đấu', 'Giải đấu'],
    ['/admin/gop-y', 'Góp ý từ người dùng', 'Góp ý người dùng'],
    [`/admin/owners/${ids.owner}`, 'Nguyễn Minh', 'Hồ sơ chủ sân'],
  ]);
  const page = admin.page;
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto(`${origin}/admin?view=owners`);
  const list = page.getByRole('region', { name: 'Danh sách hồ sơ chủ sân' });
  const detail = list.locator('details:visible').first();
  assert.equal(await detail.getAttribute('open'), null);
  await detail.locator('summary').focus(); await page.keyboard.press('Enter');
  assert.notEqual(await detail.getAttribute('open'), null);
  await page.keyboard.press('Enter');
  await list.getByRole('button', { name: 'Trang sau', exact: true }).click();
  assert(await list.getByText('21–25 / 25').count());
  await list.getByRole('searchbox').fill('Nguyễn Minh');
  assert(await list.getByText('1–1 / 1').count());
  await list.getByRole('combobox').selectOption('pending');
  await list.getByRole('status').filter({ hasText: 'Không có kết quả' }).waitFor();
  await list.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  assert(await list.getByText('1–20 / 25').count());
  await list.locator('button:visible').filter({ hasText: 'Duyệt chủ sân' }).first().click();
  await list.getByRole('alert').filter({ visible: true }).first().waitFor();
  console.log('OK: records search, status, reset, pagination and review error feedback.');

  await page.goto(`${origin}/admin/users`);
  const search = page.getByRole('searchbox', { name: 'Tìm người dùng', exact: true });
  await search.fill('Nguyễn');
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await page.waitForURL(url => url.searchParams.get('q') === 'Nguyễn');
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
  await page.waitForURL(`${origin}/admin/users`);
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const create = page.getByRole('button', { name: 'Tạo tài khoản', exact: true });
    await create.click();
    const dialog = page.getByRole('dialog', { name: 'Tạo tài khoản', exact: true });
    const name = dialog.getByLabel('Họ tên', { exact: true });
    await name.fill('Người dùng thử');
    assert(await name.evaluate(el => el === document.activeElement), 'Typing retains focus');
    assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), `Create modal overflow at ${width}`);
    await dialog.getByRole('button', { name: 'Hủy', exact: true }).focus();
    await page.keyboard.press('Tab');
    assert(await dialog.evaluate(el => el.contains(document.activeElement)), 'Modal traps focus');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert(await create.evaluate(el => el === document.activeElement), 'Modal restores focus');
    await page.getByRole('button', { name: 'Sửa', exact: true }).nth(1).click();
    const edit = page.getByRole('dialog', { name: 'Sửa tài khoản', exact: true });
    assert(await edit.evaluate(el => el.scrollWidth <= el.clientWidth), `Edit modal overflow at ${width}`);
    await edit.getByRole('button', { name: 'Lưu', exact: true }).click();
    await edit.getByRole('alert').waitFor();
    await page.keyboard.press('Escape');
  }
  const before = writes;
  await page.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true }).click();
  await page.getByRole('dialog', { name: 'Xóa tài khoản vĩnh viễn', exact: true }).waitFor();
  assert.equal(writes, before, 'Delete requires explicit confirmation');
  await page.keyboard.press('Escape');
  console.log('OK: user search, modal layout, focus trap/restoration, visible save error, deletion confirmation.');
  await page.goto(`${origin}/admin/phi-dich-vu`);
  await page.locator('button:visible').filter({ hasText: 'Bật thu phí 299.000đ/tháng' }).click();
  await page.getByText('Đơn cũ vẫn được xử lý.', { exact: false }).filter({ visible: true }).first().waitFor();
  await page.locator('button:visible').filter({ hasText: 'Quay lại' }).click();
  console.log('OK: fee toggle retains confirmation.');

  }
  await checkRoutes(owner.page, 'owner', [
    ['/chu-san', 'Sân Cầu Giấy', 'Tổng quan'],
    ['/chu-san/don', 'Đơn đặt sân', 'Đơn đặt sân'],
    ['/chu-san/lich', 'Lịch sân', 'Lịch sân'],
    ['/chu-san/quan-ly', 'Cụm sân và sân con', 'Quản lý sân'],
    ['/chu-san/giai-dau', 'Giải đấu tại sân', 'Giải đấu'],
    ['/chu-san/thanh-toan', 'Tài khoản nhận cọc', 'Tài khoản nhận cọc'],
    ['/chu-san/phi-dich-vu', 'Phí sử dụng website', 'Phí sử dụng website'],
  ]);
  assert.deepEqual(errors, [], 'Browser exceptions');
  console.log('OK: isolated fixtures only; no real account, booking or payment was changed.');
} finally { await admin.context.close(); await owner.context.close(); await browser.close(); }
