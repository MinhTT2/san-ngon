// Creates two disposable Auth fixtures; deletes them and their activity in finally.
// RUN_TRAFFIC_E2E=1 node scripts/check-admin-traffic.mjs /tmp/san-ngon-traffic.<isolated-build>
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { createServerClient } from '@supabase/ssr';
import { chromium } from 'playwright';

assert.equal(process.env.RUN_TRAFFIC_E2E, '1', 'explicit fixture opt-in required');
process.loadEnvFile('.env.local');
const build = process.argv[2];
assert(build?.startsWith('/tmp/san-ngon-traffic.'), 'requires an isolated production build');
const project = (await readFile('supabase/.temp/project-ref', 'utf8')).trim();
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, `${project}.supabase.co`);
const execute = promisify(execFile);
const require = createRequire(import.meta.url);
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const password = randomBytes(24).toString('hex');
const users = Object.fromEntries(['admin', 'player'].map(role => [role, { id: randomUUID(), email: `traffic-${randomUUID()}@example.invalid` }]));
const servers = [], contexts = [], browserErrors = [];
let browser;
async function sql(query) {
  try {
    const { stdout } = await execute('npx', ['supabase', 'db', 'query', '--linked', '--output', 'json', query], { maxBuffer: 4 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Fixture SQL failed: ${String(error.stderr || error.stdout || 'query failed').replaceAll(password, '[redacted]')}`);
  }
}
async function server(mode) {
  const socket = createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['--import', new URL('./fixtures/ga4-fetch.mjs', import.meta.url).href, require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: build, stdio: ['ignore', 'pipe', 'pipe'], env: {
      PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'production', VERCEL_ENV: 'production',
      RUN_TRAFFIC_E2E: '1', GA4_FIXTURE_MODE: mode,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_SITE_URL: origin,
    },
  });
  servers.push(child);
  let logs = '';
  child.stdout.on('data', chunk => { logs += chunk; });
  child.stderr.on('data', chunk => { logs += chunk; });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (logs.includes('Ready in')) return origin;
    if (child.exitCode !== null) throw new Error('isolated server failed to start');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('isolated server startup timeout');
}
async function context(origin, role) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Ho_Chi_Minh', reducedMotion: 'reduce', serviceWorkers: 'block' });
  contexts.push(context);
  await context.route(/https:\/\/[^/]*(google-analytics|googletagmanager)\.com\//, route => route.abort('blockedbyclient'));
  if (role) {
    const cookies = [];
    const auth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => cookies, setAll: values => cookies.push(...values) } });
    const { error } = await auth.auth.signInWithPassword({ email: users[role].email, password });
    assert.equal(error, null, `${role} signs in with fixture credentials`);
    await context.addCookies(cookies.map(cookie => ({ name: cookie.name, value: cookie.value, url: origin, sameSite: 'Lax' })));
  }
  const page = await context.newPage();
  page.on('pageerror', error => browserErrors.push(error.message));
  return { context, page };
}
async function waitFor(check, message) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(message);
}

try {
  await sql(`begin;
    insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change_token,phone_change,reauthentication_token,created_at,updated_at)
    values ${Object.entries(users).map(([role, user]) => `(${quote(user.id)},'00000000-0000-0000-0000-000000000000','authenticated','authenticated',${quote(user.email)},extensions.crypt(${quote(password)},extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}',${quote(JSON.stringify({ full_name: `Activity fixture ${role}` }))},'','','','','','','','',now(),now())`).join(',')};
    insert into auth.identities(id,user_id,provider_id,identity_data,provider,created_at,updated_at)
    values ${Object.values(users).map(user => `(gen_random_uuid(),${quote(user.id)},${quote(user.id)},${quote(JSON.stringify({ sub: user.id, email: user.email, email_verified: true }))},'email',now(),now())`).join(',')};
    update profiles set role='admin' where id=${quote(users.admin.id)};
    commit;`);
  const configured = await server('configured');
  const unconfigured = await server('unconfigured');
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  await mkdir('output/usage', { recursive: true });
  const anonymous = await context(configured);
  await anonymous.page.goto(`${configured}/admin/thong-ke-truy-cap`);
  assert.equal(new URL(anonymous.page.url()).pathname, '/dang-nhap');
  assert.equal((await anonymous.context.request.post(`${configured}/api/activity`, { headers: { Origin: configured }, data: { session_id: randomUUID(), active: true } })).status(), 401);

  const player = await context(configured, 'player');
  const activity = [];
  player.page.on('request', request => { if (request.url().endsWith('/api/activity')) activity.push(request.postDataJSON()); });
  await player.page.clock.install();
  await player.page.goto(`${configured}/tro-giup`);
  await player.page.bringToFront();
  await waitFor(() => activity.some(item => item.active), 'active heartbeat missing');
  await waitFor(async () => {
    const result = await sql(`select count(*)::int as n from public.user_activity_totals where user_id=${quote(users.player.id)} and is_active;`);
    return result[0].n === 1;
  }, 'server never recorded player activity');
  await player.page.clock.fastForward(300001);
  await waitFor(() => activity.at(-1)?.active === false, 'idle does not stop usage');
  const beforeIdle = activity.length;
  await player.page.clock.fastForward(90000);
  assert.equal(activity.length, beforeIdle, 'idle does not keep sending heartbeats');
  await player.page.mouse.click(300, 200);
  await waitFor(() => activity.at(-1)?.active === true, 'input does not restart usage');
  const secondTab = await player.context.newPage();
  await secondTab.goto(`${configured}/lien-he`);
  await secondTab.bringToFront();
  // Headless Chromium keeps every page visible/focused. Drive browser lifecycle
  // signals explicitly; SQL separately verifies the concurrent-session lease.
  await player.page.evaluate(() => {
    Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false });
    window.dispatchEvent(new Event('blur'));
  });
  await waitFor(() => activity.at(-1)?.active === false, 'blur does not stop usage');
  await player.page.evaluate(() => {
    delete document.hasFocus;
    window.dispatchEvent(new Event('focus'));
  });
  await waitFor(() => activity.at(-1)?.active === true, 'focus does not resume usage');
  await player.page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await waitFor(() => activity.at(-1)?.active === false, 'blur/hidden tab does not stop usage');
  await secondTab.close();
  await player.page.bringToFront();
  await player.page.evaluate(() => {
    delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await waitFor(() => activity.at(-1)?.active === true, 'focus does not resume usage');
  assert(activity.every(item => Object.keys(item).sort().join(',') === 'active,session_id'), 'browser never submits identity/time/page/input data');
  assert.equal((await player.context.request.post(`${configured}/api/activity`, { headers: { Origin: 'https://foreign.invalid' }, data: { session_id: randomUUID(), active: true } })).status(), 403);
  assert.equal((await player.context.request.post(`${configured}/api/activity`, { headers: { Origin: configured }, data: { session_id: randomUUID(), active: true, seconds: 999999, user_id: users.admin.id } })).status(), 400);
  await player.page.goto(`${configured}/admin/thong-ke-truy-cap`);
  assert.equal(new URL(player.page.url()).pathname, '/');

  const admin = await context(configured, 'admin');
  await admin.page.goto(`${configured}/admin/thong-ke-truy-cap`);
  assert(await admin.page.getByRole('heading', { name: 'Thống kê truy cập', exact: true }).isVisible());
  assert(await admin.page.getByRole('heading', { name: 'Nguồn truy cập', exact: true }).isVisible());
  assert(await admin.page.getByText('Organic Search', { exact: true }).isVisible());
  assert(await admin.page.getByText('1 phút', { exact: true }).isVisible());
  await admin.page.getByRole('link', { name: '7 ngày', exact: true }).click();
  await admin.page.waitForURL(url => url.searchParams.get('period') === '7');
  await admin.page.screenshot({ path: 'output/usage/traffic-desktop.png', fullPage: true });
  await admin.page.setViewportSize({ width: 390, height: 844 });
  assert(await admin.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await admin.page.screenshot({ path: 'output/usage/traffic-mobile.png', fullPage: true });
  await admin.page.goto(`${configured}/admin/users?q=${encodeURIComponent(users.player.email)}`);
  assert(await admin.page.getByText('Tổng thời gian sử dụng:', { exact: false }).isVisible());
  assert(await admin.page.getByText('Hoạt động gần nhất:', { exact: false }).isVisible());
  assert(await admin.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await admin.page.screenshot({ path: 'output/usage/users-mobile.png', fullPage: true });

  const missing = await context(unconfigured, 'admin');
  await missing.page.goto(`${unconfigured}/admin/thong-ke-truy-cap`);
  assert(await missing.page.getByRole('heading', { name: 'Chưa kết nối báo cáo Google Analytics' }).isVisible());
  assert.equal(await missing.page.getByText('Người dùng hoạt động', { exact: true }).count(), 0, 'missing configuration never appears as zero data');

  assert.equal((await player.context.request.post(`${configured}/auth/dang-xuat`, { headers: { Origin: configured }, maxRedirects: 0 })).status(), 303);
  assert.equal((await player.context.request.post(`${configured}/api/activity`, { headers: { Origin: configured }, data: { session_id: randomUUID(), active: true } })).status(), 401);
  assert.deepEqual(browserErrors, []);
  console.log('PASS: real Auth/API/SQL activity, idle/focus/multiple tabs/logout, malicious body/origin denied, admin/player/guest report permissions, fake GA4 report and missing-config states, 7-day filter, desktop/mobile without overflow.');
} finally {
  for (const context of contexts) { await context.setOffline(true); await context.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); }
  await browser?.close();
  for (const child of servers) child.kill('SIGTERM');
  // Stop browser heartbeats before deleting fixtures; FK removes their usage totals.
  await sql(`delete from auth.users where id in (${Object.values(users).map(user => quote(user.id)).join(',')});`);
  const remaining = await sql(`select (select count(*) from auth.users where id in (${Object.values(users).map(user => quote(user.id)).join(',')}))::int as users,
    (select count(*) from public.user_activity_totals where user_id in (${Object.values(users).map(user => quote(user.id)).join(',')}))::int as activity;`);
  assert.deepEqual(remaining[0], { users: 0, activity: 0 });
  console.log('Fixture cleanup verified: 0 Auth users and 0 usage totals remain.');
}
