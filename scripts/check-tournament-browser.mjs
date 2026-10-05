import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile } from 'node:fs/promises';
import { createServerClient } from '@supabase/ssr';

assert.equal(process.env.RUN_TOURNAMENT_E2E, '1', 'Set RUN_TOURNAMENT_E2E=1 to create disposable fixtures in the linked Supabase project.');
process.loadEnvFile('.env.local');
const origin = process.argv[2] ?? 'http://localhost:3100';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Only run against a local app.');
const project = (await readFile('supabase/.temp/project-ref', 'utf8')).trim();
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, `${project}.supabase.co`, 'App and linked database must match.');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const run = randomUUID().replaceAll('-', '').slice(0, 12);
const password = randomBytes(24).toString('hex');
const account = `99${run.replace(/[a-f]/g, '8')}`;
const users = Object.fromEntries(['owner', 'player', 'manager', 'admin'].map(role => [role, { id: randomUUID(), email: `journey-${run}-${role}@example.invalid` }]));
const venueId = randomUUID(), courtId = randomUUID(), connectionId = randomUUID(), proposalId = randomUUID();
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const userIds = Object.values(users).map(user => quote(user.id)).join(',');
const execute = promisify(execFile);
async function sql(query) {
  try {
    const { stdout } = await execute('npx', ['supabase', 'db', 'query', '--linked', query], { maxBuffer: 8 * 1024 * 1024 });
    return JSON.parse(stdout).rows;
  } catch (error) {
    throw new Error(`Fixture SQL failed: ${String(error.stdout || error.stderr || 'connection unavailable').replaceAll(password, '[redacted]')}`);
  }
}
const output = process.env.UX_SCREENSHOT_DIR ?? 'output/tournament-journey';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const contexts = [], pages = {}, errors = [];
let tournamentId;
try {
  const [settings] = await sql('select multi_owner_enabled from booking_operator;');
  assert.equal(settings?.multi_owner_enabled, true, 'This check needs an eligible multi-owner test project. Do not enable the acceptance gate solely to run tests.');
  const rows = await sql(`begin;
    insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change_token,phone_change,reauthentication_token,created_at,updated_at)
    values ${Object.entries(users).map(([role, user]) => `(${quote(user.id)},'00000000-0000-0000-0000-000000000000','authenticated','authenticated',${quote(user.email)},extensions.crypt(${quote(password)},extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}',${quote(JSON.stringify({ full_name: `E2E ${role}` }))},'','','','','','','','',now(),now())`).join(',')};
    insert into auth.identities(id,user_id,provider_id,identity_data,provider,created_at,updated_at)
    values ${Object.values(users).map(user => `(gen_random_uuid(),${quote(user.id)},${quote(user.id)},${quote(JSON.stringify({ sub: user.id, email: user.email, email_verified: true }))},'email',now(),now())`).join(',')};
    update profiles set role='owner',owner_application_status='active',payout_bank='MB',payout_account=${quote(account)} where id=${quote(users.owner.id)};
    update profiles set role='admin' where id=${quote(users.admin.id)};
    insert into venues(id,owner_id,name,slug,address,district,status,open_time,close_time)
    values(${quote(venueId)},${quote(users.owner.id)},'Sân kiểm tra tự động',${quote(`journey-${run}`)},'Địa chỉ kiểm tra, Cầu Giấy, Hà Nội','Cầu Giấy','draft','06:00','23:00');
    update venues set status='active',images='{fixture1,fixture2,fixture3}' where id=${quote(venueId)};
    insert into courts(id,venue_id,name,sport) values(${quote(courtId)},${quote(venueId)},'Sân E2E','badminton');
    insert into sepay_connections(id,owner_id,status,bank,account_number,account_name)
    values(${quote(connectionId)},${quote(users.owner.id)},'ready','MB',${quote(account)},'TAI KHOAN KIEM TRA KHONG CHUYEN TIEN');
    set local session_replication_role=replica;
    insert into tournaments(id,manager_id,title,description,sport,address,starts_at,ends_at,registration_deadline,payment_deadline,capacity,entry_fee,deposit_amount)
    values(${quote(proposalId)},${quote(users.manager.id)},'Đề xuất E2E - không đăng ký','Thi đấu theo đội, thể lệ và thông tin liên hệ kiểm tra.','badminton','Cầu Giấy, Hà Nội',now()+interval '11 days',now()+interval '11 days 2 hours',now()+interval '10 days',now()+interval '11 days',4,200000,100000);
    commit;
    select jsonb_build_object(
      'starts_at',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '10 days','YYYY-MM-DD"T"10:00'),
      'ends_at',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '10 days','YYYY-MM-DD"T"12:00'),
      'registration_deadline',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '9 days','YYYY-MM-DD"T"10:00'),
      'payment_deadline',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '10 days','YYYY-MM-DD"T"09:00')) as schedule;`);
  const schedule = rows[0].schedule;
  for (const [role, user] of Object.entries(users)) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
    contexts.push(context);
    const cookies = [];
    const auth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => cookies, setAll: values => cookies.push(...values) } });
    const { error } = await auth.auth.signInWithPassword({ email: user.email, password });
    assert.equal(error, null, `${role}: fixture sign-in`);
    await context.addCookies(cookies.map(cookie => ({ name: cookie.name, value: cookie.value, url: origin, sameSite: 'Lax' })));
    const page = await context.newPage();
    pages[role] = page;
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
  }
  const { owner, player, manager, admin } = pages;
  console.log('OK: four isolated authenticated browser contexts.');
  await owner.goto(`${origin}/giai-dau/tao`);
  await owner.getByLabel('Tên giải đấu', { exact: true }).fill('Giải E2E - không đăng ký');
  await owner.getByLabel('Môn thi đấu').selectOption('badminton');
  await owner.getByLabel('Chọn sân của bạn').selectOption(courtId);
  for (const [name, value] of Object.entries(schedule)) await owner.locator(`[name="${name}"]`).fill(value);
  await owner.getByLabel('Số người / đội tối đa').fill('4');
  await owner.getByLabel('Lệ phí mỗi suất (đ)').fill('200000');
  await owner.getByLabel('Cọc mỗi suất (đ)').fill('200001');
  assert.equal(await owner.locator('[name=deposit_amount]').evaluate(input => input.validity.rangeOverflow), true);
  await owner.getByLabel('Cọc mỗi suất (đ)').fill('100000');
  await owner.getByLabel('Thể lệ & thông tin liên hệ').fill('Một suất là một đội. Đây là dữ liệu kiểm tra tự động; không chuyển tiền thật.');
  await owner.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
  await owner.screenshot({ path: `${output}/create-desktop.png`, fullPage: true });
  await owner.getByRole('button', { name: 'Công khai giải đấu', exact: true }).click();
  await owner.waitForURL(/\/giai-dau\/[0-9a-f-]{36}$/);
  tournamentId = new URL(owner.url()).pathname.split('/').at(-1);
  assert.match(tournamentId, /^[0-9a-f-]{36}$/);
  console.log('OK: owner published tournament through the real form and RPC.');
  const detail = `${origin}/giai-dau/${tournamentId}`;
  await player.goto(detail);
  async function register(page) {
    await page.getByLabel('Họ tên người tham gia / đại diện').fill('E2E Player');
    await page.getByLabel('Số điện thoại', { exact: true }).fill('+84 900 000 004');
    await page.getByLabel('Địa chỉ / khu vực', { exact: true }).fill('Hà Nội');
    await page.getByLabel('Tên đội (nếu thi đấu theo đội)').fill('Đội kiểm tra');
    await page.getByRole('checkbox', { name: /Tôi đã đọc thể lệ/ }).check();
    await page.getByRole('button', { name: 'Gửi đăng ký', exact: true }).click();
    await page.locator('#dang-ky').getByText('Chờ duyệt', { exact: true }).waitFor();
  }
  await register(player);
  await owner.goto(`${detail}?view=participants`);
  await owner.getByLabel('Tìm người hoặc đội').fill('không khớp');
  await owner.getByText('Không có đăng ký khớp bộ lọc.').waitFor();
  await owner.getByLabel('Tìm người hoặc đội').fill('E2E Player');
  await owner.getByRole('button', { name: 'Duyệt tham gia', exact: true }).click();
  await player.locator('#dang-ky img').waitFor();
  await player.locator('#dang-ky img').evaluate(image => image.decode());
  const inbox = await contexts[1].newPage();
  await inbox.goto(`${origin}/giai-dau?view=registered`);
  await inbox.getByText('Chờ đóng cọc', { exact: true }).waitFor();
  for (const width of [390, 768, 1024, 1440]) {
    await player.setViewportSize({ width, height: 1000 });
    assert(await player.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `player overflow at ${width}`);
    if ([390, 1440].includes(width)) await player.screenshot({ path: `${output}/payment-${width}.png`, fullPage: true });
  }
  const [payment] = await sql(`select code,bank,account_number,id from tournament_registrations where tournament_id=${quote(tournamentId)} and user_id=${quote(users.player.id)} and status='approved';`);
  async function pay(registration, amount, suffix) {
    const [result] = await sql(`select confirm_tournament_payment(${quote(registration.code)},${amount},${quote(`journey-${run}-${suffix}`)},'{"test":true}',${quote(connectionId)},${quote(registration.bank)},${quote(registration.account_number)}) as result;`);
    return result.result.reason;
  }
  assert.equal(await pay(payment, 50000, 'underpaid'), 'UNDERPAID');
  assert.equal(await pay(payment, 120000, 'paid'), 'OVERPAID');
  assert.equal(await pay(payment, 120000, 'paid'), 'ALREADY_PROCESSED');
  await player.locator('#dang-ky').getByText('Đã xác nhận tham gia', { exact: true }).waitFor();
  assert.equal(await player.locator('#dang-ky img').count(), 0);
  await inbox.getByText('Đã xác nhận tham gia', { exact: true }).waitFor();
  await owner.goto(`${detail}?view=payments`);
  while (await owner.getByRole('button', { name: 'Đã chuyển tiền hoàn', exact: true }).count()) {
    await owner.getByRole('button', { name: 'Đã chuyển tiền hoàn', exact: true }).first().click();
    await owner.getByText('Đã lưu.', { exact: true }).first().waitFor();
    await owner.reload();
  }
  await player.getByRole('button', { name: 'Hủy tham gia', exact: true }).click();
  await player.locator('#dang-ky').getByText('Đã hủy', { exact: true }).waitFor();
  await owner.reload();
  await owner.getByRole('button', { name: 'Đã chuyển tiền hoàn', exact: true }).click();
  await owner.getByText('Đã lưu.', { exact: true }).waitFor();
  await register(player);
  await owner.goto(`${detail}?view=participants`);
  const pending = owner.locator('details[open]').filter({ hasText: 'E2E Player' }).first();
  await pending.getByText('Từ chối đăng ký', { exact: true }).click();
  await pending.getByLabel('Lý do từ chối').fill('Thiếu thông tin thành viên đội.');
  await pending.getByRole('button', { name: 'Gửi lý do từ chối' }).click();
  await player.getByText('Ghi chú ban tổ chức: Thiếu thông tin thành viên đội.').waitFor();
  await register(player);
  await owner.reload();
  await owner.getByRole('button', { name: 'Duyệt tham gia', exact: true }).click();
  await player.locator('#dang-ky img').waitFor();
  await sql(`update tournament_registrations set payment_expires_at=now()+interval '3 seconds' where tournament_id=${quote(tournamentId)} and user_id=${quote(users.player.id)} and status='approved';`);
  await player.locator('#dang-ky').getByText('Hết hạn', { exact: true }).waitFor({ timeout: 20000 });
  assert.equal(await player.locator('#dang-ky img').count(), 0);
  await owner.goto(detail);
  await owner.getByText('Hủy giải đấu', { exact: true }).click();
  await owner.getByRole('button', { name: 'Xác nhận hủy giải', exact: true }).click();
  await player.getByText('Giải đã hủy', { exact: true }).waitFor();
  await player.reload();
  assert.equal(await player.getByRole('heading', { name: 'Đăng ký của bạn', exact: true }).count(), 1);
  console.log('OK: publish, registration, approval, QR, payment retry/realtime, refunds, rejection, retry, expiry and cancellation.');

  await admin.goto(`${origin}/giai-dau/${proposalId}`);
  await admin.getByLabel('Kết quả duyệt').selectOption('false');
  assert.equal(await admin.locator('[name=venue_fee]').count(), 0);
  await admin.getByLabel('Kết quả duyệt').selectOption('true');
  await admin.getByLabel('Sân tổ chức').selectOption(courtId);
  await admin.getByLabel('Tiền thuê sân đã thỏa thuận (đ)').fill('50000');
  await admin.getByLabel('Tiền thuê khi người tổ chức hủy (đ)').fill('25000');
  await admin.getByLabel('Thỏa thuận thu phí và thuê sân').fill('Chủ sân thu cọc và phần còn lại. Thuê sân 50.000đ; người tổ chức bù phần thiếu và quyết toán sau giải.');
  await admin.getByRole('checkbox', { name: /Chủ sân và người tổ chức đã đồng ý/ }).check();
  await admin.getByRole('button', { name: 'Công khai giải và khóa lịch sân', exact: true }).click();
  await admin.getByText('Đã lưu.', { exact: true }).waitFor();
  const proposal = `${origin}/giai-dau/${proposalId}`;
  await manager.goto(`${proposal}?view=participants`);
  await player.goto(proposal);
  await register(player);
  await manager.getByRole('button', { name: 'Duyệt tham gia', exact: true }).click();
  await player.locator('#dang-ky img').waitFor();
  const [secondPayment] = await sql(`select code,bank,account_number from tournament_registrations where tournament_id=${quote(proposalId)} and user_id=${quote(users.player.id)} and status='approved';`);
  assert.equal(await pay(secondPayment, 100000, 'settlement'), 'PAID');
  await sql(`update tournaments set starts_at=now()-interval '2 hours',ends_at=now()+interval '1 hour',registration_deadline=now()-interval '3 hours',payment_deadline=now()-interval '2 hours' where id=${quote(proposalId)};`);
  await owner.goto(`${proposal}?view=participants`);
  await owner.locator('summary').filter({ hasText: 'E2E Player' }).first().click();
  await owner.getByLabel('Chứng từ / ghi chú thu tiền').fill('E2E mô phỏng đã thu phần còn lại');
  await owner.getByRole('button', { name: 'Đã thu thêm 100.000đ', exact: true }).click();
  await owner.getByText('Đã lưu.', { exact: true }).waitFor();
  await sql(`update tournaments set ends_at=now()-interval '1 minute' where id=${quote(proposalId)}; select refresh_tournament(${quote(proposalId)});`);
  await owner.goto(`${proposal}?view=settlement`);
  await owner.getByLabel('Mã giao dịch / chứng từ quyết toán').fill('E2E mô phỏng chuyển quyết toán');
  await owner.getByRole('button', { name: 'Đã chuyển 150.000đ', exact: true }).click();
  await owner.getByText('Đã lưu.', { exact: true }).waitFor();
  await manager.goto(`${proposal}?view=settlement`);
  await manager.getByRole('button', { name: 'Tôi đã nhận tiền', exact: true }).click();
  await manager.getByText('Bên nhận đã xác nhận', { exact: false }).waitFor();
  await player.goto(`${proposal}?view=settlement`);
  assert.equal(await player.getByRole('heading', { name: 'Thu phí & quyết toán', exact: true }).count(), 0);
  for (const page of [owner, manager, admin]) {
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `manager overflow at ${width}`);
    }
  }
  await owner.setViewportSize({ width: 1440, height: 1000 });
  await owner.screenshot({ path: `${output}/settlement-desktop.png`, fullPage: true });
  assert.deepEqual(errors, []);
  console.log('OK: admin terms, organizer approval, collection, two-party settlement and privacy at four viewport widths.');
} catch (error) {
  for (const [role, page] of Object.entries(pages)) await page.screenshot({ path: `${output}/failure-${role}.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  await sql(`begin;
    delete from notifications where user_id in (${userIds}) or tournament_id in (select id from tournaments where manager_id in (${userIds}));
    delete from court_closures where court_id=${quote(courtId)};
    delete from tournament_transfers where tournament_id in (select id from tournaments where manager_id in (${userIds}));
    delete from tournament_settlements where tournament_id in (select id from tournaments where manager_id in (${userIds}));
    delete from tournament_payment_events where registration_id in (select id from tournament_registrations where user_id in (${userIds}));
    delete from sepay_transfer_claims where transaction_key like ${quote(`%:journey-${run}-%`)};
    delete from tournament_registrations where tournament_id in (select id from tournaments where manager_id in (${userIds}));
    delete from tournaments where manager_id in (${userIds});
    delete from sepay_connections where id=${quote(connectionId)};
    delete from courts where id=${quote(courtId)};
    delete from venues where id=${quote(venueId)};
    delete from owner_subscriptions where owner_id in (${userIds});
    delete from profiles where id in (${userIds});
    delete from auth.users where id in (${userIds});
    commit;`);
  console.log('OK: disposable users, courts, tournaments and simulated payments removed.');
}
