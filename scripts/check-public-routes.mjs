import assert from 'node:assert/strict';
const origin = process.argv[2] ?? 'http://localhost:3000';
for (const path of ['/', '/tim-san', '/dang-nhap', '/dang-ky', '/dang-ky-san', '/lien-he', '/chinh-sach-huy',
  '/tim-san?page=1.5', '/tim-san?page=Infinity', '/tim-san?sport=toString', '/tim-san?q=a&q=b', '/tim-san?ngay=2026-99-99']) {
  const response = await fetch(origin + path);
  const html = await response.text();
  assert.equal(response.status, 200, path);
  assert.match(html, /<h1[\s>]/, path);
  assert.doesNotMatch(html, /"digest":/, `${path}: server render failed`);
}
for (const path of ['/don-cua-toi', '/thong-bao', '/chu-san', '/chu-san/quan-ly', '/chu-san/don', '/chu-san/lich', '/chu-san/thanh-toan', '/chu-san/phi-dich-vu', '/tao-cum-san', '/admin', '/admin/users', '/admin/phi-dich-vu']) {
  const response = await fetch(origin + path);
  const html = await response.text();
  // App Router can send the redirect as streamed HTML after the layout starts.
  if (new URL(response.url).pathname !== '/dang-nhap') {
    assert.match(html, /http-equiv="refresh" content="\d;url=\/dang-nhap\?/, path);
  }
}
for (const [path, body, status] of [
  ['/api/bookings', {}, 400], ['/api/courts', {}, 400], ['/api/venues', {}, 400],
  ['/api/admin/users', {}, 401], ['/api/subscriptions', { action: 'invoice' }, 401],
  ['/api/bookings/SANABC234/cancel', {}, 401],
  ['/api/bookings', { court_id: 'd0000000-0000-4000-8000-000000000003', starts_at: '2026-09-26T03:00:00+00:00', ends_at: '2026-09-26T04:00:00+00:00', customer_phone: '0900000000' }, 401],
]) {
  const response = await fetch(origin + path, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body) });
  assert.equal(response.status, status, path);
  assert.equal(typeof (await response.json()).error, 'string', path);
}
console.log('OK: 12 public pages/search cases, 12 authentication redirects, 7 API validation/auth cases.');
for (const path of ['/api/subscriptions', '/auth/dang-xuat']) {
  const response = await fetch(origin + path, { method: 'POST', headers: { origin: 'https://untrusted.example', 'content-type': 'application/json' }, body: '{"action":"invoice"}' });
  assert.equal(response.status, 403, `${path}: cross-origin request`);
}
const logout = await fetch(origin + '/auth/dang-xuat', { method: 'POST', headers: { origin }, redirect: 'manual' });
assert.equal(logout.status, 303);
assert.equal(logout.headers.get('location'), origin + '/');
console.log('OK: same-origin logout works; external origins cannot sign out or create fee invoices.');
