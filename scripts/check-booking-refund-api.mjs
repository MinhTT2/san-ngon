// Actual route, isolated auth/RPC mocks. Never sends a transfer or a notification.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { NextResponse } from 'next/server.js';
import { refundError } from '../lib/booking-refunds.ts';
const require = createRequire(import.meta.url);
let user = { id: 'owner-fixture' }, sqlError = null;
const calls = [];
const db = {
  auth: { getUser: async () => ({ data: { user } }) },
  rpc: async (name, args) => { calls.push({ name, args }); return { data: { code: 'SANRFD234' }, error: sqlError }; },
};
const context = { exports: {}, require(name) {
  if (name === 'next/server') return { NextResponse };
  if (name === '@/lib/supabase/server') return { createClient: async () => db };
  if (name === '@/lib/booking-refunds') return { refundError };
  return require(name);
} };
vm.runInNewContext(ts.transpileModule(await readFile(new URL('../app/api/bookings/[code]/refund/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const body = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', amount: 40000, reference: ' REFUND-123 ', transferred_at: '2026-10-21T10:00' };
const args = code => ({ params: Promise.resolve({ code }) });
const request = value => new Request('http://fixture.invalid/api/bookings/SANRFD234/refund', { method: 'POST', body: JSON.stringify(value) });
for (const value of [null, {}, { ...body, id: 'bad' }, { ...body, amount: -1 }, { ...body, amount: 1.5 }, { ...body, amount: 2147483648 }, { ...body, reference: 'x' }, { ...body, transferred_at: '2026-10-21T03:00Z' }]) {
  assert.equal((await context.exports.POST(request(value), args('SANRFD234'))).status, 400);
}
assert.equal(calls.length, 0);
user = null; assert.equal((await context.exports.POST(request(body), args('SANRFD234'))).status, 401);
assert.equal((await context.exports.GET(request(body), args('SANRFD234'))).status, 401);
assert.equal(calls.length, 0); user = { id: 'owner-fixture' };
assert.equal((await context.exports.POST(request(body), args('bad'))).status, 400);
assert.equal((await context.exports.POST(request(body), args('SANRFD234'))).status, 200);
assert.equal(calls.at(-1).name, 'record_booking_refund');
assert.equal(calls.at(-1).args.p_reference, 'REFUND-123');
assert.equal(calls.at(-1).args.p_transferred_at, body.transferred_at, 'timezone conversion stays in SQL');
const response = await context.exports.GET(request(body), args('SANRFD234'));
assert.equal(response.headers.get('cache-control'), 'private, no-store');
assert.equal(calls.at(-1).name, 'get_booking_refund');
for (const [message, status] of [['FORBIDDEN', 403], ['BOOKING_NOT_FOUND', 404], ['INVALID_REFUND', 400], ['REFUND_EXCEEDS_REMAINING', 409], ['REFUND_CONFLICT', 409], ['LEGACY_REFUND_REVIEW', 409], ['private database detail', 503]]) {
  sqlError = { message };
  const result = await context.exports.POST(request(body), args('SANRFD234'));
  assert.equal(result.status, status); assert(!(await result.text()).includes('private database detail'));
}
console.log('OK: refund validation, auth, private read projection, unchanged local time, SQL errors and no old status-only RPC.');
