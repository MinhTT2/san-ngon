// Exercise Next middleware over HTTP. Only a synthetic isolated server is allowed.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.argv[2];
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext();
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const exp = Math.floor(Date.now() / 1000) + 3600;
const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, exp, aud: 'authenticated', role: 'authenticated', fixture_role: 'admin' })}.fixture`;
await context.addCookies([{ name: 'sb-127-auth-token', url: origin, sameSite: 'Lax', value: `base64-${b64({ access_token: token, refresh_token: 'fixture-only', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id, email: 'fixture@example.invalid' } })}` }]);
try {
  const writes = [
    ['/api/bookings', 'POST'], ['/api/profile', 'PATCH'], ['/api/admin/users', 'POST'],
    ['/api/venues', 'POST'], ['/api/courts', 'POST'], ['/api/owner-registration', 'POST'],
    ['/api/bookings/SANABC234/cancel', 'POST'], ['/api/bookings/SANABC234/confirm', 'POST'],
    ['/api/bookings/SANABC234/refund', 'POST'], ['/api/telegram/connect', 'POST'],
    ['/api/sepay/connect', 'POST'], ['/api/sepay/connection', 'DELETE'],
    ['/api/courts/fixture', 'DELETE'], ['/api/venues/fixture', 'DELETE'],
    ['/api/admin/owners/fixture/status', 'POST'], ['/auth/dang-xuat', 'POST'],
  ];
  for (const [path, method] of writes) {
    for (const headers of [{ Origin: 'https://untrusted.example' }, { Origin: 'null' }, {}]) {
      const response = await context.request.fetch(origin + path, { method, headers, data: {}, maxRedirects: 0 });
      assert.equal(response.status(), 403, `${method} ${path} rejects ${JSON.stringify(headers)} with authenticated cookie`);
      assert.match((await response.json()).error, /Yêu cầu không hợp lệ/);
    }
  }
  // The same authenticated session still reaches input validation.
  for (const [path, method] of [['/api/bookings', 'POST'], ['/api/profile', 'PATCH']]) {
    const response = await context.request.fetch(origin + path, { method, headers: { Origin: origin }, data: {} });
    assert.equal(response.status(), 400, 'same-origin request reaches validation');
  }
  for (const path of ['/api/webhooks/sepay', '/api/webhooks/telegram']) {
    assert.equal((await context.request.post(origin + path, { data: {} })).status(), 401, 'webhook retains independent key validation');
  }
  const page = await context.newPage();
  await page.goto(origin + '/tai-khoan');
  assert.equal(await page.evaluate(async () => (await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status), 400, 'native browser fetch supplies the correct Origin');
  const logout = await context.request.post(origin + '/auth/dang-xuat', { headers: { Origin: origin }, maxRedirects: 0 });
  assert.equal(logout.status(), 303, 'same-origin logout still works');
  console.log('OK: real Next HTTP boundary rejects 48 foreign/null/missing-Origin authenticated writes, same-origin API/browser/logout work, webhook keys remain enforced.');
} finally { await context.close(); await browser.close(); }
