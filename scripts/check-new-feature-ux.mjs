// Synthetic read fixtures; every attempted mutation is intercepted locally.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin = process.argv[2];
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = process.env.UX_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
const page = await context.newPage(), errors = [], writes = [];
page.on('pageerror', error => errors.push(error.message));
page.on('dialog', async dialog => { errors.push('Unexpected native confirmation: ' + dialog.type()); await dialog.dismiss(); });
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
async function actor(extra = {}) {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, exp, aud: 'authenticated', role: 'authenticated', fixture_role: 'admin', fixture_new_ux: 'populated', ...extra })}.fixture`;
  await context.clearCookies();
  await context.addCookies([{ name: 'sb-127-auth-token', url: origin, value: `base64-${b64({ access_token: token, refresh_token: 'fixture', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id } })}` }]);
}
let responseMode = 'refuse', release;
await page.route('**/api/**', async route => {
  const request = route.request();
  if (request.method() === 'GET') { await route.continue(); return; }
  writes.push({ url: request.url(), method: request.method(), body: request.postData() });
  if (responseMode === 'hold') await new Promise(resolve => { release = resolve; });
  if (responseMode === 'disconnect') { await route.abort('failed'); return; }
  if (responseMode === 'success') { await route.fulfill({ status: 204 }); return; }
  await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'Cần giữ hồ sơ để đối soát. Thông tin vẫn được giữ.' }) });
});
async function fit(label) {
  await page.evaluate(() => document.fonts.ready);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': no overflow');
}
async function shot(name, width) {
  if (output && [390, 1440].includes(width)) await page.screenshot({ path: `${output}/new-${name}-${width}.png`, fullPage: !(await page.getByRole('dialog').count()) });
}
const published = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeef';
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await actor();
    await page.goto(`${origin}/giai-dau/${published}?view=participants`);
    const participants = page.locator('#nguoi-tham-gia'), queue = page.getByRole('navigation', { name: 'Xử lý đăng ký' });
    await participants.getByRole('heading', { name: 'Người tham gia đã xác nhận' }).waitFor();
    assert.equal(await participants.locator('details').count(), 2, 'Default includes paid and approved free places only');
    assert.equal(await queue.getByRole('button', { name: 'Đã xác nhận tham gia 2', exact: true }).getAttribute('aria-pressed'), 'true');
    await queue.getByRole('button', { name: 'Chờ duyệt 1', exact: true }).click();
    await participants.getByRole('status').filter({ hasText: '1 / 1 đăng ký' }).waitFor();
    assert.equal(await participants.locator('details[open]').count(), 1, 'Pending review is directly visible');
    await queue.getByRole('button', { name: 'Chờ đóng cọc 1', exact: true }).click();
    assert.match(await participants.locator('summary').innerText(), /Nguyễn Linh/);
    await queue.getByRole('button', { name: 'Đã xác nhận tham gia 2', exact: true }).click();
    await participants.getByLabel('Tìm người hoặc đội').fill('do minh');
    assert.equal(await participants.locator('details').count(), 1, 'Vietnamese search works without accents');
    await participants.getByRole('status').filter({ hasText: '1 / 2 suất' }).waitFor();
    await participants.getByLabel('Tìm người hoặc đội').fill('Không có người này');
    await participants.getByText('Không có đăng ký khớp tìm kiếm.', { exact: true }).waitFor();
    await participants.getByRole('button', { name: 'Xóa tìm kiếm', exact: true }).last().click();
    assert.equal(await queue.getByRole('button', { name: 'Đã xác nhận tham gia 2', exact: true }).getAttribute('aria-pressed'), 'true');
    await fit('Participants'); await shot('participants', width);

    await page.goto(`${origin}/admin?view=venues`);
    const trigger = page.getByRole('button', { name: 'Xóa sân: Sân Cầu Giấy', exact: true }).filter({ visible: true });
    const before = writes.length;
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Xóa sân', exact: true });
    await dialog.getByRole('button', { name: 'Quay lại', exact: true }).waitFor();
    assert(await dialog.evaluate(element => element.parentElement === document.body), 'Dialogs are outside animated and clipped records');
    assert(await dialog.getByRole('button', { name: 'Quay lại', exact: true }).evaluate(button => button === document.activeElement), 'Safe action receives initial focus');
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    assert.equal(writes.length, before, 'Escape never deletes');
    assert(await trigger.evaluate(button => button === document.activeElement), 'Focus returns to trigger');
    await trigger.click(); await dialog.locator('[data-modal-panel]').evaluate(panel => Promise.all(panel.getAnimations().map(animation => animation.finished.catch(() => {})))); await fit('Delete dialog'); await shot('delete-venue', width);
    await dialog.getByRole('button', { name: 'Xác nhận xóa', exact: true }).click();
    await dialog.getByRole('alert').waitFor();
    assert.equal(writes.length, before + 1); assert.equal(writes.at(-1).method, 'DELETE');
    await dialog.getByRole('button', { name: 'Quay lại', exact: true }).click();
  }
  await actor({ fixture_new_ux: 'no-confirmed' });
  await page.goto(`${origin}/giai-dau/${published}?view=participants`);
  await page.getByRole('button', { name: 'Xem đăng ký chờ duyệt', exact: true }).click();
  await page.locator('#nguoi-tham-gia').getByText('Trần Hải', { exact: true }).waitFor();

  await actor(); await page.goto(`${origin}/admin/giai-dau`);
  await page.locator('summary:visible').first().click();
  const trigger = page.getByRole('button', { name: 'Xóa giải đấu', exact: true }).first();
  await trigger.click(); const dialog = page.getByRole('dialog', { name: 'Xóa giải đấu', exact: true });
  await dialog.waitFor();
  assert(await dialog.evaluate(element => element.parentElement === document.body), 'Tournament delete stays outside the hovered card');
  await dialog.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await trigger.click(); responseMode = 'hold'; const before = writes.length;
  await dialog.getByRole('button', { name: 'Xác nhận xóa', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[role=dialog] form[aria-busy=true]'));
  assert(await dialog.getByRole('button', { name: 'Quay lại', exact: true }).isDisabled());
  await page.keyboard.press('Escape'); assert(await dialog.isVisible(), 'Pending deletion cannot close');
  assert.equal(writes.length, before + 1, 'One request while pending');
  responseMode = 'refuse'; release(); await dialog.getByRole('alert').waitFor();
  assert.match(writes.at(-1).body, /"action":"delete"/);
  responseMode = 'disconnect'; await dialog.getByRole('button', { name: 'Xác nhận xóa', exact: true }).click();
  await dialog.getByRole('alert').filter({ hasText: 'Chưa xác nhận được kết quả xóa' }).waitFor();
  responseMode = 'success'; await dialog.getByRole('button', { name: 'Xác nhận xóa', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' }); await page.getByRole('status').filter({ hasText: 'Đã xóa giải đấu và trả lại lịch sân.' }).waitFor();

  await actor({ fixture_application: 'rejected' }); await page.goto(`${origin}/dang-ky-san?resubmit=1`);
  responseMode = 'refuse';
  const registrationWrites = writes.length;
  await page.getByRole('button', { name: /Tiếp theo/ }).click();
  await page.getByText('Sẽ dùng lại giấy tờ đã gửi:', { exact: false }).waitFor();
  assert.equal(writes.length, registrationWrites, 'Next step with saved documents never auto-submits an application');
  const file = page.locator('#business_license');
  await file.setInputFiles({ name: 'khong-hop-le.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
  await page.getByRole('alert').filter({ hasText: 'Giấy tờ đã gửi vẫn được giữ' }).waitFor();
  assert.equal(await file.evaluate(input => input.files.length), 0);
  await file.setInputFiles({ name: 'giay-to.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 fixture') });
  await page.getByText('giay-to.pdf', { exact: true }).waitFor();
  await file.setInputFiles({ name: 'qua-lon.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await page.getByRole('alert').filter({ hasText: 'Tệp hợp lệ trước đó vẫn được giữ' }).waitFor();
  assert.equal(await file.evaluate(input => input.files[0].name), 'giay-to.pdf');
  await page.getByRole('button', { name: 'Xóa giấy tờ đã chọn' }).click();
  await page.getByText('Sẽ dùng lại giấy tờ đã gửi:', { exact: false }).waitFor();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await fit('Resubmit'); await shot('resubmit', width);
  }
  assert.equal(writes.length, registrationWrites, 'File validation never uploads or submits');
  await page.getByRole('button', { name: /Tiếp tục: tài khoản nhận cọc/ }).click();
  await page.getByRole('alert').filter({ hasText: 'Cần giữ hồ sơ để đối soát' }).waitFor();
  assert.equal(writes.length, registrationWrites + 1);
  assert(writes.at(-1).body.includes('"reuse_document":true'));
  await page.goto(`${origin}/tim-san`);
  for (const district of ['Hòa Lạc', 'Thạch Thất']) assert.equal(await page.locator('#district option').filter({ hasText: district }).count(), 1);
  assert.deepEqual(errors, []);
  console.log('OK: new feature UX at five widths; queues, search/reset/counts, accessible deletion/focus/pending/failure/success, document validation/reuse and new district options. No live writes.');
} finally { await context.close(); await browser.close(); }
