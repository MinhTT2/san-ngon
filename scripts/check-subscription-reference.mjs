import assert from 'node:assert/strict';
import { extractSubscriptionCodes, extractRefCode, vietQrUrl } from '../lib/sepay.ts';
const payload = { id: 1, transferAmount: 299000, transferType: 'in' };
assert.deepEqual(extractSubscriptionCodes({ ...payload, content: 'phiabcdef12', code: 'PHIABCDEF12' }), ['PHIABCDEF12']);
assert.deepEqual(extractSubscriptionCodes({ ...payload, content: 'PHIABCDEF12 PHI12345678' }), ['PHIABCDEF12', 'PHI12345678']);
for (const content of ['SANABC234', 'PHIABCDEF1', 'PHIABCDEF123', 'PHIABCDEFGH']) {
  assert.deepEqual(extractSubscriptionCodes({ ...payload, content }), []);
}
assert.equal(extractRefCode({ ...payload, content: 'PHIABCDEF12' }), null);
assert.equal(extractRefCode({ ...payload, content: 'sanabc234', code: 'SANABC234' }), 'SANABC234');
for (const content of ['SANABC234 SANDEF567', 'SANABC2345', 'SANABC01O']) {
  assert.equal(extractRefCode({ ...payload, content }), null);
}
const qr = new URL(vietQrUrl('PHIABCDEF12', 299000, 'MBBank', '1234567890'));
assert.equal(qr.searchParams.get('amount'), '299000');
assert.equal(qr.searchParams.get('des'), 'PHIABCDEF12');
console.log('OK: fee references stay separate from bookings; QR carries invoice amount and reference.');
