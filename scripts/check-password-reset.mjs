// node scripts/check-password-reset.mjs — exercises the form without sending mail.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { authHref, safeNext } = await import('../lib/safe-next.ts');
let returnPath = '/don-cua-toi';
const source = await readFile(new URL('../components/password-reset-form.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
let states = [], cursor = 0, calls = [], response = { error: null }, disconnected = false;
const auth = {
  resetPasswordForEmail: async (...args) => { calls.push(['request', ...args]); if (disconnected) throw Error('offline'); return response; },
  updateUser: async (...args) => { calls.push(['update', ...args]); if (disconnected) throw Error('offline'); return response; },
};
const sandbox = {
  exports: {}, window: { location: { origin: 'https://san-ngon.example' } },
  require(name) {
    if (name === 'react') return {
      useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
      useEffect() {},
    };
    if (name === '@/lib/safe-next') return { authHref, safeNext };
    if (name === '@/lib/supabase/client') return { createClient: () => ({ auth }) };
    if (name === 'next/link') return { default: 'a' };
    return require(name);
  },
};
vm.runInNewContext(code, sandbox);
function render(mode) { cursor = 0; return sandbox.exports.PasswordResetForm({ mode, next: returnPath }); }
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)]; }
function texts(tree) { return tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : Array.isArray(tree) ? tree.map(texts).join(' ') : texts(tree.props?.children); }
function input(mode, type, value, index = 0) { nodes(render(mode)).filter(node => node.type === 'input' && node.props.type === type)[index].props.onChange({ target: { value } }); }
async function submit(mode) { await nodes(render(mode)).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); }
function reset() { states = []; calls = []; response = { error: null }; disconnected = false; }

reset();
input('request', 'email', ' player@example.com ');
await submit('request');
assert.equal(calls[0][1], 'player@example.com');
const callbackURL = new URL(calls[0][2].redirectTo);
assert.equal(callbackURL.origin, 'https://san-ngon.example');
assert.equal(callbackURL.pathname, '/auth/callback');
assert.equal(callbackURL.searchParams.get('next'), '/dat-lai-mat-khau?next=%2Fdon-cua-toi');
assert.match(texts(render('request')), /Nếu email này có tài khoản/);
assert(nodes(render('request')).find(node => node.type === 'button').props.disabled, 'resend cooldown');

reset();
input('update', 'password', 'new-password-123');
input('update', 'password', 'different-password', 1);
await submit('update');
assert.equal(calls.length, 0, 'mismatched passwords must not reach provider');
assert.match(texts(render('update')), /chưa khớp/);
input('update', 'password', 'new-password-123', 1);
await submit('update');
assert.equal(calls[0][0], 'update');
assert.equal(calls[0][1].password, 'new-password-123');
assert.match(texts(render('update')), /Đã cập nhật mật khẩu/);
assert.equal(nodes(render('update')).filter(node => node.type === 'input').length, 0);

reset();
response = { error: { status: 401, code: 'session_not_found' } };
await submit('update');
assert.match(texts(render('update')), /Phiên đặt lại mật khẩu đã hết hạn/);
reset();
response = { error: { status: 429 } };
await submit('request');
assert.match(texts(render('request')), /quá nhiều lần/);
reset();
disconnected = true;
await submit('request');
assert.match(texts(render('request')), /Kiểm tra mạng/);
assert.equal(nodes(render('request')).find(node => node.type === 'button').props.disabled, false, 'retry enabled after failure');

for (const next of ['/san/san-cau-giay?ngay=2026-10-10&sport=badminton#lich', '/chu-san/don?status=pending', 'https://outside.invalid', '//outside.invalid', '/\\outside.invalid']) {
  reset(); returnPath = next;
  input('request', 'email', 'fixture@example.invalid');
  await submit('request');
  const callback = new URL(calls[0][2].redirectTo);
  const resetURL = new URL(callback.searchParams.get('next'), callback.origin);
  assert.equal(resetURL.pathname, '/dat-lai-mat-khau');
  assert.equal(resetURL.searchParams.get('next'), safeNext(next));
  for (const link of nodes(render('request')).filter(node => node.type === 'a')) {
    assert.equal(new URL(link.props.href, callback.origin).searchParams.get('next'), safeNext(next));
  }
  reset();
  input('update', 'password', 'new-password-123');
  input('update', 'password', 'new-password-123', 1);
  await submit('update');
  assert.equal(nodes(render('update')).find(node => node.type === 'a').props.href, safeNext(next));
}
const callbackSandbox = {
  exports: {}, console: { error() {} }, URL,
  require(name) {
    if (name === '@/lib/safe-next') return { authHref, safeNext };
    if (name === '@/lib/supabase/server') return { createClient: async () => ({ auth: { exchangeCodeForSession: async () => ({ error: response.error }) } }) };
    return require(name);
  },
};
vm.runInNewContext(ts.transpileModule(await readFile(new URL('../app/auth/callback/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, callbackSandbox);
const destination = '/san/san-cau-giay?ngay=2026-10-10&sport=badminton#lich';
for (const recovery of [false, true]) {
  const next = recovery ? authHref('/dat-lai-mat-khau', destination) : destination;
  for (const failure of [false, true]) {
    response = { error: failure ? { message: 'expired fixture' } : null };
    const result = await callbackSandbox.exports.GET(new Request(`https://san-ngon.example/auth/callback?code=fixture&next=${encodeURIComponent(next)}`));
    const url = new URL(result.headers.get('location'));
    assert.equal(url.origin, 'https://san-ngon.example');
    if (failure) {
      assert.equal(url.pathname, recovery ? '/quen-mat-khau' : '/dang-nhap');
      assert.equal(url.searchParams.get('next'), destination);
      assert.equal(url.searchParams.get('loi'), '1');
    } else assert.equal(url.pathname + url.search + url.hash, next);
  }
}
console.log('PASS: recovery redirect, generic receipt, resend cooldown, password mismatch, update success, expired session, rate limit, network retry. No email sent.');
