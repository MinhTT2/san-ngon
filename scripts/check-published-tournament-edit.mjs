import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile } from 'node:fs/promises';
import { createServerClient } from '@supabase/ssr';

assert.equal(process.env.RUN_TOURNAMENT_E2E, '1', 'Set RUN_TOURNAMENT_E2E=1 for disposable fixtures.');
process.loadEnvFile('.env.local');
const origin = process.argv[2] ?? 'http://localhost:3138';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const project = (await readFile('supabase/.temp/project-ref', 'utf8')).trim();
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, `${project}.supabase.co`);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const execute = promisify(execFile);
const run = randomUUID().slice(0, 8), password = randomBytes(24).toString('hex');
const users = Object.fromEntries(['owner', 'player'].map(role => [role, { id: randomUUID(), email: `edit-${run}-${role}@example.invalid` }]));
const venue = randomUUID(), court = randomUUID(), ownerTournament = randomUUID(), playerTournament = randomUUID();
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
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
await mkdir('output/published-tournament-edit', { recursive: true });
try {
  await sql(`begin;
    insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change_token,phone_change,reauthentication_token,created_at,updated_at)
    values ${Object.entries(users).map(([role, user]) => `(${quote(user.id)},'00000000-0000-0000-0000-000000000000','authenticated','authenticated',${quote(user.email)},extensions.crypt(${quote(password)},extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}',${quote(JSON.stringify({ full_name: `Test sửa giải ${role}` }))},'','','','','','','','',now(),now())`).join(',')};
    insert into auth.identities(id,user_id,provider_id,identity_data,provider,created_at,updated_at)
    values ${Object.values(users).map(user => `(gen_random_uuid(),${quote(user.id)},${quote(user.id)},${quote(JSON.stringify({ sub: user.id, email: user.email, email_verified: true }))},'email',now(),now())`).join(',')};
    update profiles set role='owner',owner_application_status='active',payout_bank='TestBank',payout_account='123456789' where id=${quote(users.owner.id)};
    insert into venues(id,owner_id,name,slug,address,district,open_time,close_time)
    values(${quote(venue)},${quote(users.owner.id)},'Sân thử sửa giải',${quote(`edit-${run}`)},'Địa chỉ kiểm tra Hà Nội','Cầu Giấy','06:00','23:00');
    update venues set status='active',images='{test1,test2,test3}' where id=${quote(venue)};
    insert into courts(id,venue_id,name,sport) values(${quote(court)},${quote(venue)},'Sân thử','badminton');
    insert into tournaments(id,manager_id,court_id,title,description,sport,address,starts_at,ends_at,registration_deadline,payment_deadline,capacity,entry_fee,deposit_amount,status)
    values ${[[ownerTournament, users.owner.id, 10], [playerTournament, users.player.id, 11]].map(([id, manager, days]) => `(${quote(id)},${quote(manager)},${quote(court)},${quote(`Giải sửa thử ${run}`)},'Thể lệ kiểm tra đủ dài và liên hệ ban tổ chức','badminton','Địa chỉ kiểm tra Hà Nội',date_trunc('minute',now()+interval '${days} days'),date_trunc('minute',now()+interval '${days} days 2 hours'),date_trunc('minute',now()+interval '8 days'),date_trunc('minute',now()+interval '9 days'),10,0,0,'published')`).join(',')};
    update tournaments set cancel_window_hours=0 where id=${quote(playerTournament)};
    insert into court_closures(court_id,starts_at,ends_at,reason,tournament_id)
    select court_id,starts_at,ends_at,'Giải đấu test',id from tournaments where id in (${quote(ownerTournament)},${quote(playerTournament)});
    insert into tournament_settlements(tournament_id,owner_id,venue_fee,agreed_at,due_at)
    select id,${quote(users.owner.id)},case when id=${quote(ownerTournament)} then 0 else 100000 end,now(),ends_at+interval '7 days'
    from tournaments where id in (${quote(ownerTournament)},${quote(playerTournament)});
    commit;`);
  for (const [role, user] of Object.entries(users)) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
    contexts.push(context);
    const cookies = [];
    const auth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => cookies, setAll: values => cookies.push(...values) } });
    assert.equal((await auth.auth.signInWithPassword({ email: user.email, password })).error, null);
    await context.addCookies(cookies.map(cookie => ({ name: cookie.name, value: cookie.value, url: origin, sameSite: 'Lax' })));
    pages[role] = await context.newPage();
    pages[role].on('pageerror', error => errors.push(error.message));
    pages[role].on('dialog', dialog => dialog.accept());
  }
  const { owner, player } = pages;
  async function openEditor(page, id) {
    await page.goto(`${origin}/giai-dau/${id}`);
    await page.getByRole('link', { name: 'Chỉnh sửa giải đấu', exact: true }).click();
    await page.getByRole('heading', { name: 'Chỉnh sửa giải đấu', exact: true }).waitFor();
    await page.evaluate(() => Promise.allSettled(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished)));
  }
  async function save(page, id) {
    const response = page.waitForResponse(response => response.url().endsWith('/api/tournaments') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    assert.equal((await response).status(), 200);
    await page.waitForURL(`${origin}/giai-dau/${id}`);
  }
  await openEditor(owner, ownerTournament);
  assert.equal(await owner.locator('select[name=sport]').isEnabled(), true);
  await owner.locator('[name=title]').fill('Giải sửa thành công trên desktop');
  await owner.screenshot({ path: 'output/published-tournament-edit/desktop.png', fullPage: true });
  await save(owner, ownerTournament);
  assert.equal((await sql(`select title,status from tournaments where id=${quote(ownerTournament)}`))[0].status, 'published');
  await player.goto(`${origin}/giai-dau/${ownerTournament}`);
  assert.equal(await player.getByRole('link', { name: 'Chỉnh sửa giải đấu', exact: true }).count(), 0);
  const registered = await player.request.post(`${origin}/api/tournaments`, { headers: { origin }, data: { action: 'register', id: ownerTournament, data: { full_name: 'Người thử đăng ký', phone: '0900000002', address: 'Hà Nội', team_name: '', note: '' } } });
  assert.equal(registered.status(), 200);
  await openEditor(owner, ownerTournament);
  assert.equal(await owner.locator('select[name=sport]').isDisabled(), true);
  assert.equal(await owner.locator('input[name=entry_fee]').getAttribute('readonly'), '');
  assert.equal(await owner.locator('input[name=court_id]').inputValue(), court);
  const fields = await owner.locator('form').evaluate(form => Object.fromEntries(new FormData(form)));
  const rejected = await owner.request.post(`${origin}/api/tournaments`, { headers: { origin }, data: { action: 'update', id: ownerTournament, data: { ...fields, entry_fee: 1000 } } });
  assert.equal(rejected.status(), 400);
  assert.match((await rejected.json()).error, /đã được chốt/);
  await owner.locator('textarea[name=description]').fill('Thông tin liên hệ mới sau khi có người đăng ký.');
  await save(owner, ownerTournament);
  await openEditor(player, playerTournament);
  assert.equal(await player.locator('select[name=court_id]').inputValue(), court);
  assert.equal(await player.locator('input[name=address]').inputValue(), 'Địa chỉ kiểm tra Hà Nội');
  assert.equal(await player.getByText('Tự hủy trước giờ bắt đầu được hoàn toàn bộ cọc;', { exact: false }).count(), 1, 'editor shows legacy policy');
  await player.setViewportSize({ width: 390, height: 844 });
  assert(await player.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile has no horizontal overflow');
  await player.locator('[name=title]').fill('Người đề xuất sửa giải trên mobile');
  await player.screenshot({ path: 'output/published-tournament-edit/mobile.png', fullPage: true });
  await save(player, playerTournament);
  const state = (await sql(`select (select count(*) from tournaments where id in (${quote(ownerTournament)},${quote(playerTournament)}) and status='published') as published,(select count(*) from tournament_registrations where tournament_id=${quote(ownerTournament)}) as registrations,(select count(*) from notifications where tournament_id=${quote(ownerTournament)} and user_id=${quote(users.player.id)} and title='Thông tin giải đấu đã cập nhật') as notices`))[0];
  assert.deepEqual(state, { published: 2, registrations: 1, notices: 1 });
  assert.deepEqual(errors, []);
  console.log('Published editor passed: desktop/mobile saves, locked fields, API guards, assigned court, registration retention and inbox notice.');
} finally {
  await Promise.all(contexts.map(context => context.close()));
  await browser.close();
  await sql(`begin;
    update tournaments set status='cancelled' where id in (${quote(ownerTournament)},${quote(playerTournament)});
    delete from court_closures where tournament_id in (${quote(ownerTournament)},${quote(playerTournament)});
    delete from notifications where tournament_id in (${quote(ownerTournament)},${quote(playerTournament)}) or user_id in (${Object.values(users).map(user => quote(user.id)).join(',')});
    delete from tournament_registrations where tournament_id in (${quote(ownerTournament)},${quote(playerTournament)});
    delete from tournament_settlements where tournament_id in (${quote(ownerTournament)},${quote(playerTournament)});
    delete from tournaments where id in (${quote(ownerTournament)},${quote(playerTournament)});
    delete from venues where id=${quote(venue)};
    delete from auth.users where id in (${Object.values(users).map(user => quote(user.id)).join(',')});
    commit;`);
}
