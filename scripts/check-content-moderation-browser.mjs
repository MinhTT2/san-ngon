import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const origin = process.argv[2];
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
async function signIn(context, role) {
  const id = role === 'admin' ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' : 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, exp, aud: 'authenticated', role: 'authenticated', fixture_role: role })}.fixture`;
  await context.addCookies([{ name: 'sb-127-auth-token', url: origin, value: `base64-${b64({ access_token: token, refresh_token: 'fixture', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id, email: 'fixture@example.invalid' } })}` }]);
}
try {
 const context=await browser.newContext();const page=await context.newPage();
 for(const width of [390,1440]) {
  await page.setViewportSize({width,height:1000});await context.clearCookies();await signIn(context,'owner');
  await page.goto(origin+'/gop-y?trang=%2Fket-noi%2Fbbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb&loai=report');
  assert.equal(await page.getByLabel('Loại góp ý',{exact:true}).inputValue(),'report');
  await context.clearCookies();await signIn(context,'admin');
  await page.goto(origin+'/admin/gop-y/f1070000-0000-4000-8000-000000000001');
  await page.getByRole('heading',{name:'Phạm vi công khai: Đang hiển thị',exact:true}).waitFor();
  await page.getByText('Không hủy giải, trả lịch hoặc đổi vai trò tài khoản.',{exact:false}).waitFor();
  let payload;
  await page.route('**/api/admin/content-moderation',route=>{payload=route.request().postDataJSON();return route.fulfill({status:409,json:{error:'Nội dung vừa được xử lý. Tải lại để xem trạng thái mới.'}});});
  await page.getByLabel('Lý do gửi cho người đăng',{exact:true}).fill('Cần kiểm tra lại nội dung công khai');
  await page.getByRole('button',{name:'Tạm ẩn nội dung',exact:true}).click();
  await page.getByText('Nội dung vừa được xử lý. Tải lại để xem trạng thái mới.',{exact:true}).waitFor();
  assert.deepEqual(payload,{kind:'community',id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',hidden:true,reason:'Cần kiểm tra lại nội dung công khai',updated_at:null});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.unroute('**/api/admin/content-moderation');
 }
 await context.close();console.log('OK: report default, admin moderation reason, explicit scope and concurrency conflict 390/1440.');
}finally{await browser.close();}
