// Isolated browser fixtures; every storage/API/RPC mutation is intercepted.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.argv[2] || 'http://127.0.0.1:3101';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = process.env.UX_SCREENSHOT_DIR || 'output/owner-forms';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const owner = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const court = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const venue = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const errors = [];
const bytes = await readFile('public/media/badminton-editorial.webp');
const photo = name => ({ name, mimeType: 'image/webp', buffer: bytes });
const json = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
async function session(connection = 'ready') {
  const context = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', viewport: { width: 1440, height: 1000 } });
  const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: owner, exp, aud: 'authenticated', role: 'authenticated', fixture_role: 'owner', fixture_connection: connection })}.fixture`;
  const value = `base64-${b64({ access_token: token, refresh_token: 'fixture-only', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id: owner, email: 'fixture@example.invalid' } })}`;
  await context.addCookies([{ name: 'sb-127-auth-token', value, url: origin, sameSite: 'Lax' }]);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => json(route, { error: 'Lỗi kiểm thử. Nội dung được giữ để thử lại.', fieldErrors: { phone: 'Số điện thoại chưa hợp lệ.' } }, 400));
  await page.route('**/storage/**', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : json(route, { message: 'Unmocked storage write rejected' }, 403));
  await page.route('**/rest/v1/rpc/**', route => json(route, { message: 'Unmocked browser RPC rejected' }, 403));
  return { context, page };
}
async function shot(page, name) {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => document.fonts.ready);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: overflow at ${width}`);
    await page.screenshot({ path: `${output}/review-${name}-${width}.png`, fullPage: true });
  }
}
async function rejectDialog(page, action) {
  const dialog = page.waitForEvent('dialog');
  const running = action();
  const confirmation = await dialog;
  assert.equal(confirmation.type(), 'confirm');
  assert.match(confirmation.message(), /chưa lưu/);
  await confirmation.dismiss(); await running;
}
try {
  const { context, page } = await session();
  await page.goto(`${origin}/chu-san/bang-gia/${court}`);
  await page.getByRole('button', { name: 'Thêm mức giá', exact: true }).click();
  await page.getByLabel('Tên mức giá', { exact: true }).fill('Cuối tuần buổi tối');
  await page.getByLabel('Giá mỗi giờ (đ)', { exact: true }).fill('175000');
  await rejectDialog(page, () => page.getByRole('button', { name: 'Hủy chỉnh sửa' }).click());
  assert.equal(await page.getByLabel('Tên mức giá', { exact: true }).inputValue(), 'Cuối tuần buổi tối');
  await rejectDialog(page, () => page.getByRole('button', { name: 'Thêm mức giá', exact: true }).click());
  await rejectDialog(page, () => page.getByRole('link', { name: '← Quản lý sân', exact: true }).click());
  assert(page.url().includes('/bang-gia/'));
  assert(await page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true }))), 'Dirty form prevents unload');
  await page.getByRole('button', { name: 'Lưu mức giá', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Lỗi kiểm thử' }).waitFor();
  assert.equal(await page.getByLabel('Giá mỗi giờ (đ)', { exact: true }).inputValue(), '175000');
  await shot(page, 'price-unsaved');
  await page.route('**/api/courts/*/prices', route => json(route, { rule: { ...route.request().postDataJSON(), id: 'saved-price' } }));
  await page.getByRole('button', { name: 'Lưu mức giá', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Đã lưu' }).waitFor();
  assert.equal(await page.getByLabel('Tên mức giá', { exact: true }).count(), 0);
  assert(await page.evaluate(() => window.dispatchEvent(new Event('beforeunload', { cancelable: true }))), 'Saved form allows unload');
  await page.getByRole('link', { name: '← Quản lý sân', exact: true }).click();
  await page.waitForURL('**/chu-san/quan-ly');
  const create = page.getByRole('button', { name: '+ Tạo cụm sân', exact: true });
  await create.click();
  let modal = page.getByRole('dialog', { name: 'Tạo cụm sân mới', exact: true });
  await modal.getByLabel('Tên cụm sân', { exact: true }).fill('Cụm sân thử');
  await rejectDialog(page, () => page.keyboard.press('Escape'));
  await modal.waitFor();
  await rejectDialog(page, () => modal.getByRole('button', { name: 'Đóng', exact: true }).click());
  const accept = page.waitForEvent('dialog');
  const close = modal.getByRole('button', { name: 'Đóng', exact: true }).click();
  await (await accept).accept(); await close;
  await modal.waitFor({ state: 'detached' });
  assert(await create.evaluate(element => element === document.activeElement), 'Modal restores focus');
  await page.getByRole('button', { name: 'Sửa cụm sân', exact: true }).click();
  modal = page.getByRole('dialog', { name: 'Sửa cụm sân', exact: true });
  await modal.getByLabel('Tên cụm sân', { exact: true }).fill('Tên cụm chưa lưu');
  await rejectDialog(page, () => modal.getByRole('button', { name: 'Hủy', exact: true }).click());
  await rejectDialog(page, () => page.keyboard.press('Escape'));
  const dismiss = page.waitForEvent('dialog'); const escape = page.keyboard.press('Escape');
  await (await dismiss).accept(); await escape;
  await modal.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '+ Thêm sân', exact: true }).click();
  modal = page.getByRole('dialog', { name: 'Thêm sân con', exact: true });
  await modal.getByLabel(/^Tên sân/).fill('Sân thử giữ nội dung');
  await page.route('**/api/courts', route => json(route, { error: 'Lỗi kiểm thử', fieldErrors: { name: 'Tên sân chưa hợp lệ.' } }, 400));
  await modal.getByRole('button', { name: 'Lưu và thêm tiếp', exact: true }).click();
  await modal.locator('[data-owner-save-error]').waitFor();
  assert.equal(await modal.getByLabel(/^Tên sân/).inputValue(), 'Sân thử giữ nội dung');
  await rejectDialog(page, () => modal.getByRole('button', { name: 'Hủy', exact: true }).click());
  const courtClose = page.waitForEvent('dialog'); const courtEscape = page.keyboard.press('Escape');
  await (await courtClose).accept(); await courtEscape;
  await modal.waitFor({ state: 'detached' });
  console.log('OK: unsaved price/create/edit forms preserve values on cancelled discard; successful save clears the guard.');

  // Generic server errors used to be rendered behind the editing dialog.
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole('button', { name: 'Sửa cụm sân', exact: true }).click();
    modal = page.getByRole('dialog', { name: 'Sửa cụm sân', exact: true });
    assert.equal(await modal.locator('[data-owner-save-error]').count(), 0, 'A new editor does not inherit old errors');
    await modal.getByLabel('Tên cụm sân', { exact: true }).fill('Tên cụm giữ sau lỗi');
    await modal.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    const feedback = modal.locator('[data-owner-save-error]');
    await feedback.waitFor();
    assert(await feedback.isVisible(), 'The save error is inside the visible dialog');
    assert(await feedback.evaluate(element => element === document.activeElement), 'Save error receives focus');
    assert.equal(await modal.getByLabel('Tên cụm sân', { exact: true }).inputValue(), 'Tên cụm giữ sau lỗi');
    assert.match(await modal.getByRole('alert').filter({ hasText: 'Số điện thoại chưa hợp lệ.' }).innerText(), /Số điện thoại/);
    await modal.getByLabel('Tên cụm sân', { exact: true }).focus();
    await modal.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await feedback.waitFor();
    await page.waitForTimeout(100);
    assert(await feedback.evaluate(element => element === document.activeElement), 'Repeated errors receive focus again');
    const discard = page.waitForEvent('dialog');
    const close = modal.getByRole('button', { name: 'Hủy', exact: true }).click();
    await (await discard).accept(); await close;
    await modal.waitFor({ state: 'detached' });

    await page.route('**/api/courts/*', route => json(route, { error: 'Không lưu được sân. Thử lại.' }, 503));
    const editCourt = page.getByRole('button', { name: /^(Sửa|Đổi tên \/ sửa)$/, exact: true });
    await editCourt.click();
    modal = page.getByRole('dialog', { name: 'Sửa sân con', exact: true });
    assert.equal(await modal.locator('[data-owner-save-error]').count(), 0);
    await modal.getByLabel(/^Tên sân/).fill('Tên sân giữ sau lỗi');
    await modal.getByRole('button', { name: 'Lưu sân', exact: true }).click();
    const courtFeedback = modal.locator('[data-owner-save-error]');
    await courtFeedback.waitFor();
    assert(await courtFeedback.evaluate(element => element === document.activeElement));
    assert.equal(await modal.getByLabel(/^Tên sân/).inputValue(), 'Tên sân giữ sau lỗi');
    assert.equal(await modal.getByRole('alert').count(), 1, 'Generic errors are visible without field errors');
    await shot(page, 'court-save-error');
    const discardCourt = page.waitForEvent('dialog');
    const closeCourt = modal.getByRole('button', { name: 'Hủy', exact: true }).click();
    await (await discardCourt).accept(); await closeCourt;
    await modal.waitFor({ state: 'detached' });
  }
  console.log('OK: venue/court generic and field errors stay inside the modal, retain values and restore focus on repeated failures.');


  // Court status is a saved change, never an immediate toggle or deletion.
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    let statusWrites = 0;
    await page.route(`**/api/courts/${court}`, route => {
      assert.equal(route.request().method(), 'PATCH');
      statusWrites++;
      return json(route, { error: 'Không thể đổi môn, giờ hoặc tắt sân khi đang có đơn trong tương lai.' }, 400);
    });
    await page.getByRole('button', { name: /^(Sửa|Đổi tên \/ sửa)$/, exact: true }).click();
    modal = page.getByRole('dialog', { name: 'Sửa sân con', exact: true });
    const status = modal.getByLabel('Trạng thái nhận đặt', { exact: true });
    assert.equal(await status.inputValue(), 'active');
    await status.selectOption('inactive');
    assert.equal(statusWrites, 0, 'Choosing status does not mutate until saved');
    await modal.getByRole('button', { name: 'Lưu sân', exact: true }).click();
    await modal.locator('[data-owner-save-error]').waitFor();
    assert.equal(await status.inputValue(), 'inactive', 'Rejected change retains the selected status');
    await page.getByText('Đang mở', { exact: true }).waitFor();
    assert.equal(await page.getByText('Đang tắt', { exact: true }).count(), 0, 'Rejected change does not change saved status');
    await rejectDialog(page, () => modal.getByRole('button', { name: 'Hủy', exact: true }).click());
    await shot(page, 'court-status-rejected');
    const discardStatus = page.waitForEvent('dialog');
    const closeStatus = modal.getByRole('button', { name: 'Hủy', exact: true }).click();
    await (await discardStatus).accept(); await closeStatus;
    await modal.waitFor({ state: 'detached' });
    await page.setViewportSize({ width, height: 1000 });

    const savedStates = [];
    await page.route(`**/api/courts/${court}`, route => {
      assert.equal(route.request().method(), 'PATCH');
      const draft = route.request().postDataJSON();
      savedStates.push(draft.is_active);
      return json(route, { court: { ...draft, id: court } });
    });
    for (const target of ['inactive', 'active']) {
      await page.getByRole('button', { name: /^(Sửa|Đổi tên \/ sửa)$/, exact: true }).click();
      modal = page.getByRole('dialog', { name: 'Sửa sân con', exact: true });
      assert.equal(await modal.getByLabel('Trạng thái nhận đặt', { exact: true }).inputValue(), target === 'inactive' ? 'active' : 'inactive');
      await modal.getByLabel('Trạng thái nhận đặt', { exact: true }).selectOption(target);
      await modal.getByRole('button', { name: 'Lưu sân', exact: true }).click();
      await modal.waitFor({ state: 'detached' });
      await page.getByText(target === 'active' ? 'Đang mở' : 'Đang tắt', { exact: true }).waitFor();
      assert(await page.evaluate(() => window.dispatchEvent(new Event('beforeunload', { cancelable: true }))), 'Successful status save clears unsaved guard');
    }
    assert.deepEqual(savedStates, [false, true]);
  }
  console.log('OK: court off/on saves through PATCH; rejected status retains draft and saved badge, and successful changes clear the guard.');

  let created = 0, uploads = 0, publications = 0;
  const uploadedPaths = [];
  await page.route('**/api/venues', route => { created++; return json(route, { venue: { id: venue } }); });
  await page.route('**/storage/v1/object/venue-photos/**', route => {
    if (route.request().method() !== 'POST') return route.continue();
    uploads++;
    if (uploads === 2) return json(route, { message: 'Upload interrupted' }, 503);
    uploadedPaths.push(decodeURIComponent(new URL(route.request().url()).pathname.split('/venue-photos/')[1]));
    return json(route, { Key: 'fixture-upload', Id: 'fixture-upload' });
  });
  await page.route('**/rest/v1/rpc/set_venue_images', route => {
    publications++;
    const data = route.request().postDataJSON();
    assert.equal(data.p_images.length, 3); assert.deepEqual(data.p_expected, []);
    return json(route, null);
  });
  await create.click();
  modal = page.getByRole('dialog', { name: 'Tạo cụm sân mới', exact: true });
  await modal.getByLabel('Tên cụm sân', { exact: true }).fill('Cụm sân kiểm thử');
  await modal.getByLabel('Địa chỉ', { exact: true }).fill('Địa chỉ kiểm thử, Hà Nội');
  await modal.getByLabel(/^Quận\/huyện/).selectOption('Cầu Giấy');
  await modal.getByRole('button', { name: /Tiếp tục thiết lập sân/ }).click();
  await modal.getByRole('button', { name: /Tiếp tục thêm ảnh/ }).click();
  await modal.locator('input[type=file]').setInputFiles([photo('anh-bia.webp'), photo('mat-san.webp'), photo('tien-ich.webp')]);
  await modal.getByRole('button', { name: /Tạo cụm và mở nhận đặt/ }).click();
  await modal.getByRole('alert').waitFor();
  assert.equal(publications, 0, 'Incomplete upload never publishes venue');
  await modal.getByText('Tải lỗi · thử lại', { exact: true }).waitFor();
  await modal.getByText('Đã tải', { exact: true }).waitFor();
  await shot(page, 'venue-upload-retry');
  await modal.getByRole('button', { name: /Thử lại và công khai cụm/ }).click();
  await modal.waitFor({ state: 'detached' });
  assert.equal(created, 1, 'Retry reuses venue draft');
  assert.equal(uploads, 4, 'Retry skips first successful photo');
  assert.equal(publications, 1);
  assert.equal(new Set(uploadedPaths).size, 3);
  console.log('OK: venue photo failure/retry retains draft, skips successful uploads and only publishes a complete batch.');

  await page.goto(`${origin}/chu-san/quan-ly`);
  const manager = page.locator('section[data-unsaved-changes]').filter({ has: page.getByRole('heading', { name: 'Ảnh cụm sân', exact: true }) });
  uploads = 0; publications = 0;
  let backgroundReads = 0;
  page.on('request', request => { if (request.url().includes('/chu-san/quan-ly') && request.headers().rsc === '1') backgroundReads++; });
  await page.route('**/rest/v1/rpc/set_venue_images', route => {
    publications++;
    const data = route.request().postDataJSON();
    assert.equal(data.p_images.length, 5); assert.equal(data.p_expected.length, 3);
    return publications === 1 ? json(route, { message: 'Save interrupted' }, 503) : json(route, null);
  });
  await manager.locator('input[type=file]').setInputFiles([photo('goc-san.webp'), photo('tien-ich-moi.webp')]);
  await manager.getByText('Tải lỗi · thử lại', { exact: true }).waitFor();
  assert.equal(publications, 0);
  const readsBeforeRetry = backgroundReads;
  await page.evaluate(() => window.dispatchEvent(new Event('san-ngon:page-refresh')));
  await page.waitForTimeout(700);
  assert.equal(backgroundReads, readsBeforeRetry, 'Background refresh waits while a photo batch is unfinished');
  await shot(page, 'photo-manager-retry');
  await manager.getByRole('button', { name: 'Thử lại lượt thêm ảnh' }).click();
  await manager.getByRole('status').filter({ hasText: 'Chưa lưu được bộ ảnh' }).waitFor();
  assert.equal(uploads, 3); assert.equal(publications, 1);
  await manager.getByRole('button', { name: 'Thử lại lượt thêm ảnh' }).click();
  await manager.getByRole('status').filter({ hasText: 'Đã lưu toàn bộ ảnh' }).waitFor();
  assert.equal(uploads, 3, 'Publish retry reuses uploaded photos');
  assert.equal(publications, 2);
  assert.equal(await manager.getByRole('heading', { name: 'Ảnh đang thêm' }).count(), 0);
  console.log('OK: photo manager keeps existing images until the full batch is saved; upload and publish retries do not reupload successes.');
  await page.goto(`${origin}/chu-san/quan-ly`);
  uploads = 0;
  let discardedPaths = [];
  await page.route('**/storage/v1/object/venue-photos', route => {
    assert.equal(route.request().method(), 'DELETE');
    discardedPaths = route.request().postDataJSON().prefixes;
    return json(route, []);
  });
  await manager.locator('input[type=file]').setInputFiles([photo('them-moi.webp'), photo('anh-loi.webp')]);
  await manager.getByText('Tải lỗi · thử lại', { exact: true }).waitFor();
  await rejectDialog(page, () => manager.getByRole('button', { name: 'Bỏ lượt thêm ảnh' }).click());
  assert.equal(discardedPaths.length, 0, 'Cancelled discard does not delete photos');
  const discard = page.waitForEvent('dialog'); const discardClick = manager.getByRole('button', { name: 'Bỏ lượt thêm ảnh' }).click();
  await (await discard).accept(); await discardClick;
  await manager.getByRole('status').filter({ hasText: 'Đã bỏ lượt thêm ảnh' }).waitFor();
  assert.equal(discardedPaths.length, 1, 'Only the newly uploaded, unreferenced image is deleted');
  assert(!discardedPaths.some(path => path.startsWith('fixture')), 'Existing photos never deleted by discard');
  assert.equal(await manager.getByRole('button', { name: /^Xóa ảnh/ }).count(), 3);
  console.log('OK: discarding an incomplete batch checks saved images and only removes unused uploads.');
  await context.close();

  for (const state of ['setup', 'authorized', 'reconnect', 'ready']) {
    const { context, page } = await session(state);
    await page.route('**/api/sepay/accounts', route => json(route, { accounts: [{ id: 'bank-test', account_number: '0123456789', account_holder_name: 'TAI KHOAN KIEM THU', bank: { short_name: 'MB' } }] }));
    await page.goto(`${origin}/chu-san/thanh-toan`);
    const steps = page.getByRole('list', { name: 'Tiến độ kết nối nhận cọc' });
    await steps.waitFor();
    assert.equal(await steps.locator('li').count(), 3);
    if (state === 'ready') {
      assert.equal(await steps.getByText('Hoàn tất', { exact: true }).count(), 3);
      assert.equal(await steps.locator('[aria-current=step]').count(), 0);
      await page.getByText('Sân Ngon sẽ mở nhận đơn', { exact: false }).waitFor();
    } else {
      const active = steps.locator('[aria-current=step]');
      assert.equal(await active.count(), 1);
      assert.match(await active.innerText(), state === 'authorized' ? /Chọn tài khoản/ : /Cấp quyền SePay/);
      if (state === 'authorized') {
        await page.getByRole('radio').check();
        let requests = 0;
        await page.route('**/api/sepay/connection', route => {
          requests++;
          assert.equal(route.request().postDataJSON().account_id, 'bank-test');
          return json(route, { error: 'Chưa kiểm tra được kết nối. Thử lại.' }, 503);
        });
        await page.getByRole('button', { name: 'Dùng tài khoản này' }).click();
        await page.getByRole('alert').filter({ hasText: 'Chưa kiểm tra được kết nối' }).waitFor();
        assert(await page.getByRole('radio').isChecked(), 'Failed connection retains chosen bank');
        assert.equal(requests, 1);
      }
    }
    await shot(page, `sepay-${state}`);
    await context.close();
  }
  assert.deepEqual(errors, [], 'No browser exceptions');
  console.log('OK: SePay setup/authorized/reconnect/ready steps show next action without implying rollout approval. No real writes.');
} finally { await browser.close(); }
