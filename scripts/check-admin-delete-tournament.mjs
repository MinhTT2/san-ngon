import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile } from 'node:fs/promises';
import { createServerClient } from '@supabase/ssr';

assert.equal(process.env.RUN_TOURNAMENT_E2E, '1', 'Set RUN_TOURNAMENT_E2E=1 to create disposable fixtures.');
process.loadEnvFile('.env.local');
const origin = process.argv[2] ?? 'http://localhost:3126';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const project = (await readFile('supabase/.temp/project-ref', 'utf8')).trim();
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, `${project}.supabase.co`);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const run = randomUUID().slice(0, 8), password = randomBytes(24).toString('hex');
const users = Object.fromEntries(['admin', 'owner', 'player'].map(role => [role, { id: randomUUID(), email: `delete-${run}-${role}@example.invalid` }]));
const pending = randomUUID(), published = randomUUID(), guarded = randomUUID(), venue = randomUUID(), court = randomUUID();
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const execute = promisify(execFile);
async function sql(query) {
  try {
    const { stdout } = await execute('npx', ['supabase', 'db', 'query', '--linked', '--output', 'json', query], { maxBuffer: 4 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Fixture SQL failed: ${String(error.stdout || error.stderr || error.message).replaceAll(password, '[redacted]')}`);
  }
}
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const contexts = [], pages = {}, errors = [];
const output = process.env.UX_SCREENSHOT_DIR ?? 'output/admin-delete-tournament';
await mkdir(output, { recursive: true });
try {
  await sql(`begin;
    insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change_token,phone_change,reauthentication_token,created_at,updated_at)
    values ${Object.entries(users).map(([role, user]) => `(${quote(user.id)},'00000000-0000-0000-0000-000000000000','authenticated','authenticated',${quote(user.email)},extensions.crypt(${quote(password)},extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}',${quote(JSON.stringify({ full_name: `Test xóa giải ${role}` }))},'','','','','','','','',now(),now())`).join(',')};
    insert into auth.identities(id,user_id,provider_id,identity_data,provider,created_at,updated_at)
    values ${Object.values(users).map(user => `(gen_random_uuid(),${quote(user.id)},${quote(user.id)},${quote(JSON.stringify({ sub: user.id, email: user.email, email_verified: true }))},'email',now(),now())`).join(',')};
    update profiles set role='admin' where id=${quote(users.admin.id)};
    update profiles set role='owner',owner_application_status='active' where id=${quote(users.owner.id)};
    insert into venues(id,owner_id,name,slug,address,district,open_time,close_time)
    values(${quote(venue)},${quote(users.owner.id)},'Sân kiểm tra xóa giải',${quote(`delete-${run}`)},'Địa chỉ kiểm tra Hà Nội','Cầu Giấy','06:00','23:00');
    insert into courts(id,venue_id,name,sport) values(${quote(court)},${quote(venue)},'Sân thử','badminton');
    insert into tournaments(id,manager_id,court_id,title,description,sport,address,starts_at,ends_at,registration_deadline,payment_deadline,capacity,entry_fee,deposit_amount,status)
    values ${[[pending, 'pending', 10], [published, 'published', 11], [guarded, 'published', 12]].map(([id, status, days]) => `(${quote(id)},${quote(users.owner.id)},${quote(court)},${quote(`Giải test xóa ${run} ${status} ${days}`)},'Thể lệ kiểm tra đủ dài','badminton','Địa chỉ kiểm tra Hà Nội',now()+interval '${days} days',now()+interval '${days} days 2 hours',now()+interval '9 days',now()+interval '10 days',10,0,0,${quote(status)})`).join(',')};
    insert into court_closures(court_id,starts_at,ends_at,reason,tournament_id)
    select court_id,starts_at,ends_at,'Giải đấu test',id from tournaments where id in (${quote(published)},${quote(guarded)});
    insert into tournament_settlements(tournament_id,owner_id,venue_fee,agreed_at,due_at)
    select id,manager_id,case when id=${quote(guarded)} then 10000 else 0 end,now(),ends_at+interval '7 days'
    from tournaments where id in (${quote(published)},${quote(guarded)});
    commit;`);
  for (const [role, user] of Object.entries(users)) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
    contexts.push(context);
    const cookies = [];
    const auth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => cookies, setAll: values => cookies.push(...values) } });
    const { error } = await auth.auth.signInWithPassword({ email: user.email, password });
    assert.equal(error, null, `${role}: fixture sign-in`);
    await context.addCookies(cookies.map(cookie => ({ name: cookie.name, value: cookie.value, url: origin, sameSite: 'Lax' })));
    pages[role] = await context.newPage();
    pages[role].on('pageerror', error => errors.push(error.message));
  }
  const { admin, owner, player } = pages;
  for (const page of [owner, player]) {
    await page.goto(`${origin}/giai-dau/${published}`);
    assert.equal(await page.getByRole('button', { name: 'Xóa giải đấu', exact: true }).count(), 0);
    const response = await page.request.post(`${origin}/api/tournaments`, { headers: { origin }, data: { action: 'delete', id: published } });
    assert.equal(response.status(), 400);
    assert.equal((await response.json()).error, 'Bạn không có quyền thực hiện thao tác này.');
  }
  const anonymous = await browser.newContext(); contexts.push(anonymous);
  assert.equal((await anonymous.request.post(`${origin}/api/tournaments`, { headers: { origin }, data: { action: 'delete', id: pending } })).status(), 401);
  assert.equal((await admin.request.post(`${origin}/api/tournaments`, { headers: { origin: 'https://example.invalid' }, data: { action: 'delete', id: pending } })).status(), 403);
  assert.equal((await admin.request.post(`${origin}/api/tournaments`, { headers: { origin }, data: { action: 'delete', id: 'invalid' } })).status(), 400);
  await admin.goto(`${origin}/admin/giai-dau?status=pending`);
  const pendingCard = admin.getByRole('row').filter({ hasText: `Giải test xóa ${run} pending 10` });
  await pendingCard.locator('summary').click();
  await pendingCard.getByRole('button', { name: 'Xóa giải đấu', exact: true }).waitFor();
  let deletionRequests = 0;
  admin.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/tournaments')) deletionRequests++; });
  await pendingCard.getByRole('button', { name: 'Xóa giải đấu', exact: true }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Quay lại', exact: true }).click();
  assert.equal(deletionRequests, 0, 'Dismissing confirmation must not send a deletion.');
  await admin.screenshot({ path: `${output}/admin-list-1440.png`, fullPage: true });
  await admin.setViewportSize({ width: 390, height: 844 });
  await admin.screenshot({ path: `${output}/admin-list-390.png`, fullPage: true });
  assert(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await admin.goto(`${origin}/giai-dau/${guarded}`);
  await admin.getByRole('button', { name: 'Xóa giải đấu', exact: true }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Xác nhận xóa', exact: true }).click();
  await admin.getByRole('alert').filter({ hasText: 'Cần giữ hồ sơ để đối soát' }).waitFor();
  assert.equal(new URL(admin.url()).pathname, `/giai-dau/${guarded}`);
  await admin.goto(`${origin}/giai-dau/${pending}`);
  await admin.getByRole('button', { name: 'Xóa giải đấu', exact: true }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Xác nhận xóa', exact: true }).click();
  await admin.waitForURL(`${origin}/admin/giai-dau`);
  await admin.goto(`${origin}/admin/giai-dau?status=published`);
  const publishedCard = admin.getByRole('listitem').filter({ hasText: `Giải test xóa ${run} published 11` });
  await publishedCard.locator('summary').click();
  await publishedCard.getByRole('button', { name: 'Xóa giải đấu', exact: true }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Xác nhận xóa', exact: true }).click();
  await publishedCard.waitFor({ state: 'detached' });
  const [state] = await sql(`select
    not exists(select 1 from tournaments where id in (${quote(pending)},${quote(published)})) as deleted,
    not exists(select 1 from court_closures where tournament_id=${quote(published)}) as released,
    exists(select 1 from tournaments where id=${quote(guarded)}) as preserved;`);
  assert.deepEqual(state, { deleted: true, released: true, preserved: true });
  assert.equal((await admin.request.get(`${origin}/giai-dau/${pending}`)).status(), 404);
  assert.deepEqual(errors, []);
  console.log('OK: admin deletion from list/detail, confirmation dismissal, financial guard, player/owner/API permissions, 390/1440px layouts and released court.');
} finally {
  try {
    await sql(`begin;
      update tournaments set status='cancelled' where id in (${quote(pending)},${quote(published)},${quote(guarded)});
      delete from court_closures where tournament_id in (${quote(pending)},${quote(published)},${quote(guarded)});
      delete from notifications where tournament_id in (${quote(pending)},${quote(published)},${quote(guarded)}) or user_id in (${Object.values(users).map(u => quote(u.id)).join(',')});
      delete from tournament_settlements where tournament_id in (${quote(pending)},${quote(published)},${quote(guarded)});
      delete from tournaments where id in (${quote(pending)},${quote(published)},${quote(guarded)});
      delete from courts where id=${quote(court)};
      delete from venues where id=${quote(venue)};
      delete from auth.users where id in (${Object.values(users).map(u => quote(u.id)).join(',')});
      commit;`);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    await browser.close();
  }
}
