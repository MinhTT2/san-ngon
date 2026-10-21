// Provider and worker contracts with isolated mocks; never contacts a real recipient.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { NextResponse } from 'next/server.js';
const require = createRequire(import.meta.url);
async function load(path, mocks = {}, globals = {}) {
  const context = { exports: {}, console: { error() {} }, Buffer, AbortSignal, ...globals, require: name => name in mocks ? mocks[name] : require(name) };
  vm.runInNewContext(ts.transpileModule(await readFile(new URL('../' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.exports;
}
const sends = [];
const delivery = await load('lib/notification-delivery.ts', { '@/lib/notify': {
  sendEmail: async (...args) => { sends.push(['email', ...args]); return { ok: true }; },
  sendTelegram: async (...args) => { sends.push(['telegram', ...args]); return { ok: true }; },
  ownerApplicationEmail: (status, reason) => ({ subject: status, html: reason }),
  ownerBookingEmail: () => '<p>Fixture</p>', ownerBookingMessage: () => 'Fixture',
} });
const job = { id: 'fixture-id', lease_id: 'fixture-lease', channel: 'email', kind: 'booking', destination: 'fixture@example.invalid', payload: { code: 'SANABC234', venue_name: 'Fixture', court_name: 'Court', starts_at: '2026-10-21T03:00:00+00:00', ends_at: '2026-10-21T04:00:00+00:00', total_amount: 100000, deposit_amount: 100000, customer_name: null, customer_phone: '0900000000' } };
assert((await delivery.deliverNotification(job)).ok); assert.equal(sends.at(-1).at(-1), 'notification/fixture-id');
assert((await delivery.deliverNotification({ ...job, channel: 'telegram' })).ok);
assert((await delivery.deliverNotification({ ...job, kind: 'owner_review', payload: { status: 'rejected', reason: 'Bổ sung giấy tờ' } })).ok);
assert.equal(sends.at(-1)[3], 'Bổ sung giấy tờ');
assert.equal((await delivery.deliverNotification({ ...job, payload: {} })).reason, 'INVALID_PAYLOAD');
assert.equal((await delivery.deliverNotification({ ...job, kind: 'owner_review', channel: 'telegram', payload: {} })).reason, 'INVALID_PAYLOAD');
const providerCalls = [];
let providerMode = 'ok';
const notify = await load('lib/notify.ts', { './format': { vnd: String } }, { process: { env: { RESEND_API_KEY: 'fixture', EMAIL_FROM: 'fixture@example.invalid', TELEGRAM_BOT_TOKEN: 'fixture' } }, fetch: async (url, init) => {
  providerCalls.push({ url, init }); assert(init.signal instanceof AbortSignal);
  if (providerMode === 'network') throw new Error('secret and email must never appear in logs');
  if (providerMode === 'invalid') return new Response('{}');
  if (providerMode === '429') return new Response('{}', { status: 429 });
  return new Response(JSON.stringify(url.includes('telegram') ? { ok: true, result: { message_id: 1 } } : { id: 'fixture-email' }));
} });
assert((await notify.sendEmail('fixture@example.invalid', 'Test', 'Fixture', 'notification/fixture')).ok);
assert.equal(providerCalls.at(-1).init.headers['Idempotency-Key'], 'notification/fixture');
assert((await notify.sendTelegram('12345', 'Fixture')).ok);
providerMode = 'invalid'; assert.equal((await notify.sendEmail('fixture', 'Test', '')).reason, 'INVALID_RESPONSE');
assert.equal((await notify.sendTelegram('12345', 'Fixture')).reason, 'INVALID_RESPONSE');
providerMode = '429'; assert.equal((await notify.sendTelegram('12345', 'Fixture')).reason, 'HTTP_429');
providerMode = 'network'; assert.equal((await notify.sendEmail('fixture', 'Test', '')).reason, 'NETWORK');
let sqlError = false, ackError = false, providerOK = true, dbCount = 0;
const db = { rpc: async (name, args) => {
  dbCount++;
  if (name === 'claim_notification_deliveries') return { data: [job], error: sqlError ? { message: 'private SQL' } : null };
  assert.equal(args.p_id, job.id); assert.equal(args.p_lease_id, job.lease_id); assert.equal(args.p_ok, providerOK);
  return { data: !ackError, error: null };
} };
const worker = await load('app/api/sepay/notifications/route.ts', {
  'next/server': { NextResponse }, '@/lib/supabase/admin': { createAdminClient: () => db },
  '@/lib/notification-delivery': { deliverNotification: async () => ({ ok: providerOK, reason: providerOK ? undefined : 'NETWORK' }) },
}, { process: { env: { NOTIFICATION_WORKER_SECRET: 'fixture-worker-secret-at-least-32-characters' } } });
const request = auth => new Request('http://fixture.invalid/api/sepay/notifications', { method: 'POST', headers: auth ? { authorization: 'Bearer ' + auth } : {} });
assert.equal((await worker.POST(request())).status, 401); assert.equal(dbCount, 0);
assert.equal((await worker.POST(request('wrong'))).status, 401); assert.equal(dbCount, 0);
const auth = 'fixture-worker-secret-at-least-32-characters';
let response = await worker.POST(request(auth)); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { sent: 1, failed: 0 });
providerOK = false; response = await worker.POST(request(auth)); assert.deepEqual(await response.json(), { sent: 0, failed: 1 });
ackError = true; assert.equal((await worker.POST(request(auth))).status, 503); ackError = false;
sqlError = true; response = await worker.POST(request(auth)); assert.equal(response.status, 503); assert(!(await response.text()).includes('private SQL'));
console.log('OK: private worker authentication, bounded providers, email idempotency, invalid responses, stable payloads, failures and lost acknowledgement.');
