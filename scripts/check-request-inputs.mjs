import assert from 'node:assert/strict';
import { safeNext } from '../lib/safe-next.ts';
import { VenueSearchParams } from '../lib/search-params.ts';
import { requestOrigin } from '../lib/request-origin.ts';

for (const next of [null, '', 'https://example.com', '//example.com', '/\\example.com', 'javascript:alert(1)', '/\t/example.com', '/\n/example.com']) {
  assert.equal(safeNext(next), '/', String(next));
}
assert.equal(safeNext('/san/my-dinh?ngay=2026-09-26'), '/san/my-dinh?ngay=2026-09-26');
for (const page of ['1.5', 'Infinity', '2147483648', '-1', 'oops', ['1', '2']]) {
  assert.equal(VenueSearchParams.parse({ page }).page, 1);
}
for (const ngay of ['2026-99-99', '2026-02-29', '0000-01-01', ['2026-09-25', '2026-09-26']]) {
  assert.equal(VenueSearchParams.parse({ ngay }).ngay, undefined);
}
assert.equal(VenueSearchParams.parse({ sport: 'toString', q: ['a', 'b'] }).sport, undefined);
assert.equal(VenueSearchParams.parse({ q: ['a', 'b'] }).q, '');
assert.equal(VenueSearchParams.parse({ ngay: '2028-02-29', page: '2' }).ngay, '2028-02-29');
assert.equal(VenueSearchParams.parse({ page: '2' }).page, 2);
assert.equal(requestOrigin(new Request('http://0.0.0.0:3101/api/subscriptions', { headers: { host: 'localhost:3101' } })), 'http://localhost:3101');
assert.equal(requestOrigin(new Request('https://internal.example/api/subscriptions', { headers: { host: 'san-ngon.example' } })), 'https://san-ngon.example');
console.log('OK: authentication redirects stay local; malformed search parameters fall back safely.');
