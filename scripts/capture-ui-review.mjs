// Settled screenshots for visual review; uses only local synthetic auth/data.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.argv[2];
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = process.env.UX_SCREENSHOT_DIR;
assert(output);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
try {
  for (const [role, routes] of [['public', ['/tim-san', '/ket-noi']], ['admin', ['/admin']], ['owner', ['/chu-san']]]) {
    const context = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
    if (role !== 'public') {
      const id = role === 'admin' ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' : 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
      const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, exp, aud: 'authenticated', role: 'authenticated', fixture_role: role })}.fixture`;
      await context.addCookies([{ name: 'sb-127-auth-token', url: origin, sameSite: 'Lax', value: `base64-${b64({ access_token: token, refresh_token: 'fixture-only', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id, email: 'fixture@example.invalid' } })}` }]);
    }
    const page = await context.newPage();
    for (const route of routes) for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(origin + route); await page.locator('h1').waitFor();
      await page.evaluate(() => document.fonts.ready);
      for (let y = 0; y < await page.evaluate(() => document.body.scrollHeight); y += 600) {
        await page.evaluate(y => scrollTo(0, y), y); await page.waitForTimeout(150);
      }
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(1400);
      await page.screenshot({ path: `${output}/review-${route.slice(1)}-${width}.png`, fullPage: true });
    }
    await context.close();
  }
  console.log('Saved settled discovery/admin/owner screenshots with synthetic data.');
} finally { await browser.close(); }
