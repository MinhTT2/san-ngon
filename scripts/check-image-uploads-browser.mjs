import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile } from 'node:fs/promises';
import { createServerClient } from '@supabase/ssr';

assert.equal(process.env.RUN_IMAGE_UPLOAD_E2E, '1', 'Set RUN_IMAGE_UPLOAD_E2E=1 to create a disposable account in the linked project.');
process.loadEnvFile('.env.local');
const origin = process.argv[2] ?? 'http://localhost:3101';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Only run against a local app.');
const project = (await readFile('supabase/.temp/project-ref', 'utf8')).trim();
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, `${project}.supabase.co`);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const execute = promisify(execFile);
const uid = randomUUID(), password = randomBytes(24).toString('hex');
const email = `images-${uid}@example.invalid`;
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
async function sql(query) {
  const { stdout } = await execute('npx', ['supabase', 'db', 'query', '--linked', '--output', 'json', query], { maxBuffer: 4 * 1024 * 1024 });
  const result = stdout.trim() ? JSON.parse(stdout) : [];
  return Array.isArray(result) ? result : result.rows;
}
const output = process.env.UX_SCREENSHOT_DIR ?? 'output/image-uploads';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
let auth;
try {
  const [fixture] = await sql(`begin;
    insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change_token,phone_change,reauthentication_token,created_at,updated_at)
    values(${quote(uid)},'00000000-0000-0000-0000-000000000000','authenticated','authenticated',${quote(email)},extensions.crypt(${quote(password)},extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Kiểm tra ảnh"}','','','','','','','','',now(),now());
    insert into auth.identities(id,user_id,provider_id,identity_data,provider,created_at,updated_at)
    values(gen_random_uuid(),${quote(uid)},${quote(uid)},${quote(JSON.stringify({ sub: uid, email, email_verified: true }))},'email',now(),now());
    update profiles set phone='0900000001' where id=${quote(uid)};
    commit;
    select jsonb_build_object(
      'starts_at',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '10 days','YYYY-MM-DD"T"10:00'),
      'ends_at',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '10 days','YYYY-MM-DD"T"12:00'),
      'registration_deadline',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '9 days','YYYY-MM-DD"T"10:00'),
      'payment_deadline',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '10 days','YYYY-MM-DD"T"09:00')) as schedule;`);
  const cookies = [];
  auth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => cookies, setAll: values => cookies.push(...values) } });
  assert.equal((await auth.auth.signInWithPassword({ email, password })).error, null);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
  await context.addCookies(cookies.map(cookie => ({ name: cookie.name, value: cookie.value, url: origin, sameSite: 'Lax' })));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/giai-dau/tao`);
  const png = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 450;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#0F3D2E'; ctx.fillRect(0, 0, 800, 450);
    ctx.strokeStyle = '#f5f5ed'; ctx.lineWidth = 4; ctx.strokeRect(60, 40, 680, 370);
    ctx.beginPath(); ctx.arc(400, 225, 80, 0, Math.PI * 2); ctx.stroke();
    return canvas.toDataURL('image/png').split(',')[1];
  }), 'base64');
  const image = { name: 'san-kiem-tra.png', mimeType: 'image/png', buffer: png };
  const coverInput = page.getByLabel('Chọn ảnh bìa giải đấu');
  await coverInput.setInputFiles({ name: 'invalid.pdf', mimeType: 'application/pdf', buffer: Buffer.from('pdf') });
  await page.getByRole('alert').filter({ hasText: 'tối đa 5 MB' }).waitFor();
  await coverInput.setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await page.getByRole('alert').filter({ hasText: 'tối đa 5 MB' }).waitFor();
  await coverInput.setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await page.getByRole('alert').filter({ hasText: 'Không đọc được ảnh' }).waitFor();
  for (const [name, value] of Object.entries({ title: 'Giải kiểm tra tải ảnh', description: 'Thể lệ kiểm tra và thông tin liên hệ ban tổ chức.', address: 'Cầu Giấy, Hà Nội', capacity: '8', ...fixture.schedule })) {
    await page.locator(`input[name="${name}"],textarea[name="${name}"]`).fill(value);
  }
  await page.route('**/storage/v1/object/tournament-photos/**', async route => {
    if (route.request().method() === 'POST') await new Promise(resolve => setTimeout(resolve, 1200));
    await route.continue();
  });
  await coverInput.setInputFiles(image);
  await page.getByRole('button', { name: 'Đang tải ảnh…' }).waitFor();
  await page.getByRole('button', { name: 'Gửi đề xuất cho admin' }).click();
  await page.getByRole('alert').filter({ hasText: 'Chờ tải xong' }).waitFor();
  await page.getByRole('button', { name: 'Đổi ảnh bìa' }).waitFor();
  const cover = await page.locator('[name="cover_path"]').inputValue();
  await page.unroute('**/storage/v1/object/tournament-photos/**');
  assert(cover.startsWith(`${uid}/`));
  await page.screenshot({ path: `${output}/tournament-create-desktop.png`, fullPage: true });
  await page.getByRole('button', { name: 'Gửi đề xuất cho admin' }).click();
  await page.waitForURL(/\/giai-dau\/[0-9a-f-]{36}$/);
  const tid = page.url().split('/').at(-1);
  await page.getByAltText('Ảnh bìa giải Giải kiểm tra tải ảnh').waitFor();
  await page.waitForFunction(() => [...document.images].some(img => img.alt.startsWith('Ảnh bìa giải ') && img.naturalWidth > 0));
  assert.equal((await auth.from('tournaments').select('cover_path').eq('id', tid).single()).data.cover_path, cover);
  await auth.storage.from('tournament-photos').remove([cover]);
  assert((await auth.storage.from('tournament-photos').list(uid)).data.some(file => file.name === cover.split('/')[1]), 'linked image must survive deletion');
  await page.goto(`${origin}/giai-dau?view=mine`);
  await page.getByAltText('Ảnh bìa giải Giải kiểm tra tải ảnh').waitFor();
  await page.goto(`${origin}/giai-dau/tao?edit=${tid}`);
  assert.equal(await page.locator('[name="cover_path"]').inputValue(), cover, 'edit retains cover');
  await page.getByRole('button', { name: 'Bỏ ảnh', exact: true }).click();
  assert.equal(await page.locator('[name="cover_path"]').inputValue(), '');
  await coverInput.setInputFiles(image);
  await page.getByRole('button', { name: 'Đổi ảnh bìa' }).waitFor();
  const replacement = await page.locator('[name="cover_path"]').inputValue();
  assert.notEqual(replacement, cover);
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile tournament form must not overflow');
  await page.screenshot({ path: `${output}/tournament-create-mobile.png`, fullPage: true });
  await page.getByRole('button', { name: 'Gửi đề xuất cho admin' }).click();
  await page.waitForURL(`${origin}/giai-dau/${tid}`);
  assert.equal((await auth.from('tournaments').select('cover_path').eq('id', tid).single()).data.cover_path, replacement);
  assert(!(await auth.storage.from('tournament-photos').list(uid)).data.some(file => file.name === cover.split('/')[1]), 'successful edit cleans old cover');
  await page.goto(`${origin}/ket-noi/ho-so`);
  const avatarInput = page.getByLabel('Chọn ảnh đại diện');
  await avatarInput.setInputFiles(image);
  await page.getByRole('status').filter({ hasText: 'Đã lưu ảnh đại diện' }).waitFor();
  const avatar = (await auth.from('profiles').select('avatar_url').eq('id', uid).single()).data.avatar_url;
  assert(avatar.startsWith(`${uid}/`));
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile community profile must not overflow');
  await page.screenshot({ path: `${output}/community-profile-mobile.png`, fullPage: true });
  await page.goto(`${origin}/tai-khoan`);
  await page.waitForFunction(() => [...document.images].some(img => img.alt.startsWith('Ảnh đại diện') && img.src.includes('/avatars/') && img.naturalWidth > 0));
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile account profile must not overflow');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: `${output}/account-profile-desktop.png`, fullPage: true });
  await page.getByLabel('Chọn ảnh đại diện').setInputFiles(image);
  await page.getByRole('status').filter({ hasText: 'Đã lưu ảnh đại diện' }).waitFor();
  const newAvatar = (await auth.from('profiles').select('avatar_url').eq('id', uid).single()).data.avatar_url;
  assert.notEqual(newAvatar, avatar);
  assert(!(await auth.storage.from('avatars').list(uid)).data.some(file => file.name === avatar.split('/')[1]), 'replacement cleans old avatar');
  await page.getByRole('button', { name: 'Xóa ảnh đại diện' }).click();
  await page.getByRole('status').filter({ hasText: 'Đã xóa ảnh đại diện' }).waitFor();
  assert.equal((await auth.from('profiles').select('avatar_url').eq('id', uid).single()).data.avatar_url, null);
  assert.deepEqual(errors, [], 'no browser errors');
  console.log('PASS: cover upload/validation/wait/save/edit/list/detail, linked-file protection, shared avatar upload/replace/remove, desktop/mobile layout.');
} finally {
  // Only this run's random account and its fixtures are removed.
  if (auth) await auth.rpc('set_profile_avatar', { p_path: null });
  await sql(`begin; delete from notifications where user_id=${quote(uid)} or tournament_id in(select id from tournaments where manager_id=${quote(uid)}); delete from tournaments where manager_id=${quote(uid)}; commit;`);
  if (auth) {
    const avatars = (await auth.storage.from('avatars').list(uid)).data ?? [];
    if (avatars.length) await auth.storage.from('avatars').remove(avatars.map(file => `${uid}/${file.name}`));
    const covers = (await auth.storage.from('tournament-photos').list(uid)).data ?? [];
    if (covers.length) await auth.storage.from('tournament-photos').remove(covers.map(file => `${uid}/${file.name}`));
  }
  await sql(`delete from auth.users where id=${quote(uid)};`);
  await browser.close();
}
