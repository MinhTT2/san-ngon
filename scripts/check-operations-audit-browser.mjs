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
  const context = await browser.newContext(); const page = await context.newPage(); await signIn(context, 'admin');
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin + '/admin/nhat-ky');
    await page.getByRole('heading', { name: 'Nhật ký thao tác', exact: true }).waitFor();
    await page.getByText('Ghi khoản hoàn tiền', { exact: true }).waitFor();
    await page.getByText('Đã ghi hoàn 40.000đ', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Xóa nhật ký|Sửa nhật ký/ }).count(), 0);
    await page.getByRole('textbox', { name: 'Mã đơn hoặc mã đối tượng' }).fill('SANAUD234');
    await page.getByRole('button', { name: 'Tra nhật ký' }).click();
    await page.waitForURL(url => url.searchParams.get('q') === 'SANAUD234');
    assert.equal(await page.locator('ol > li').count(), 1);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(900);
    if (process.env.UX_SCREENSHOT_DIR) {
      await mkdir(process.env.UX_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: `${process.env.UX_SCREENSHOT_DIR}/operations-audit-${width}.png`, fullPage: true });
    }
  }
  await context.clearCookies(); await signIn(context, 'owner'); await page.goto(origin + '/admin/nhat-ky');
  await page.waitForURL(url => url.pathname === '/');
  await context.clearCookies(); await page.goto(origin + '/admin/nhat-ky'); await page.waitForURL(url => url.pathname === '/dang-nhap');
  await context.close(); console.log('OK: audit 390/1440, human-readable evidence, literal search, immutable UI and owner/anonymous restrictions.');
} finally { await browser.close(); }
