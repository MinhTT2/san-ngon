// Opt-in live integration test. Creates only tagged disposable fixtures, then removes them.
// Requires Supabase CLI login/link, production build, and PLAYWRIGHT_MODULE if not installed.
// node scripts/check-tournament-e2e.mjs --live
// Payments are synthetic requests to the LOCAL webhook, never bank transfers.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

assert(process.argv.includes('--live'), 'Pass --live to create disposable fixtures in the linked database.');
process.loadEnvFile('.env.local');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = resolve(process.env.UX_SCREENSHOT_DIR || '../outputs/tournament-review');
mkdirSync(output, { recursive: true });
rmSync(join(output, 'result.json'), { force: true });
const temp = mkdtempSync(join(tmpdir(), 'san-ngon-tournament-'));
const cliPath = resolve('node_modules/supabase/dist/supabase.js');
function cli(args) {
  const raw = execFileSync(process.execPath, [cliPath, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const result = JSON.parse(raw);
  if (result.error) throw new Error(result.error.message);
  return result;
}
function sql(query) {
  const file = join(temp, 'query.sql');
  writeFileSync(file, query);
  return cli(['db', 'query', '--linked', '--file', file]).rows;
}
const ids = Object.fromEntries(['owner', 'organizer', 'player', 'admin', 'venue', 'court', 'connection'].map(k => [k, randomUUID()]));
const actorNames = { owner: 'Chủ sân kiểm thử', organizer: 'Ban tổ chức kiểm thử', player: 'Người chơi kiểm thử', admin: 'Admin kiểm thử' };
const prefix = `e2e-${randomBytes(5).toString('hex')}`;
const password = randomBytes(24).toString('base64url');
const webhookKey = randomBytes(32).toString('hex');
const actorIds = ['owner', 'organizer', 'player', 'admin'].map(k => `'${ids[k]}'`).join(',');
const tournaments = `select id from tournaments where manager_id in (${actorIds})`;
const registrations = `select id from tournament_registrations where tournament_id in (${tournaments})`;
const cleanup = `begin;
delete from sepay_transfer_claims where transaction_key in (select transaction_key from tournament_payment_events where registration_id in (${registrations}));
delete from tournament_payment_events where registration_id in (${registrations});
delete from tournament_transfers where tournament_id in (${tournaments});
delete from tournament_settlements where tournament_id in (${tournaments});
update tournaments set status='cancelled' where id in (${tournaments});
delete from court_closures where tournament_id in (${tournaments});
delete from notifications where tournament_id in (${tournaments}) or user_id in (${actorIds});
delete from tournament_registrations where tournament_id in (${tournaments});
delete from tournaments where id in (${tournaments});
delete from sepay_connections where id='${ids.connection}';
delete from courts where id='${ids.court}';
delete from venues where id='${ids.venue}';
delete from owner_subscriptions where owner_id in (${actorIds});
delete from profiles where id in (${actorIds});
delete from auth.users where id in (${actorIds});
commit;`;
writeFileSync(join(output, 'cleanup.sql'), cleanup);
const errors = [];
let app, browser, logs = '', fixtures = false;
const origin = 'http://localhost:3110';
async function shot(page, name, target) {
  await page.evaluate(() => document.fonts.ready);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: horizontal overflow`);
  if (target) await page.locator(target).scrollIntoViewIfNeeded();
  else await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(output, `${name}.png`), fullPage: !target });
}
async function submit(page, label) {
  // Read the real response before the form navigates away; no response is mocked.
  let finish, fail, timeout;
  const completed = new Promise((resolve, reject) => { finish = resolve; fail = reject; });
  const handler = async route => {
    try {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({ response });
      finish({ ok: response.ok(), body });
    } catch (error) { fail(error); }
  };
  await page.route('**/api/tournaments', handler);
  try {
    const [, { ok, body }] = await Promise.all([
      page.getByRole('button', { name: label, exact: true }).click(),
      Promise.race([completed, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(`${label}: no API response`)), 30000); })]),
    ]);
    assert(ok, `${label}: ${JSON.stringify(body)}`);
    return body.data;
  } finally { clearTimeout(timeout); await page.unroute('**/api/tournaments', handler); }
}
async function proposal(page, data, owner) {
  await page.goto(`${origin}/giai-dau/tao`);
  await page.getByLabel('Tên giải', { exact: true }).fill(data.title);
  await page.locator('select[name=sport]').selectOption('badminton');
  if (owner) {
    await page.locator('select[name=court_id]').selectOption(ids.court);
    assert.equal(await page.getByLabel('Địa chỉ sân tổ chức').inputValue(), 'Sân kiểm thử, Cầu Giấy, Hà Nội');
    await page.locator('select[name=sport]').selectOption('pickleball');
    assert.equal(await page.locator('select[name=court_id]').inputValue(), '');
    assert.equal(await page.getByLabel('Địa chỉ sân tổ chức').inputValue(), '');
    await page.getByText('Bạn chưa có sân đang hoạt động cho môn này.', { exact: false }).waitFor();
    await page.locator('select[name=sport]').selectOption('badminton');
    await page.locator('select[name=court_id]').selectOption(ids.court);
  } else await page.getByLabel('Địa chỉ / khu vực mong muốn').fill('Khu vực Cầu Giấy, Hà Nội');
  for (const name of ['starts_at', 'ends_at', 'registration_deadline', 'payment_deadline']) await page.locator(`[name=${name}]`).fill(data[name]);
  await page.locator('[name=capacity]').fill('8');
  await page.locator('[name=entry_fee]').fill('200000');
  await page.locator('[name=deposit_amount]').fill('100000');
  await page.locator('textarea[name=description]').fill('Dữ liệu kiểm thử tự động — không nhận người chơi thật, không chuyển tiền. Thi đấu đôi cầu lông phong trào, mỗi suất một đội; có mặt trước 15 phút.');
}
try {
  assert.equal(sql('select multi_owner_enabled from booking_operator')[0]?.multi_owner_enabled, true, 'Multi-owner acceptance is disabled; do not change it for a browser test.');
  const keys = cli(['projects', 'api-keys', '--project-ref', process.env.SUPABASE_PROJECT_REF]).keys;
  const serviceKey = keys.find(k => k.name === 'service_role')?.api_key;
  assert(serviceKey, 'Service key unavailable for local webhook.');
  sql(`begin;
  ${Object.keys(actorNames).map(actor => `insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
  values('${ids[actor]}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${prefix}-${actor}@example.invalid',extensions.crypt('${password}',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"${actorNames[actor]}"}',now(),now(),'','','','');
  insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at) values(gen_random_uuid(),'${ids[actor]}','${ids[actor]}','{"sub":"${ids[actor]}","email":"${prefix}-${actor}@example.invalid"}','email',now(),now(),now());`).join('\n')}
  update profiles set role='owner',owner_application_status='active',payout_bank='TestBank',payout_account='999999999999' where id='${ids.owner}';
  update profiles set role='admin' where id='${ids.admin}';
  insert into venues(id,owner_id,name,slug,address,district,status,open_time,close_time) values('${ids.venue}','${ids.owner}','[KIỂM THỬ] Sân Cầu Giấy','${prefix}','Sân kiểm thử, Cầu Giấy, Hà Nội','Cầu Giấy','draft','06:00','23:00');
  update venues set status='active',images='{e2e-1,e2e-2,e2e-3}' where id='${ids.venue}';
  insert into courts(id,venue_id,name,sport) values('${ids.court}','${ids.venue}','Sân cầu lông 01','badminton');
  insert into sepay_connections(id,owner_id,status,bank,account_number,account_name,webhook_key_hash) values('${ids.connection}','${ids.owner}','ready','TestBank','999999999999','KIEM THU - KHONG CHUYEN TIEN','${createHash('sha256').update(webhookKey).digest('hex')}');
  commit;`);
  fixtures = true;
  app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3110'], { windowsHide: true, env: { ...process.env, SUPABASE_SERVICE_ROLE_KEY: serviceKey }, stdio: ['ignore', 'pipe', 'pipe'] });
  app.stdout.on('data', b => { logs += b; }); app.stderr.on('data', b => { logs += b; });
  for (let i = 0; i < 100 && !logs.includes('Ready in'); i++) await new Promise(r => setTimeout(r, 200));
  assert(logs.includes('Ready in'), 'App did not start');
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const pages = {};
  for (const actor of Object.keys(actorNames)) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    // Exercise the unavailable QR service explicitly; all auth/RPC/API calls stay real.
    await context.route('https://qr.sepay.vn/**', route => route.abort());
    const page = await context.newPage(); pages[actor] = page;
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto(`${origin}/dang-nhap?next=/giai-dau`);
    await page.locator('#email').fill(`${prefix}-${actor}@example.invalid`);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.waitForURL(`${origin}/giai-dau`, { timeout: 30000 });
  }
  console.log('OK: four isolated real authenticated sessions');
  const dates = sql(`select to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '10 days','YYYY-MM-DD"T"10:00') starts_at,
    to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '10 days','YYYY-MM-DD"T"12:00') ends_at,
    to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '8 days','YYYY-MM-DD"T"20:00') registration_deadline,
    to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '9 days','YYYY-MM-DD"T"20:00') payment_deadline`)[0];
  const { owner, organizer, player, admin } = pages;
  await proposal(owner, { ...dates, title: '[KIỂM THỬ] Cầu lông cuối tuần Cầu Giấy' }, true);
  await shot(owner, '01-owner-create');
  const tid = await submit(owner, 'Công khai giải đấu');
  await owner.waitForURL(`${origin}/giai-dau/${tid}`);
  await owner.getByText('Khu vực quản lý giải', { exact: true }).waitFor();
  await shot(owner, '02-owner-published');
  assert.equal(sql(`select count(*)::int n from court_closures where tournament_id='${tid}'`)[0].n, 1);
  await player.goto(`${origin}/giai-dau`);
  await shot(player, '03-discover');
  await player.goto(`${origin}/giai-dau/${tid}`);
  await player.getByLabel('Họ tên người tham gia / đại diện').fill('Nguyễn Minh — đội kiểm thử');
  await player.getByLabel('Số điện thoại', { exact: true }).fill('0900000000');
  await player.getByLabel('Địa chỉ / khu vực', { exact: true }).fill('Cầu Giấy, Hà Nội');
  await player.getByLabel('Tên đội (nếu thi đấu theo đội)').fill('Đội Cầu Giấy');
  await shot(player, '04-player-register', '#dang-ky');
  await submit(player, 'Gửi đăng ký');
  await player.getByText('Đăng ký của bạn', { exact: true }).waitFor();
  await shot(player, '05-player-pending', '#dang-ky');
  await owner.getByRole('button', { name: 'Lưu duyệt đăng ký', exact: true }).waitFor({ timeout: 20000 });
  await shot(owner, '06-owner-review', '#nguoi-tham-gia');
  await submit(owner, 'Lưu duyệt đăng ký');
  await player.getByText('Chờ chuyển khoản. Trang tự cập nhật khi nhận đủ cọc.', { exact: true }).waitFor({ timeout: 20000 });
  await player.getByRole('button', { name: 'Tải lại mã QR' }).waitFor();
  await shot(player, '07-player-deposit', '#dang-ky');
  const registration = sql(`select id,code from tournament_registrations where tournament_id='${tid}'`)[0];
  const transferId = String(Date.now());
  const payment = { id: transferId, gateway: 'TestBank', accountNumber: '999999999999', transferType: 'in', transferAmount: 100000, content: registration.code };
  async function webhook(data) {
    const response = await fetch(`${origin}/api/webhooks/sepay?connection=${ids.connection}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Apikey ${webhookKey}` }, body: JSON.stringify(data) });
    assert.equal(response.status, 200); return response.json();
  }
  assert.equal((await webhook(payment)).reason, 'PAID');
  assert.equal((await webhook(payment)).reason, 'ALREADY_PROCESSED');
  await player.getByText('Bạn đã hoàn tất đăng ký.', { exact: false }).waitFor({ timeout: 20000 });
  await shot(player, '08-player-paid', '#dang-ky');
  await player.setViewportSize({ width: 390, height: 844 });
  await shot(player, '09-mobile-paid');
  await player.setViewportSize({ width: 1440, height: 1000 });
  await submit(player, 'Hủy tham gia');
  await owner.getByRole('button', { name: 'Đã chuyển tiền hoàn', exact: true }).waitFor({ timeout: 20000 });
  await shot(owner, '10-owner-refund', '#nguoi-tham-gia');
  await submit(owner, 'Đã chuyển tiền hoàn');
  await player.getByText('Đã hoàn 100.000đ', { exact: false }).waitFor({ timeout: 20000 });
  await shot(player, '11-player-refunded', '#dang-ky');
  await submit(owner, 'Hủy giải đấu');
  assert.equal(sql(`select count(*)::int n from court_closures where tournament_id='${tid}'`)[0].n, 0);
  console.log('OK: owner publish → register → realtime approval → synthetic webhook/retry → realtime paid → cancel/refund → release court');
  await proposal(organizer, { ...dates, title: '[KIỂM THỬ] Giải giao lưu người chơi' }, false);
  const proposalId = await submit(organizer, 'Gửi admin duyệt');
  await organizer.waitForURL(`${origin}/giai-dau/${proposalId}`);
  await admin.goto(`${origin}/giai-dau/${proposalId}`);
  await admin.locator('select[name=court_id]').selectOption(ids.court);
  await admin.getByLabel('Tiền thuê sân đã thỏa thuận (đ)', { exact: true }).fill('50000');
  await admin.getByLabel('Thỏa thuận thu phí và thuê sân').fill('Dữ liệu kiểm thử: hai bên đồng ý thuê sân 50.000đ, không phát sinh chuyển tiền thật.');
  await admin.locator('[name=terms_confirmed]').check();
  await shot(admin, '12-admin-proposal', '#duyet-giai');
  await submit(admin, 'Lưu kết quả duyệt');
  await organizer.getByText('Đã công khai', { exact: true }).waitFor({ timeout: 20000 });
  await shot(organizer, '13-organizer-published');
  await player.goto(`${origin}/giai-dau/${proposalId}`);
  await player.getByLabel('Họ tên người tham gia / đại diện').fill('Nguyễn Minh — đội kiểm thử');
  await player.getByLabel('Số điện thoại', { exact: true }).fill('0900000000');
  await player.getByLabel('Địa chỉ / khu vực', { exact: true }).fill('Cầu Giấy, Hà Nội');
  await submit(player, 'Gửi đăng ký');
  await organizer.getByRole('button', { name: 'Lưu duyệt đăng ký', exact: true }).waitFor({ timeout: 20000 });
  await submit(organizer, 'Lưu duyệt đăng ký');
  const secondRegistration = sql(`select code from tournament_registrations where tournament_id='${proposalId}'`)[0];
  assert.equal((await webhook({ ...payment, id: String(Date.now()), content: secondRegistration.code })).reason, 'PAID');
  // Move only our fixture's dates in SQL. The real page must update at starts_at
  // without a reload, focus event, or another realtime database mutation.
  sql(`update tournaments set registration_deadline=now()-interval '2 minutes',payment_deadline=now()-interval '1 minute',starts_at=now()+interval '15 seconds',ends_at=now()+interval '2 hours' where id='${proposalId}'`);
  await owner.goto(`${origin}/giai-dau/${proposalId}`);
  assert.equal(await owner.getByRole('button', { name: 'Đã thu thêm 100.000đ', exact: true }).count(), 0);
  await owner.getByRole('button', { name: 'Đã thu thêm 100.000đ', exact: true }).waitFor({ timeout: 25000 });
  await owner.getByLabel('Chứng từ / ghi chú thu tiền').fill('E2E — ghi nhận thử, không thu tiền thật');
  await shot(owner, '14-owner-collect-balance', '#nguoi-tham-gia');
  await submit(owner, 'Đã thu thêm 100.000đ');
  sql(`update tournaments set registration_deadline=now()-interval '4 hours',payment_deadline=now()-interval '3 hours',starts_at=now()-interval '2 hours',ends_at=now()-interval '1 second' where id='${proposalId}'; select refresh_tournament('${proposalId}');`);
  await owner.getByRole('button', { name: 'Đã chuyển 150.000đ', exact: true }).waitFor({ timeout: 20000 });
  await owner.getByLabel('Mã giao dịch / chứng từ quyết toán').fill('E2E — quyết toán thử, không chuyển tiền thật');
  await shot(owner, '15-owner-settlement', '#quyet-toan');
  await submit(owner, 'Đã chuyển 150.000đ');
  await organizer.getByRole('button', { name: 'Tôi đã nhận tiền', exact: true }).waitFor({ timeout: 20000 });
  await shot(organizer, '16-organizer-confirm-settlement', '#quyet-toan');
  await submit(organizer, 'Tôi đã nhận tiền');
  await owner.getByText('Bên nhận đã xác nhận', { exact: false }).waitFor({ timeout: 20000 });
  await shot(owner, '17-settlement-complete', '#quyet-toan');
  console.log('OK: player proposal → admin approval → payment → starts_at timer → collect balance → settlement confirmed by other party');
  assert.deepEqual(errors, [], 'Browser exceptions');
  writeFileSync(join(output, 'result.json'), JSON.stringify({ passed: true, testedAt: new Date().toISOString(), payment: 'synthetic local webhook, no bank transfer', checks: ['real login x4', 'owner publish', 'SQL closure', 'register', 'approve realtime', 'QR failure fallback', 'webhook retry', 'payment realtime', 'cancel', 'manual refund record', 'release closure', 'player proposal', 'admin publish', 'starts_at timer', 'balance collection', 'two-party settlement', '390px overflow'] }, null, 2));
} catch (error) {
  if (browser) for (const [i, context] of browser.contexts().entries()) for (const page of context.pages()) await page.screenshot({ path: join(output, `failure-${i}.png`), fullPage: true }).catch(() => {});
  writeFileSync(join(output, 'server.log'), logs);
  throw error;
} finally {
  if (browser) await browser.close();
  if (app) app.kill();
  if (fixtures) {
    sql(cleanup);
    assert.equal(sql(`select count(*)::int n from auth.users where id in (${actorIds})`)[0].n, 0);
    console.log('OK: removed disposable fixtures');
    rmSync(join(output, 'cleanup.sql'));
  }
  rmSync(temp, { recursive: true });
}
