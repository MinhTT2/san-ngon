// Opt-in: creates disposable users and a completed booking; no email or money is sent.
// Requires a production server, linked Supabase CLI, and isolated headless Playwright.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

assert(process.argv.includes('--live'), 'Use --live to create disposable test fixtures.');
process.loadEnvFile('.env.local');
const origin = process.argv.find(value => value.startsWith('http')) || 'http://localhost:3120';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Only run against a local server.');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const temp = mkdtempSync(join(tmpdir(), 'san-ngon-utilities-'));
const output = resolve(process.env.UX_SCREENSHOT_DIR || '../outputs/player-utilities');
mkdirSync(output, { recursive: true });
function sql(query) {
  const file = join(temp, 'query.sql');
  writeFileSync(file, query, { mode: 0o600 });
  const raw = execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'db', 'query', '--linked', '--file', file, '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const data = JSON.parse(raw);
  if (data.error) throw new Error(data.error.message);
  return Array.isArray(data) ? data : data.rows;
}
const ids = Object.fromEntries(['player', 'other', 'admin', 'court', 'booking'].map(key => [key, randomUUID()]));
const prefix = 'utility-' + randomBytes(5).toString('hex');
const password = randomBytes(24).toString('base64url');
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = 'SAN' + [...randomBytes(6)].map(byte => alphabet[byte % alphabet.length]).join('');
const actors = ['player', 'other', 'admin'];
const cleanup = `begin;
delete from public.bookings where id='${ids.booking}';
delete from public.courts where id='${ids.court}';
delete from auth.users where id in (${actors.map(actor => `'${ids[actor]}'`).join(',')});
commit;`;
writeFileSync(join(output, 'cleanup.sql'), cleanup, { mode: 0o600 });
let browser;
let fixtures = false;
const errors = [];
try {
  const [venue] = sql(`select v.id,v.slug,v.name from public.venues v where v.status='active' and public.venue_accepts_bookings(v.id) order by v.id limit 1`);
  assert(venue, 'Need an existing public venue accepting bookings; do not change acceptance flags.');
  sql(`begin;
  ${actors.map(actor => `insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
  values('${ids[actor]}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${prefix}-${actor}@example.invalid',extensions.crypt('${password}',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Người kiểm thử tiện ích"}',now(),now(),'','','','');
  insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at) values(gen_random_uuid(),'${ids[actor]}','${ids[actor]}','{"sub":"${ids[actor]}","email":"${prefix}-${actor}@example.invalid"}','email',now(),now(),now());`).join('\n')}
  update public.profiles set role='admin' where id='${ids.admin}';
  insert into public.courts(id,venue_id,name,sport,is_active) values('${ids.court}','${venue.id}','[KIỂM THỬ] Tiện ích','badminton',false);
  insert into public.bookings(id,code,court_id,user_id,starts_at,ends_at,total_amount,deposit_amount,customer_phone,status,paid_at)
  values('${ids.booking}','${code}','${ids.court}','${ids.player}',now()-interval '2 days',now()-interval '2 days'+interval '1 hour',100000,100000,'0900000000','completed',now()-interval '3 days');
  commit;`);
  fixtures = true;
  console.log('OK: disposable fixtures ready');
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const guest = await browser.newContext();
  for (const path of ['/api/feedback', '/api/favorites']) {
    assert.equal((await guest.request.post(origin + path, { headers: { origin }, data: {} })).status(), 401);
    assert.equal((await guest.request.post(origin + path, { headers: { origin: 'https://untrusted.example' }, data: {} })).status(), 403);
  }
  assert.equal((await guest.request.get(origin + '/api/bookings/' + code + '/calendar')).status(), 401);
  await guest.close();
  const pages = {};
  for (const actor of actors) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    const page = await context.newPage(); pages[actor] = page;
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/dang-nhap?next=/gop-y');
    await page.locator('#email').fill(prefix + '-' + actor + '@example.invalid');
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.waitForURL(origin + '/gop-y', { timeout: 30000 });
  }
  console.log('OK: three isolated authenticated sessions');
  const { player, other, admin } = pages;
  const title = 'Báo lỗi kiểm thử ' + prefix;
  await player.getByLabel('Tiêu đề', { exact: true }).fill(title);
  await player.getByLabel('Nội dung', { exact: true }).fill('Nội dung chỉ dùng kiểm thử góp ý và quyền riêng tư trên website.');
  const sent = player.waitForResponse(response => response.url().endsWith('/api/feedback') && response.request().method() === 'POST');
  await player.getByRole('button', { name: 'Gửi góp ý', exact: true }).click();
  const response = await sent; assert.equal(response.status(), 200);
  const feedbackId = (await response.json()).id;
  await player.locator('#gop-y-' + feedbackId).waitFor();
  const payload = sql(`select id,category,title,message,page_path from public.feedback where id='${feedbackId}'`)[0];
  const retry = await player.request.post(origin + '/api/feedback', { headers: { origin }, data: payload });
  assert.equal(retry.status(), 200);
  assert.equal(sql(`select count(*)::int n from public.feedback where id='${feedbackId}'`)[0].n, 1);
  await other.reload();
  assert.equal(await other.locator('#gop-y-' + feedbackId).count(), 0);
  const forbidden = await other.request.patch(origin + '/api/feedback', { headers: { origin }, data: { id: feedbackId, status: 'resolved', reply: 'Không được phép.', updated_at: new Date().toISOString() } });
  assert.equal(forbidden.status(), 403);
  await admin.goto(origin + '/admin/gop-y?status=new&category=bug');
  await admin.screenshot({ path: join(output, 'admin-before-review.png'), fullPage: true });
  console.log('Admin page: ' + new URL(admin.url()).pathname + '; headings: ' + (await admin.locator('h1').allTextContents()).join(', '));
  const article = admin.locator('#gop-y-' + feedbackId);
  await article.locator('select[name="status"]').selectOption('resolved');
  await article.getByLabel('Phản hồi cho người gửi').fill('Đã xử lý yêu cầu kiểm thử.');
  const reviewed = admin.waitForResponse(response => response.url().endsWith('/api/feedback') && response.request().method() === 'PATCH');
  await article.getByRole('button', { name: 'Lưu phản hồi' }).click();
  assert.equal((await reviewed).status(), 200);
  await player.reload();
  await player.locator('#gop-y-' + feedbackId).getByText('Đã xử lý yêu cầu kiểm thử.', { exact: true }).waitFor();
  console.log('OK: feedback submit/retry, private history, admin reply and role protection');

  await player.goto(origin + '/san/' + venue.slug);
  await player.getByRole('button', { name: 'Lưu sân', exact: true }).click();
  await player.getByRole('button', { name: 'Bỏ lưu sân', exact: true }).waitFor();
  await player.goto(origin + '/san-yeu-thich');
  await player.getByRole('heading', { name: venue.name, exact: true }).waitFor();
  await other.goto(origin + '/san-yeu-thich');
  await other.getByRole('heading', { name: 'Chưa có sân yêu thích' }).waitFor();
  await player.getByRole('button', { name: 'Bỏ lưu sân', exact: true }).click();
  await player.getByRole('heading', { name: 'Chưa có sân yêu thích' }).waitFor();
  await player.goto(origin + '/san/' + venue.slug);
  await player.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
  await player.getByRole('button', { name: 'Chia sẻ sân' }).click();
  await player.getByText('Đã sao chép liên kết sân.', { exact: true }).waitFor();
  assert.equal(await player.evaluate(() => navigator.clipboard.readText()), await player.locator('link[rel=canonical]').getAttribute('href'));
  await player.getByRole('link', { name: 'Báo vấn đề', exact: true }).click();
  await player.waitForURL(url => url.pathname === '/gop-y');
  assert.equal(new URL(player.url()).searchParams.get('trang'), '/san/' + venue.slug);
  console.log('OK: favorites save/remove/privacy, clipboard share, report-page context');

  await player.goto(origin + '/don-cua-toi');
  await player.getByRole('button', { name: /Lịch sử/ }).first().click();
  const bookingRow = player.locator('tr').filter({ has: player.getByRole('link', { name: code, exact: true }) });
  await player.getByLabel('Tìm đơn theo mã hoặc tên sân').fill(code);
  await player.reload();
  assert.equal(await player.getByLabel('Tìm đơn theo mã hoặc tên sân').inputValue(), code);
  assert.equal(new URL(player.url()).searchParams.get('filter'), 'history');
  await bookingRow.getByRole('button', { name: 'Sao chép mã ' + code }).click();
  assert.equal(await player.evaluate(() => navigator.clipboard.readText()), code);
  await bookingRow.locator('summary').click();
  await bookingRow.getByRole('link', { name: 'Đặt lại sân này' }).click();
  await player.waitForURL(origin + '/san/' + venue.slug);
  const calendar = await player.request.get(origin + '/api/bookings/' + code + '/calendar');
  assert.equal(calendar.status(), 200);
  assert.match(calendar.headers()['content-type'], /text\/calendar/);
  assert.match(calendar.headers()['cache-control'], /no-store/);
  const ics = await calendar.text();
  assert.match(ics, /BEGIN:VEVENT\r\n/);
  assert.match(ics, /DTSTART:\d{8}T\d{6}Z/);
  for (const line of ics.split('\r\n')) assert(Buffer.byteLength(line, 'utf8') <= 75);
  assert.equal((await other.request.get(origin + '/api/bookings/' + code + '/calendar')).status(), 404);
  console.log('OK: book-again navigation and private calendar download');

  for (const width of [390, 1440]) {
    await player.setViewportSize({ width, height: 1000 });
    for (const path of ['/tro-giup', '/gop-y', '/san-yeu-thich', '/san/' + venue.slug]) {
      await player.goto(origin + path);
      await player.locator('h1').waitFor();
      await player.evaluate(() => document.fonts.ready);
      assert(await player.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path + ': overflow at ' + width);
      await player.screenshot({ path: join(output, path.split('/')[1] + '-' + width + '.png'), fullPage: true });
    }
  }
  await player.goto(origin + '/tro-giup');
  await player.getByLabel('Tìm câu hỏi', { exact: true }).fill('giu cho');
  const result = player.locator('details').filter({ hasText: 'Được giữ chỗ bao lâu' });
  await result.locator('summary').focus(); await player.keyboard.press('Enter');
  await result.getByText(/15 phút/).waitFor();
  await player.getByLabel('Tìm câu hỏi', { exact: true }).fill('xyzxyzxyz');
  await player.getByText('Chưa tìm thấy câu trả lời phù hợp.', { exact: false }).waitFor();
  await player.getByRole('button', { name: 'Xóa tìm kiếm' }).click();
  assert.equal(await player.locator('details').count(), 14);
  assert.deepEqual(errors, []);
  writeFileSync(join(output, 'result.json'), JSON.stringify({ ok: true, widths: [390, 1440], features: ['feedback', 'favorites', 'share', 'help', 'book-again', 'calendar'] }, null, 2));
  console.log('OK: mobile/desktop layouts, accent-free FAQ search and keyboard access');
} finally {
  if (browser) await browser.close();
  if (fixtures) sql(cleanup);
  rmSync(temp, { recursive: true, force: true });
}
