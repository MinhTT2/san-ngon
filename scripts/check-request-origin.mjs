// Runs the real boundary with a counted auth mock; no live credentials or writes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { NextRequest, NextResponse } from 'next/server.js';
import { isAllowedWriteRequest } from '../lib/request-origin.ts';
const require = createRequire(import.meta.url);
let authCalls = 0;
const sandbox = {
  exports: {}, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'http://fixture.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture' } },
  URL,
  require(name) {
    if (name === '@/lib/request-origin') return { isAllowedWriteRequest };
    if (name === '@/lib/safe-next') return { safeNext: () => '/' };
    if (name === 'next/server') return { NextRequest, NextResponse };
    if (name === '@supabase/ssr') return { createServerClient: () => ({
      auth: { getUser: async () => { authCalls++; return { data: { user: null } }; } },
    }) };
    return require(name);
  },
};
vm.runInNewContext(ts.transpileModule(await readFile(new URL('../middleware.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, sandbox);
const origin = 'https://san-ngon.example';
async function check(path, method, headers, allowed) {
  const before = authCalls;
  const response = await sandbox.exports.middleware(new NextRequest(origin + path, { method, headers }));
  assert.equal(response.status, allowed ? 200 : 403, `${method} ${path} ${JSON.stringify(headers)}`);
  assert.equal(authCalls - before, allowed ? 1 : 0, 'rejected writes never reach auth or database');
}
for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
  for (const path of ['/api/bookings', '/api/profile', '/api/admin/users', '/api/courts/test', '/auth/dang-xuat', '/new-write-route']) {
    await check(path, method, { origin }, true);
    for (const bad of ['https://untrusted.example', 'https://other.san-ngon.example', 'http://san-ngon.example', origin + ':444', 'null', 'bad', origin + '/', origin + '/path', 'https://user:pass@san-ngon.example']) {
      await check(path, method, { origin: bad }, false);
    }
    await check(path, method, {}, false);
    await check(path, method, { origin, 'sec-fetch-site': 'cross-site' }, false);
    await check(path, method, { origin: 'https://untrusted.example', 'x-forwarded-host': 'untrusted.example', 'x-forwarded-proto': 'https' }, false);
  }
}
for (const method of ['GET', 'HEAD', 'OPTIONS']) await check('/api/bookings', method, {}, true);
for (const path of ['/api/webhooks/sepay', '/api/webhooks/telegram']) {
  await check(path, 'POST', {}, true);
  await check(path + '/extra', 'POST', {}, false);
  await check(path, 'DELETE', {}, false);
}
assert(isAllowedWriteRequest(new Request('http://127.0.0.1:3000/api/profile', { method: 'PATCH', headers: { origin: 'http://localhost:3000', host: 'localhost:3000' } })), 'browser-facing Host with local port works');
console.log('OK: write boundary rejects foreign/null/missing origins before auth, keeps exact key-authenticated webhook POSTs and allows same-origin writes and reads.');

let privilegedCalls = 0;
const webhook = {
  exports: {}, process: { env: {} },
  require(name) {
    if (name === 'next/server') return { NextRequest, NextResponse };
    if (name === '@/lib/supabase/admin') return { createAdminClient: () => { privilegedCalls++; throw new Error('Unexpected privileged client'); } };
    if (name.startsWith('@/lib/')) return {};
    return require(name);
  },
};
vm.runInNewContext(ts.transpileModule(await readFile(new URL('../app/api/webhooks/sepay/route.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, webhook);
for (const suffix of ['', '?connection=bad', '?connection=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']) {
  assert.equal((await webhook.exports.POST(new NextRequest(origin + '/api/webhooks/sepay' + suffix, { method: 'POST' }))).status, 401);
}
assert.equal(privilegedCalls, 0, 'unauthenticated webhooks never initialize service role');
console.log('OK: missing/invalid webhook credentials return 401 without requiring a service role key.');
