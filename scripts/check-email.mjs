import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Kiểm tra hợp đồng gửi thư, không gửi email thật hay cần API key.
const dir = await mkdtemp(join(tmpdir(), 'san-ngon-email-check-'));
const originalFetch = globalThis.fetch;
const originalError = console.error;
const originalEnv = { RESEND_API_KEY: process.env.RESEND_API_KEY, EMAIL_FROM: process.env.EMAIL_FROM };
try {
  for (const name of ['notify', 'format', 'constants']) {
    const source = await readFile(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8');
    await writeFile(join(dir, `${name}.js`), ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText);
  }
  const { sendEmail, ownerBookingEmail } = createRequire(import.meta.url)(join(dir, 'notify.js'));
  globalThis.fetch = async () => { throw new Error('Không được gọi mạng khi thiếu cấu hình.'); };
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  assert.deepEqual(await sendEmail('owner@example.com', 'Test', '<p>Test</p>'), { ok: false, reason: 'NOT_CONFIGURED' });
  process.env.RESEND_API_KEY = 'test-key';
  assert.deepEqual(await sendEmail('owner@example.com', 'Test', '<p>Test</p>'), { ok: false, reason: 'NOT_CONFIGURED' });
  process.env.EMAIL_FROM = 'San Ngon <no-reply@example.com>';
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, 'Bearer test-key');
    assert.ok(init.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(init.body), {
      from: process.env.EMAIL_FROM, to: 'owner@example.com', subject: 'Test', html: '<p>Test</p>',
    });
    return new Response('{"id":"test"}', { status: 200 });
  };
  assert.deepEqual(await sendEmail('owner@example.com', 'Test', '<p>Test</p>'), { ok: true });
  console.error = () => {};
  globalThis.fetch = async () => new Response('Forbidden', { status: 403 });
  assert.deepEqual(await sendEmail('owner@example.com', 'Test', '<p>Test</p>'), { ok: false, reason: 'HTTP_403' });
  globalThis.fetch = async () => { throw new DOMException('Timed out', 'TimeoutError'); };
  assert.deepEqual(await sendEmail('owner@example.com', 'Test', '<p>Test</p>'), { ok: false, reason: 'NETWORK' });
  const html = ownerBookingEmail({ customer_name: '<script>alert(1)</script>', venue_name: 'A & B' });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('A &amp; B'));
  console.log('PASS: thiếu cấu hình, payload, lỗi nhà cung cấp, timeout và HTML escaping. Không gửi thư thật.');
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalError;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(dir, { recursive: true, force: true });
}
