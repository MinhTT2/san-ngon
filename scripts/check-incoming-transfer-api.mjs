// Runs the actual handlers with counted SQL and notification mocks; no network or live keys.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { NextRequest, NextResponse } from 'next/server.js';
import { extractBookingCodes, extractSubscriptionCodes, extractTournamentCodes } from '../lib/sepay.ts';
const require = createRequire(import.meta.url);
const calls = [], messages = [];
let sqlError = null, reason = 'NO_REF_CODE', authUser = { id: 'receiver-fixture' }, connectionFound = true, connectionError = null;
const db = {
  auth: { getUser: async () => ({ data: { user: authUser } }), admin: { getUserById: async () => ({ data: { user: null } }) } },
  rpc: async (name, args) => { calls.push({ name, args }); return { data: { ok: true, reason, owner_id: 'receiver-fixture' }, error: sqlError }; },
  from() { const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: connectionFound ? { bank: 'MBBank', account_number: '1234567890' } : null, error: connectionError }) }; return chain; },
};
async function load(path) {
  const context = { exports: {}, console: { log() {}, error() {} }, process: { env: { SEPAY_WEBHOOK_API_KEY: 'fixture-key', NEXT_PUBLIC_SEPAY_BANK: 'MBBank', NEXT_PUBLIC_SEPAY_ACCOUNT: '1234567890' } },
    require(name) {
      if (name === 'next/server') return { NextRequest, NextResponse };
      if (name === '@/lib/supabase/admin') return { createAdminClient: () => db };
      if (name === '@/lib/supabase/server') return { createClient: async () => db };
      if (name === '@/lib/sepay') return { extractBookingCodes, extractSubscriptionCodes, extractTournamentCodes };
      if (name === '@/lib/sepay-crypto') return { secretHash: () => 'fixture' };
      if (name === '@/lib/notify') return { sendTelegram: async () => { messages.push('telegram'); return { ok: true }; }, ownerBookingMessage: () => 'fixture' };
      return require(name);
    },
  };
  vm.runInNewContext(ts.transpileModule(await readFile(new URL('../' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  return context.exports;
}
const webhook = await load('app/api/webhooks/sepay/route.ts');
const base = { id: '910001', gateway: 'MBBank', accountNumber: '1234567890', transferType: 'in', transferAmount: 100000, content: '' };
async function post(patch = {}, headers = { authorization: 'Apikey fixture-key' }, suffix = '') {
  return webhook.POST(new NextRequest('http://fixture.invalid/api/webhooks/sepay' + suffix, { method: 'POST', headers, body: JSON.stringify({ ...base, ...patch }) }));
}
assert.equal((await post({}, {})).status, 401); assert.equal(calls.length, 0);
for (const [content, refs, expected] of [
  ['', [], 'NO_REF_CODE'], ['SANABC234 SANDEF567', ['SANABC234', 'SANDEF567'], 'AMBIGUOUS_REF_CODE'],
  ['PHIABCDEF12 GIAIABCDEF123456', ['PHIABCDEF12', 'GIAIABCDEF123456'], 'AMBIGUOUS_REF_CODE'],
  ['sanabc234 SANABC234', ['SANABC234'], 'CONFIRMED'], ['SANABC2345', [], 'NO_REF_CODE'],
  ['PHIABCDEF12', ['PHIABCDEF12'], 'SUBSCRIPTION_PAID'], ['GIAIABCDEF123456', ['GIAIABCDEF123456'], 'PAID'],
]) {
  reason = expected; const before = calls.length; const response = await post({ content });
  assert.equal(response.status, 200); assert.equal((await response.json()).reason, expected);
  assert.equal(calls.length, before + 1); assert.equal(calls.at(-1).name, 'process_incoming_transfer');
  assert.deepEqual([...calls.at(-1).args.p_codes], refs); assert.equal(calls.at(-1).args.p_amount, 100000);
  assert.equal(calls.at(-1).args.p_receiver_account, '1234567890'); assert.equal(calls.at(-1).args.p_connection_id, null);
}
assert.equal(messages.length, 0, 'provider delivery belongs to the committed SQL outbox, not the webhook');
reason = 'ALREADY_PROCESSED'; await post({ content: 'SANABC234' }); assert.equal(messages.length, 0, 'receipt retry never sends directly');
reason = 'PAYMENT_PAYLOAD_CONFLICT'; assert.equal((await post()).status, 200);
const beforeInvalid = calls.length;
for (const patch of [{ transferType: 'out' }, { transferAmount: -1 }, { id: '9'.repeat(51) }, { gateway: 'other' }, { accountNumber: '9876543210' }]) assert.equal((await post(patch)).status, 200);
assert.equal(calls.length, beforeInvalid);
sqlError = { code: 'XX000', message: 'private banking SQL details' };
let response = await post(); assert.equal(response.status, 500); assert.equal((await response.json()).error, 'database_error'); sqlError = null;
const suffix = '?connection=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
connectionFound = false; assert.equal((await post({}, { authorization: 'Apikey wrong' }, suffix)).status, 401);
connectionFound = true; reason = 'NO_REF_CODE'; assert.equal((await post({}, { authorization: 'Apikey fixture-key' }, suffix)).status, 200);
assert.equal(calls.at(-1).args.p_connection_id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
connectionError = { message: 'private SQL' }; assert.equal((await post({}, { authorization: 'Apikey fixture-key' }, suffix)).status, 500); connectionError = null;
const notes = await load('app/api/incoming-transfers/[id]/notes/route.ts');
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const body = { note_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', note: ' Bank statement checked. ', updated_at: '2026-10-12T03:00:00Z' };
async function note(data = body, transfer = id) { return notes.POST(new Request('http://fixture.invalid/api/incoming-transfers/' + transfer + '/notes', { method: 'POST', body: JSON.stringify(data) }), { params: Promise.resolve({ id: transfer }) }); }
const beforeNote = calls.length;
assert.equal((await note({ ...body, note: 'short' })).status, 400); assert.equal((await note(body, 'bad')).status, 400);
assert.equal(calls.length, beforeNote);
authUser = null; assert.equal((await note()).status, 401); authUser = { id: 'receiver-fixture' };
assert.equal((await note()).status, 200); assert.equal(calls.at(-1).name, 'note_incoming_transfer'); assert.equal(calls.at(-1).args.p_note, 'Bank statement checked.');
for (const [message, code, status] of [['INVALID_NOTE', 'P0001', 400], ['TRANSFER_CHANGED', 'P0001', 409], ['NOTE_CONFLICT', 'P0001', 409], ['TRANSFER_NOT_FOUND', 'P0001', 404], ['FORBIDDEN', '42501', 403], ['private SQL details', 'XX000', 503]]) {
  sqlError = { message, code }; response = await note(); assert.equal(response.status, status); assert(!(await response.text()).includes('private SQL'));
}
console.log('OK: unified SAN/PHI/GIAI/no-code/ambiguous receipts, auth-before-write, exact notification behavior, 200 skips/401 auth/500 DB and private session note contracts.');
