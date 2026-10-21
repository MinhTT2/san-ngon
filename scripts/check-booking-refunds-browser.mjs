import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const origin = process.argv[2];
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, exp, aud: 'authenticated', role: 'authenticated', fixture_role: 'owner', fixture_refunds: true })}.fixture`;
    await context.addCookies([{ name: 'sb-127-auth-token', url: origin, value: `base64-${b64({ access_token: token, refresh_token: 'fixture', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id, email: 'fixture@example.invalid' } })}` }]);
    const page = await context.newPage();
    let summary = { code: 'SANABC234', status: 'needed', received: 100000, refunded: 0, retained: 0, remaining: 100000, local_now: '2026-10-21T14:00', legacy: false, can_record: true, records: [] };
    const requests = []; let loseResponse = true;
    await page.route('**/api/bookings/*/refund', async route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { refund: summary } });
      const payload = route.request().postDataJSON(); requests.push(payload);
      if (requests.length === 1) {
        summary = { ...summary, refunded: payload.amount, remaining: 100000 - payload.amount, records: [{ ...payload, actor_name: 'Chủ sân kiểm tra', transferred_at: '2026-10-21T07:00:00Z', recorded_at: '2026-10-21T07:01:00Z' }] };
      }
      if (loseResponse) { loseResponse = false; return route.abort('failed'); }
      return route.fulfill({ json: { refund: summary } });
    });
    await page.goto(origin + '/chu-san/hoan-coc');
    await page.getByRole('button', { name: 'Ghi nhận hoàn tiền', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByText('100.000đ', { exact: true }).first().waitFor();
    await dialog.getByLabel('Số tiền đã chuyển hoàn (đồng)').fill('40000');
    await dialog.getByLabel('Mã tham chiếu chuyển hoàn').fill('REFUND-123');
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Lưu khoản đã chuyển hoàn' }).click();
    await dialog.getByRole('alert').waitFor();
    assert(await dialog.getByLabel('Mã tham chiếu chuyển hoàn').isDisabled());
    await dialog.getByRole('button', { name: 'Thử lại cùng yêu cầu' }).click();
    await dialog.getByText('Đã ghi nhận khoản chuyển hoàn.', { exact: true }).waitFor();
    assert.deepEqual(requests[0], requests[1], 'retry reuses UUID, amount, reference and local time');
    await dialog.getByText('60.000đ', { exact: true }).waitFor();
    await dialog.getByText('Tham chiếu: REFUND-123', { exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (process.env.UX_SCREENSHOT_DIR) {
      await mkdir(process.env.UX_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: `${process.env.UX_SCREENSHOT_DIR}/refund-receipt-${width}.png`, fullPage: true });
    }
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
    await page.goto(origin + '/don-cua-toi?filter=all');
    await page.getByRole('button', { name: 'Lịch sử hoàn tiền', exact: true }).first().click();
    await page.getByRole('dialog').getByText('Tham chiếu: REFUND-123', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Lưu khoản đã chuyển hoàn' }).count(), 0, 'player history has no write control');
    await context.close();
  }
  console.log('OK: 390/1440 partial refund, lost response, exact replay, receipt visibility and read-only player history.');
} finally { await browser.close(); }
