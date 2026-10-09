// API contract checks only: no real session, database writes, email or payment.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { BOOKING_ERRORS, bookingErrorMessage } from '../lib/constants.ts';

const require = createRequire(import.meta.url);
const { normalizePhone } = await import('../lib/profile.ts');
let signedIn = true;
let databaseError = null;
let rpcCalls = [];
const sandbox = {
  exports: {},
  require(name) {
    if (name === '@/lib/profile') return { normalizePhone };
    if (name === '@/lib/constants') return { bookingErrorMessage };
    if (name === '@/lib/supabase/server') return { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'fixture-only' } : null } }) },
      rpc(name, args) {
        rpcCalls.push({ name, args: JSON.parse(JSON.stringify(args)) });
        return { single: async () => ({ data: databaseError ? null : { code: 'SANABC234' }, error: databaseError }) };
      },
    }) };
    return require(name);
  },
};
const source = await readFile(new URL('../app/api/bookings/route.ts', import.meta.url), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, sandbox);
const valid = {
  court_id: 'e0900000-0000-4000-8000-000000000060',
  starts_at: '2030-01-01T03:00:00+00:00', ends_at: '2030-01-01T04:00:00+00:00',
  customer_name: '  Nguyễn Văn An  ', customer_phone: ' 0900000002 ', note: '  Ghi chú  ',
};
async function post(body) {
  return sandbox.exports.POST(new Request('http://localhost/api/bookings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
}
for (const [patch, message] of [
  [{ customer_name: 'Đ'.repeat(101) }, 'Tên người đặt không quá 100 ký tự.'],
  [{ note: 'đ'.repeat(501) }, 'Ghi chú không quá 500 ký tự.'],
  [{ customer_phone: '090000000x' }, 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0'],
  [{ court_id: 'not-a-uuid' }, 'Thông tin sân không hợp lệ.'],
  [{ starts_at: 'not-a-time' }, 'Giờ bắt đầu không hợp lệ.'],
  [{ ends_at: 'not-a-time' }, 'Giờ kết thúc không hợp lệ.'],
]) {
  rpcCalls = [];
  const response = await post({ ...valid, ...patch });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, message);
  assert.equal(rpcCalls.length, 0, 'invalid API input never reaches booking RPC');
}
for (const code of ['TOO_MANY_SLOTS', 'PHONE_INVALID', 'NAME_TOO_LONG', 'NOTE_TOO_LONG']) {
  rpcCalls = [];
  databaseError = { message: `${code}: fixture-only` };
  const response = await post(valid);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, BOOKING_ERRORS[code]);
  assert.equal(rpcCalls.length, 1);
}
databaseError = { message: 'SLOT_TAKEN' };
assert.equal((await post(valid)).status, 409, 'overlap remains a conflict');
databaseError = null;
signedIn = false;
rpcCalls = [];
assert.equal((await post(valid)).status, 401);
assert.equal(rpcCalls.length, 0, 'anonymous API call never invokes booking RPC');
signedIn = true;
rpcCalls = [];
const response = await post({ ...valid, total_amount: 0, deposit_amount: 0, price: 0 });
assert.equal(response.status, 201);
assert.equal((await response.json()).booking.code, 'SANABC234');
assert.deepEqual(rpcCalls, [{ name: 'create_booking', args: {
  p_court_id: valid.court_id, p_starts_at: valid.starts_at, p_ends_at: valid.ends_at,
  p_customer_name: 'Nguyễn Văn An', p_customer_phone: '0900000002', p_note: 'Ghi chú',
} }], 'only validated contact/time fields reach SQL; client amounts are discarded');
const boundary = await post({ ...valid, customer_name: 'Đ'.repeat(100), note: 'đ'.repeat(500) });
assert.equal(boundary.status, 201);
for (const phone of ['0912 345 678', '+84 912 345 678', '+84 (912) 345-678', '0912345678']) {
  rpcCalls = [];
  assert.equal((await post({ ...valid, customer_phone: phone })).status, 201);
  assert.equal(rpcCalls[0].args.p_customer_phone, '0912345678');
}
for (const phone of ['+84 912 345 6789', '0912345678x', '+1 912 345 678', '0'.repeat(31)]) {
  rpcCalls = [];
  assert.equal((await post({ ...valid, customer_phone: phone })).status, 400);
  assert.equal(rpcCalls.length, 0);
}
console.log('OK: booking API rejects invalid inputs, translates SQL guards, preserves auth/conflict handling and never accepts client prices.');
