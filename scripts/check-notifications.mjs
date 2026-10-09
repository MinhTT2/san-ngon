// node scripts/check-notifications.mjs — no database writes or messages.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { NotificationSearchParams } from '../lib/search-params.ts';
import { requestOrigin } from '../lib/request-origin.ts';

const require = createRequire(import.meta.url);
let user = { id: 'player' }, calls = [], results = [];
const db = {
  auth: { getUser: async () => ({ data: { user } }) },
  from(table) {
    const result = results.shift();
    const chain = { then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) };
    for (const method of ['select', 'eq', 'is', 'order', 'range', 'update']) {
      chain[method] = (...args) => { calls.push([table, method, ...args]); return chain; };
    }
    return chain;
  },
};
async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const sandbox = { exports: {}, URL, URLSearchParams, FormData, require(name) {
    if (name === '@/lib/supabase/server') return { createClient: async () => db };
    if (name === '@/lib/search-params') return { NotificationSearchParams };
    if (name === '@/lib/request-origin') return { requestOrigin };
    if (name === '@/lib/format') return { dayLabel: () => '05/10', hhmm: () => '18:00', ymd: () => '2026-10-05' };
    if (name === '@/components/navigation-marker') return { NavigationMarker: 'span' };
    if (name === '@/components/notification-read-button') return { NotificationReadButton: 'button' };
    if (name === 'next/navigation') return { redirect: url => { throw Error(`redirect:${url}`); } };
    if (name === 'next/link') return { default: 'a' };
    return require(name);
  } };
  vm.runInNewContext(code, sandbox);
  return sandbox.exports;
}
const { default: Page } = await load('../app/(site)/thong-bao/page.tsx');
const { POST } = await load('../app/api/notifications/[id]/read/route.ts');
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)]; }
function texts(tree) { return tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : Array.isArray(tree) ? tree.map(texts).join(' ') : texts(tree.props?.children); }
const row = { id: 'notification', title: 'Đã nhận cọc', body: null, created_at: '2026-10-05T11:00:00Z', read_at: null, tournament_id: 'tournament', booking: null };
function reset(data = [row], count = 45, error = null) {
  calls = []; results = [{ data, count, error }, { count: 3, error: null }]; user = { id: 'player' };
}
const render = params => Page({ searchParams: Promise.resolve(params) });
for (const page of ['Infinity', '1.5', '-1', '2147483648', ['2', '3']]) {
  assert.equal(NotificationSearchParams.parse({ page }).page, 1);
}
assert.equal(NotificationSearchParams.parse({ status: ['unread', 'all'] }).status, 'all');

reset();
let tree = await render({ status: 'unread', page: '2' });
assert(calls.some(call => call[1] === 'range' && call[2] === 20 && call[3] === 39), 'bounded page');
assert.equal(calls.filter(call => call[1] === 'eq' && call[2] === 'user_id' && call[3] === 'player').length, 2);
assert.equal(calls.filter(call => call[1] === 'is' && call[2] === 'read_at' && call[3] === null).length, 2);
assert(calls.some(call => call[1] === 'order' && call[2] === 'id'), 'stable order for tied timestamps');
assert(nodes(tree).some(node => node.props?.href === '/thong-bao?status=unread&page=3'));
assert(nodes(tree).some(node => node.props?.href === '/giai-dau/tournament'));
assert(nodes(tree).some(node => node.type === 'input' && node.props.name === 'page' && node.props.value === 2));

reset([], 0);
assert.match(texts(await render({ status: 'unread' })), /đã đọc hết/);
reset([], 0);
await assert.rejects(render({ status: 'unread', page: '2' }), /redirect:\/thong-bao\?status=unread&page=1/);
reset(null, null, { code: 'PGRST103', message: 'Requested range not satisfiable' });
await assert.rejects(render({ status: 'unread', page: '2' }), /redirect:\/thong-bao\?status=unread&page=1/);
reset([], null, { message: 'offline' });
tree = await render({});
assert.match(texts(tree), /Chưa tải được/);
assert.doesNotMatch(texts(tree), /Chưa có thông báo nào/);
reset(); results[1].error = { message: 'offline' };
assert.match(texts(await render({})), /Chưa tải được/);
reset(); user = null;
await assert.rejects(render({ status: 'unread', page: '2' }), /next=%2Fthong-bao%3Fstatus%3Dunread%26page%3D2/);
assert.equal(calls.length, 0);

const origin = 'http://localhost:3100';
const request = (body, headers = {}) => new Request('http://0.0.0.0:3100/api/notifications/notification/read', {
  method: 'POST', headers: { host: 'localhost:3100', origin, ...headers }, body,
});
const params = { params: Promise.resolve({ id: 'notification' }) };
reset(); results = [{ error: null }];
let response = await POST(request(new URLSearchParams({ status: 'unread', page: '2' })), params);
assert.equal(response.status, 303);
assert.equal(response.headers.get('location'), origin + '/thong-bao?status=unread&page=2');
assert(calls.some(call => call[1] === 'eq' && call[2] === 'user_id' && call[3] === 'player'));
reset(); results = [{ error: null }];
response = await POST(request(new URLSearchParams({ status: '//evil.example', page: 'Infinity' })), params);
assert.equal(response.headers.get('location'), origin + '/thong-bao?status=all&page=1');
reset(); results = [{ error: null }];
assert.equal((await POST(request(null, { accept: 'application/json' }), params)).status, 200);
reset(); user = null;
assert.equal((await POST(request(null, { accept: 'application/json' }), params)).status, 401);
assert.equal(calls.length, 0);
reset();
assert.equal((await POST(request(null, { origin: 'https://evil.example' }), params)).status, 403);
assert.equal(calls.length, 0);
reset(); results = [{ error: { message: 'offline' } }];
assert.equal((await POST(request(null, { accept: 'application/json' }), params)).status, 500);
console.log('PASS: notification pagination/filter, user scope, links, empty/error states, login return, read return, auth/origin and failure. No database writes.');
