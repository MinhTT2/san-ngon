// Local app, isolated headless contexts and disposable fixtures only.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile } from 'node:fs/promises';
import { createServerClient } from '@supabase/ssr';
import { chromium } from 'playwright';

assert.equal(process.env.RUN_ADMIN_DELETE_VENUE_E2E, '1', 'Explicitly enable disposable fixture creation.');
process.loadEnvFile('.env.local');
const origin = process.argv[2] ?? 'http://localhost:3191';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const project = (await readFile('supabase/.temp/project-ref', 'utf8')).trim();
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, `${project}.supabase.co`);
const run = randomUUID().slice(0, 8), password = randomBytes(24).toString('hex');
const users = ['admin', 'player'].map(role => ({ role, id: randomUUID(), email: `delete-venue-${run}-${role}@example.invalid` }));
const fixtures = [1440, 390].map(width => ({ width, venue: randomUUID(), court: randomUUID(), name: `Xóa sân E2E ${run} ${width}` }));
const blocked = { venue: randomUUID(), court: randomUUID(), booking: randomUUID(), name: `Giữ lịch sử E2E ${run}` };
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const execute = promisify(execFile);
async function sql(query) {
  try {
    const { stdout } = await execute('npx', ['supabase', 'db', 'query', '--linked', '--output', 'json', query], { maxBuffer: 4 * 1024 * 1024 });
    const result = JSON.parse(stdout);
    return result.rows ?? result;
  } catch (error) {
    throw new Error(String(error.stdout || error.stderr || error.message || 'Database unavailable').replaceAll(password, '[redacted]'));
  }
}
const screenshots = 'output/admin-delete-venue';
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const contexts = [], errors = [];
try {
  await sql(`begin;
    insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change_token,phone_change,reauthentication_token,created_at,updated_at)
    values ${users.map(user => `(${quote(user.id)},'00000000-0000-0000-0000-000000000000','authenticated','authenticated',${quote(user.email)},extensions.crypt(${quote(password)},extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}',${quote(JSON.stringify({ full_name: `Delete venue ${user.role}` }))},'','','','','','','','',now(),now())`).join(',')};
    insert into auth.identities(id,user_id,provider_id,identity_data,provider,created_at,updated_at)
    values ${users.map(user => `(gen_random_uuid(),${quote(user.id)},${quote(user.id)},${quote(JSON.stringify({ sub: user.id, email: user.email, email_verified: true }))},'email',now(),now())`).join(',')};
    update profiles set role='admin' where id=${quote(users[0].id)};
    insert into venues(id,owner_id,name,slug,address,district,status,open_time,close_time)
    values ${[...fixtures, blocked].map((fixture, index) => `(${quote(fixture.venue)},${quote(users[1].id)},${quote(fixture.name)},${quote(`delete-venue-${run}-${index}`)},'Địa chỉ kiểm tra','Hòa Lạc','draft','06:00','23:00')`).join(',')};
    insert into courts(id,venue_id,name,sport)
    values ${[...fixtures, blocked].map(fixture => `(${quote(fixture.court)},${quote(fixture.venue)},'Sân E2E','badminton')`).join(',')};
    set local session_replication_role=replica;
    insert into bookings(id,code,court_id,user_id,starts_at,ends_at,total_amount,deposit_amount,status,customer_phone)
    values(${quote(blocked.booking)},${quote(`SANE2E${run.toUpperCase()}`)},${quote(blocked.court)},${quote(users[1].id)},now()+interval '5 days',now()+interval '5 days 1 hour',100000,100000,'cancelled','0900000003');
    commit;`);
  const pages = {};
  for (const user of users) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'vi-VN' });
    contexts.push(context);
    const cookies = [];
    const auth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: { getAll: () => cookies, setAll: values => cookies.push(...values) },
    });
    const { error } = await auth.auth.signInWithPassword({ email: user.email, password });
    assert.equal(error, null);
    await context.addCookies(cookies.map(cookie => ({ name: cookie.name, value: cookie.value, url: origin, sameSite: 'Lax' })));
    pages[user.role] = await context.newPage();
    pages[user.role].on('pageerror', error => errors.push(error.message));
  }
  const { admin, player } = pages;
  await admin.goto(`${origin}/tim-san`);
  for (const district of ['Hòa Lạc', 'Thạch Thất']) assert.equal(await admin.locator('#district option').filter({ hasText: district }).count(), 1);
  await admin.locator('#district').selectOption('Hòa Lạc');
  await admin.locator('#district').evaluate(select => select.form.requestSubmit());
  await admin.waitForURL(url => url.searchParams.get('district') === 'Hòa Lạc');
  console.log('OK: both new districts appear and the search filter accepts Hòa Lạc.');
  await player.goto(`${origin}/`);
  const forbidden = await player.evaluate(async id => (await fetch(`/api/admin/venues/${id}`, { method: 'DELETE' })).status, fixtures[0].venue);
  assert.equal(forbidden, 403);
  const wrongOrigin = await admin.request.delete(`${origin}/api/admin/venues/${fixtures[0].venue}`, { headers: { origin: 'https://untrusted.example' } });
  assert.equal(wrongOrigin.status(), 403);
  const invalid = await admin.request.delete(`${origin}/api/admin/venues/not-a-uuid`, { headers: { origin } });
  assert.equal(invalid.status(), 400);
  console.log('OK: non-admin, foreign origin and invalid identifiers are rejected.');
  for (const fixture of fixtures) {
    await admin.setViewportSize({ width: fixture.width, height: 1000 });
    await admin.goto(`${origin}/admin?view=venues`);
    const button = admin.getByRole('button', { name: `Xóa sân: ${fixture.name}`, exact: true });
    await button.waitFor();
    await admin.screenshot({ path: `${screenshots}/venues-${fixture.width}.png`, fullPage: true });
    assert(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
    await button.click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Quay lại', exact: true }).click();
    assert(await button.isVisible(), 'Dismissing confirmation keeps venue');
    const deleted = admin.waitForResponse(response => response.url().endsWith(`/api/admin/venues/${fixture.venue}`) && response.request().method() === 'DELETE');
    await button.click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Xác nhận xóa', exact: true }).click();
    assert.equal((await deleted).status(), 204);
    await button.waitFor({ state: 'detached' });
    const rows = await sql(`select count(*)::int as count from venues where id=${quote(fixture.venue)};`);
    assert.equal(rows[0].count, 0);
    console.log(`OK: ${fixture.width}px confirmation, deletion and list refresh.`);
  }
  const historyButton = admin.getByRole('button', { name: `Xóa sân: ${blocked.name}`, exact: true });
  await historyButton.click();
  await admin.getByRole('dialog').getByText(/kể cả đã có thanh toán/).waitFor();
  await admin.waitForFunction(() => {
    const panel = document.querySelector('[data-modal-panel]');
    return panel && getComputedStyle(panel).opacity === '1';
  });
  await admin.screenshot({ path: `${screenshots}/history-confirmation-390.png`, fullPage: true });
  const historyDeleted = admin.waitForResponse(response => response.url().endsWith(`/api/admin/venues/${blocked.venue}`) && response.request().method() === 'DELETE');
  await admin.getByRole('dialog').getByRole('button', { name: 'Xác nhận xóa', exact: true }).click();
  assert.equal((await historyDeleted).status(), 204);
  await historyButton.waitFor({ state: 'detached' });
  const remaining = await sql(`select count(*)::int as count from bookings where id=${quote(blocked.booking)};`);
  assert.equal(remaining[0].count, 0);
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log('OK: admin can delete a venue with booking history after explicit confirmation.');
} finally {
  await Promise.all(contexts.map(context => context.close()));
  await browser.close();
  await sql(`begin;
    delete from bookings where id=${quote(blocked.booking)};
    delete from venues where id in (${[...fixtures, blocked].map(fixture => quote(fixture.venue)).join(',')});
    delete from auth.identities where user_id in (${users.map(user => quote(user.id)).join(',')});
    delete from auth.users where id in (${users.map(user => quote(user.id)).join(',')});
    commit;`);
  console.log('Disposable fixtures removed.');
}
