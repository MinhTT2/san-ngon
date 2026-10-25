import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const origin = process.argv[2];
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
async function signIn(context, role) {
  const id = role === 'admin' ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' : 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, exp, aud: 'authenticated', role: 'authenticated', fixture_role: role })}.fixture`;
  await context.addCookies([{ name: 'sb-127-auth-token', url: origin, value: `base64-${b64({ access_token: token, refresh_token: 'fixture', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id, email: 'fixture@example.invalid' } })}` }]);
}
try {
  const context = await browser.newContext(); const page = await context.newPage();
  for (const role of ['owner', 'admin']) {
    await context.clearCookies(); await signIn(context, role);
    const path = role === 'admin' ? '/admin/bao-cao-tien' : '/chu-san/bao-cao-tien';
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 }); await page.goto(origin + path);
      await page.getByRole('heading', { name: 'Tiền ghi nhận trên website', exact: true }).waitFor();
      await page.getByRole('heading', { name: 'Nghĩa vụ hoàn sân hiện tại', exact: true }).waitFor();
      await page.getByText('90.000đ', { exact: true }).waitFor();
      await page.getByRole('textbox', { name: 'Từ ngày', exact: true }).count();
      await page.locator('input[name=from]').fill('2026-10-01');
      await page.locator('input[name=to]').fill('2026-10-21');
      await page.getByRole('button', { name: 'Xem báo cáo', exact: true }).click();
      await page.waitForURL(url => url.searchParams.get('from') === '2026-10-01');
      const response = await context.request.get(origin + '/api/cash-report?from=2026-10-01&to=2026-10-21');
      assert.equal(response.status(), 200); assert.equal(response.headers()['cache-control'], 'private, no-store');
      const csv = await response.text(); assert(csv.includes("'=FORMULA")); assert(csv.includes('130000')); assert(csv.includes('40000'));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(900);
      if (process.env.UX_SCREENSHOT_DIR && role === 'owner') { await mkdir(process.env.UX_SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: `${process.env.UX_SCREENSHOT_DIR}/cash-report-${width}.png`, fullPage: true }); }
    }
  }
  await context.clearCookies(); await page.goto(origin + '/admin/bao-cao-tien'); await page.waitForURL(url => url.pathname === '/dang-nhap');
  assert.equal((await context.request.get(origin + '/api/cash-report?from=2026-10-01&to=2026-10-21')).status(), 401);
  assert.equal((await context.request.get(origin + '/api/cash-report?from=invalid&to=2026-10-21')).status(), 400);
  await context.close(); console.log('OK: cash report owner/admin 390/1440, dates, receipts/refunds/due, private CSV and formula escaping.');
} finally { await browser.close(); }
