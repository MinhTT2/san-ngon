// Use feedback-fixture-server.mjs and a local app. No real accounts or writes.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import('playwright');
const origin = process.argv[2];
assert(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname));
const output = process.env.UX_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const errors = [];
async function session(context, extra = {}) {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, exp, aud: 'authenticated', role: 'authenticated', fixture_role: 'admin', ...extra })}.fixture`;
  await context.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + b64({ access_token: token, refresh_token: 'fixture', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id } }), url: origin, sameSite: 'Lax' }]);
}
async function fit(page) {
  await page.evaluate(() => document.fonts.ready);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal page overflow');
}
const detail = '/admin/gop-y/f1000000-0000-4000-8000-000000000087';
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
    try {
      await session(context);
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin + '/admin/gop-y');
      const list = page.getByRole('region', { name: 'Danh sách góp ý' });
      await list.getByText('1–20 / 44 yêu cầu', { exact: true }).waitFor();
      assert.equal(await list.locator('li').count(), 20);
      assert.equal(await page.locator('textarea').count(), 0, 'List has no response forms');
      assert.equal(await page.locator('select[name="status"]').inputValue(), 'open');
      assert((await list.locator('li').first().innerText()).includes('Yêu cầu 001'));
      const metrics = page.getByRole('region', { name: 'Tổng quan góp ý' });
      assert((await metrics.getByRole('link').nth(0).innerText()).includes('22'));
      assert((await metrics.getByRole('link').nth(1).innerText()).includes('22'));
      assert((await metrics.getByRole('link').nth(2).innerText()).includes('43'));
      await fit(page);
      if (output && [390, 1440].includes(width)) await page.screenshot({ path: `${output}/feedback-list-${width}.png`, fullPage: true });
      await page.getByRole('link', { name: 'Trang sau →', exact: true }).click();
      await list.getByText('21–40 / 44 yêu cầu', { exact: true }).waitFor();
      const queueURL = page.url();
      await list.locator('li a').first().click();
      await page.getByRole('heading', { name: 'Xử lý và phản hồi' }).waitFor();
      assert.equal(await page.locator('textarea').count(), 1);
      await fit(page);
      await page.getByRole('link', { name: 'Về danh sách góp ý', exact: true }).click();
      await page.waitForURL(queueURL);
      await list.getByText('21–40 / 44 yêu cầu', { exact: true }).waitFor();
      await metrics.getByRole('link').nth(2).click();
      await list.getByText('1–20 / 43 yêu cầu', { exact: true }).waitFor();
      assert.equal(await page.locator('select[name="status"]').inputValue(), 'done', 'Controls follow link navigation');
      await page.locator('select[name="status"]').selectOption('all');
      await page.locator('select[name="category"]').selectOption('support');
      await page.locator('select[name="sort"]').selectOption('newest');
      await page.getByRole('searchbox', { name: 'Tìm yêu cầu' }).fill('SANABC234');
      await page.getByRole('button', { name: 'Tìm và lọc' }).click();
      await list.getByText('1–1 / 1 yêu cầu', { exact: true }).waitFor();
      assert(new URL(page.url()).searchParams.get('page') !== '2', 'Submitting filters resets pagination');
      await list.locator('li a').click();
      await page.getByRole('heading', { name: 'Hỗ trợ chuyển khoản SANABC234', exact: true }).waitFor();
      await page.getByRole('link', { name: 'Xem chứng từ riêng tư', exact: true }).waitFor();
      assert.equal(await page.getByLabel('Phản hồi cho người gửi').inputValue(), 'Đã kiểm tra và xử lý yêu cầu của bạn.');
      await fit(page);
      if (output && [390, 1440].includes(width)) await page.screenshot({ path: `${output}/feedback-detail-${width}.png`, fullPage: true });
      await page.getByRole('link', { name: 'Về danh sách góp ý' }).click();
      await list.getByText('1–1 / 1 yêu cầu', { exact: true }).waitFor();
    } finally { await context.close(); }
    console.log(`OK ${width}px: compact queue, counts, pagination, filters, detail and return path.`);
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    await session(context);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/admin/gop-y?status=all&q=' + encodeURIComponent('chiếc vợt màu xanh'));
    await page.getByText('1–1 / 1 yêu cầu', { exact: true }).waitFor();
    for (const term of ['x"),status.eq.new', '100%', 'a,b(c)', '*', '_', '\\']) {
      await page.goto(origin + '/admin/gop-y?status=all&q=' + encodeURIComponent(term));
      await page.getByRole('heading', { name: 'Không có yêu cầu phù hợp' }).waitFor();
    }
    await page.goto(origin + '/admin/gop-y?status=all&page=999');
    await page.getByText('81–87 / 87 yêu cầu', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('page'), '5');

    const back = '/admin/gop-y?status=all&category=support&q=SANABC234&sort=newest&page=1';
    await page.goto(origin + detail + '?back=' + encodeURIComponent(back));
    const reply = page.getByLabel('Phản hồi cho người gửi');
    await reply.fill('Đã kiểm tra sao kê và liên hệ chủ sân để đối soát.');
    let writes = 0;
    await page.route('**/api/feedback', route => {
      writes++;
      const body = route.request().postDataJSON();
      assert.equal(body.updated_at, '2026-10-12T03:00:00Z');
      assert.equal(body.id, 'f1000000-0000-4000-8000-000000000087');
      return route.fulfill({ status: writes === 1 ? 503 : 200, contentType: 'application/json', body: JSON.stringify(writes === 1 ? { error: 'Chưa lưu được phản hồi giả lập.' } : { ok: true }) });
    });
    await page.getByRole('button', { name: 'Lưu và về danh sách' }).click();
    await page.getByRole('alert').filter({ hasText: 'Chưa lưu được phản hồi giả lập.' }).waitFor();
    assert.equal(await reply.inputValue(), 'Đã kiểm tra sao kê và liên hệ chủ sân để đối soát.');
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('link', { name: 'Về danh sách góp ý' }).click();
    assert.equal(new URL(page.url()).pathname, detail, 'Unsaved edit stays open when leaving is declined');
    await page.getByRole('button', { name: 'Lưu và về danh sách' }).click();
    await page.waitForURL(url => url.pathname === '/admin/gop-y' && url.searchParams.get('q') === 'SANABC234' && url.searchParams.get('category') === 'support' && url.searchParams.get('sort') === 'newest' && url.searchParams.get('page') === '1');
    assert.equal(writes, 2);
    await page.getByText('1–1 / 1 yêu cầu', { exact: true }).waitFor();

    await page.unroute('**/api/feedback');
    await page.route('**/api/feedback', route => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'Góp ý vừa được cập nhật ở nơi khác.' }) }));
    await page.goto(origin + detail);
    await reply.fill('Bản nháp cần giữ khi có cập nhật ở nơi khác.');
    await page.getByRole('button', { name: 'Lưu và về danh sách' }).click();
    await page.getByRole('alert').filter({ hasText: 'Góp ý vừa được cập nhật ở nơi khác.' }).waitFor();
    assert.equal(await reply.inputValue(), 'Bản nháp cần giữ khi có cập nhật ở nơi khác.');
    assert(await page.getByRole('button', { name: 'Lưu và về danh sách' }).isDisabled());
    await page.getByRole('button', { name: 'Tải bản mới để tiếp tục' }).waitFor();
    await reply.fill('');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('link', { name: 'Về danh sách góp ý' }).click();

    await session(context, { fixture_feedback: 'empty' });
    await page.goto(origin + '/admin/gop-y');
    await page.getByRole('heading', { name: 'Đã xử lý hết yêu cầu hiện có' }).waitFor();
    await session(context, { fixture_feedback: 'error' });
    await page.reload();
    await page.getByRole('alert').filter({ hasText: 'Chưa tải được danh sách góp ý' }).waitFor();
    assert.equal(await page.getByText('Đã xử lý hết yêu cầu hiện có', { exact: true }).count(), 0);
    await session(context);
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await page.getByText('1–20 / 44 yêu cầu', { exact: true }).waitFor();

    await page.goto(origin + detail + '?back=' + encodeURIComponent('https://example.invalid'));
    assert.equal(await page.getByRole('link', { name: 'Về danh sách góp ý' }).getAttribute('href'), '/admin/gop-y');
    const missing = await page.goto(origin + '/admin/gop-y/f1000000-0000-4000-8000-999999999999');
    assert.equal(missing.status(), 404);
    await session(context, { fixture_role: 'owner' });
    await page.goto(origin + detail);
    assert.equal(new URL(page.url()).pathname, '/');
  } finally { await context.close(); }
  assert.deepEqual(errors, []);
  console.log('OK: literal search, late-page clamp, private evidence, save retry, unsaved edits, conflict, empty/error recovery and admin access.');
} finally { await browser.close(); }
