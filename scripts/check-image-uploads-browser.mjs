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
  let uploads = 0;
  page.on('request', request => { if (request.method() === 'POST' && /\/storage\/v1\/object\/(avatars|tournament-photos)\//.test(request.url())) uploads++; });
  const crop = page.getByRole('dialog');
  async function applyCrop() {
    await crop.getByRole('button', { name: 'Dùng ảnh này' }).click();
    await crop.waitFor({ state: 'detached' });
  }
  async function noOverflow(label) {
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label);
  }
  await page.screenshot({ path: `${output}/tournament-empty-desktop.png`, fullPage: true });
  await page.locator('input[name="title"]').fill('Giải kiểm tra tải ảnh');
  await coverInput.setInputFiles(image);
  await crop.waitFor();
  assert.equal(uploads, 0, 'image is not uploaded before crop approval');
  await crop.getByLabel('Phóng to ảnh').fill('2');
  await crop.getByLabel('Trái / phải', { exact: true }).fill('75');
  await crop.getByLabel('Trên / dưới', { exact: true }).fill('25');
  const originalPosition = await crop.getByLabel('Trái / phải', { exact: true }).inputValue();
  const frame = await crop.getByLabel('Khung cắt ảnh').boundingBox();
  await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
  await page.mouse.down(); await page.mouse.move(frame.x + frame.width / 2 + 30, frame.y + frame.height / 2); await page.mouse.up();
  assert.notEqual(await crop.getByLabel('Trái / phải', { exact: true }).inputValue(), originalPosition, 'pointer drag changes crop');
  await crop.getByRole('button', { name: 'Dùng ảnh này' }).focus();
  await page.keyboard.press('Tab');
  assert(await crop.evaluate(element => element.contains(document.activeElement)), 'focus stays inside editor');
  await page.screenshot({ path: `${output}/cover-crop-desktop.png` });
  await page.keyboard.press('Escape');
  await crop.waitFor({ state: 'detached' });
  assert.equal(uploads, 0, 'cancel leaves storage untouched');
  assert.equal(await page.locator('input[name="title"]').inputValue(), 'Giải kiểm tra tải ảnh', 'cancel keeps form values');
  assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'closing restores page scrolling');
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
  await applyCrop();
  await page.getByRole('button', { name: 'Đang tải ảnh…' }).waitFor();
  assert(await page.getByRole('button', { name: 'Đang chuẩn bị ảnh…' }).isDisabled(), 'submit waits for upload');
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
  await page.screenshot({ path: `${output}/tournament-list-desktop.png`, fullPage: true });
  await page.goto(`${origin}/giai-dau/tao?edit=${tid}`);
  assert.equal(await page.locator('[name="cover_path"]').inputValue(), cover, 'edit retains cover');
  await page.getByRole('button', { name: 'Bỏ ảnh', exact: true }).click();
  assert.equal(await page.locator('[name="cover_path"]').inputValue(), '');
  // Drag/drop works with the same validation and crop as the file picker.
  const drop = page.getByRole('button', { name: /Thêm khoảnh khắc/ });
  await drop.evaluate((element, base64) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], 'anh-keo-tha.png', { type: 'image/png' }));
    transfer.items.add(new File([bytes], 'anh-thu-hai.png', { type: 'image/png' }));
    element.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
  }, png.toString('base64'));
  await page.getByRole('alert').filter({ hasText: 'Chọn một ảnh bìa' }).waitFor();
  await drop.evaluate((element, base64) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], 'anh-keo-tha.png', { type: 'image/png' }));
    element.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
  }, png.toString('base64'));
  await crop.waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await crop.getByRole('button', { name: 'Giữ toàn bộ ảnh' }).click();
  await page.screenshot({ path: `${output}/cover-editor-mobile.png` });
  await applyCrop();
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
  await page.screenshot({ path: `${output}/tournament-detail-mobile.png`, fullPage: true });
  // A portrait poster keeps both ends when requested, then exports the chosen crop.
  await page.goto(`${origin}/giai-dau/tao?edit=${tid}`);
  const portraitPng = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 900;
    const ctx = canvas.getContext('2d');
    for (const [i, color] of ['#d00000', '#008000', '#0000d0'].entries()) { ctx.fillStyle = color; ctx.fillRect(0, i * 300, 600, 300); }
    return canvas.toDataURL('image/png').split(',')[1];
  }), 'base64');
  const portrait = { name: 'poster-doc.png', mimeType: 'image/png', buffer: portraitPng };
  async function coverPixels() {
    return page.getByAltText('Xem trước ảnh bìa giải đấu').evaluate(async element => {
      const bitmap = await createImageBitmap(await (await fetch(element.src)).blob());
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
      const pixel = (x, y) => [...ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data];
      const result = { width: bitmap.width, height: bitmap.height, top: pixel(bitmap.width / 2, bitmap.height * 0.05), bottom: pixel(bitmap.width / 2, bitmap.height * 0.95), corner: pixel(bitmap.width * 0.05, bitmap.height / 2) };
      bitmap.close(); return result;
    });
  }
  await coverInput.setInputFiles(portrait); await crop.waitFor();
  await crop.getByRole('button', { name: 'Giữ toàn bộ ảnh' }).click();
  await applyCrop(); await page.getByRole('button', { name: 'Đổi ảnh bìa' }).waitFor();
  const full = await coverPixels();
  assert(Math.abs(full.width / full.height - 16 / 9) < 0.01);
  assert(full.top[0] > 180 && full.top[2] < 30, 'full poster retains red top');
  assert(full.bottom[2] > 180 && full.bottom[0] < 30, 'full poster retains blue bottom');
  assert(full.corner[0] < 30 && full.corner[1] > 40 && full.corner[1] < 85, 'letterboxing uses pitch background');
  await coverInput.setInputFiles(portrait); await crop.waitFor();
  await crop.getByLabel('Phóng to ảnh').fill('2');
  await crop.getByLabel('Trên / dưới', { exact: true }).fill('0');
  await applyCrop(); await page.getByRole('button', { name: 'Đổi ảnh bìa' }).waitFor();
  const cut = await coverPixels();
  assert(cut.top[0] > 180 && cut.bottom[0] > 180, 'export matches zoomed crop at chosen top position');
  // Failed replacement keeps the uploaded cover and form; retry reuses the file.
  const beforeFailure = await page.locator('[name="cover_path"]').inputValue();
  let failCover = true;
  await page.route('**/storage/v1/object/tournament-photos/**', async route => {
    if (route.request().method() === 'POST' && failCover) { failCover = false; await route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Temporary upload failure"}' }); }
    else await route.continue();
  });
  await coverInput.setInputFiles(image); await applyCrop();
  await page.getByRole('alert').filter({ hasText: 'Chưa tải được ảnh' }).waitFor();
  assert.equal(await page.locator('[name="cover_path"]').inputValue(), beforeFailure);
  assert.equal(await page.locator('input[name="title"]').inputValue(), 'Giải kiểm tra tải ảnh');
  await page.getByRole('button', { name: 'Thử tải lại ảnh' }).click();
  await page.getByRole('button', { name: 'Đổi ảnh bìa' }).waitFor();
  assert.notEqual(await page.locator('[name="cover_path"]').inputValue(), beforeFailure);
  await page.unroute('**/storage/v1/object/tournament-photos/**');
  await page.goto(`${origin}/ket-noi/ho-so`);
  const avatarFile = page.getByLabel('Chọn file ảnh đại diện');
  await avatarFile.setInputFiles(image);
  await crop.waitFor();
  await crop.getByLabel('Phóng to ảnh').fill('1.5');
  await crop.getByLabel('Trái / phải', { exact: true }).fill('65');
  await page.screenshot({ path: `${output}/avatar-editor-mobile.png` });
  await applyCrop();
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
  await page.getByLabel('Chọn file ảnh đại diện').setInputFiles(image);
  await crop.waitFor();
  // Keyboard users can operate ranges, reset and cancel inside the modal.
  await crop.getByLabel('Phóng to ảnh').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await crop.getByLabel('Phóng to ảnh').inputValue(), '1.05');
  await crop.getByRole('button', { name: 'Đặt lại' }).click();
  assert.equal(await crop.getByLabel('Phóng to ảnh').inputValue(), '1');
  await applyCrop();
  await page.getByRole('status').filter({ hasText: 'Đã lưu ảnh đại diện' }).waitFor();
  const newAvatar = (await auth.from('profiles').select('avatar_url').eq('id', uid).single()).data.avatar_url;
  assert.notEqual(newAvatar, avatar);
  const dimensions = await page.evaluate(async () => {
    const src = [...document.images].find(img => img.alt.startsWith('Ảnh đại diện') && img.src.includes('/avatars/'))?.src;
    const bitmap = await createImageBitmap(await (await fetch(src)).blob());
    const result = { width: bitmap.width, height: bitmap.height }; bitmap.close(); return result;
  });
  assert.equal(dimensions.width, dimensions.height, 'avatar crop exports square file');
  assert(!(await auth.storage.from('avatars').list(uid)).data.some(file => file.name === avatar.split('/')[1]), 'replacement cleans old avatar');
  let failAvatar = true;
  await page.route('**/storage/v1/object/avatars/**', async route => {
    if (route.request().method() === 'POST' && failAvatar) { failAvatar = false; await route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Temporary upload failure"}' }); }
    else await route.continue();
  });
  await page.getByLabel('Chọn file ảnh đại diện').setInputFiles(image); await applyCrop();
  await page.getByRole('alert').filter({ hasText: 'Chưa tải được ảnh' }).waitFor();
  assert.equal((await auth.from('profiles').select('avatar_url').eq('id', uid).single()).data.avatar_url, newAvatar, 'failed avatar upload retains saved picture');
  await page.getByRole('button', { name: 'Thử tải lại ảnh' }).click();
  await page.getByRole('status').filter({ hasText: 'Đã lưu ảnh đại diện' }).waitFor();
  await page.unroute('**/storage/v1/object/avatars/**');
  await page.getByRole('button', { name: 'Xóa ảnh đại diện' }).click();
  await page.getByRole('status').filter({ hasText: 'Đã xóa ảnh đại diện' }).waitFor();
  assert.equal((await auth.from('profiles').select('avatar_url').eq('id', uid).single()).data.avatar_url, null);
  // Validate portrait card and inline uploader at common desktop/mobile widths.
  for (const route of ['/tai-khoan', '/ket-noi/ho-so', `/giai-dau/tao?edit=${tid}`]) {
    await page.goto(`${origin}${route}`);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await noOverflow(`${route} at ${width}px`);
    }
  }
  assert.deepEqual(errors, [], 'no browser errors');
  console.log('PASS: crop/contain/keyboard/cancel, drag/drop validation, upload waiting/save/edit/list/detail, shared avatar replacement/removal, 320–1440px layout.');
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
