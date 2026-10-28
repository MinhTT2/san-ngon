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
  await page.goto(origin+'/tai-khoan/du-lieu');await page.getByRole('heading',{name:'Dữ liệu cá nhân của bạn',exact:true}).waitFor();
  const response=await context.request.get(origin+'/api/privacy/export');assert.equal(response.status(),200);assert.equal(response.headers()['cache-control'],'private, no-store');
  const data=await response.json();assert.equal(data.account.id,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');assert(!JSON.stringify(data).includes('access_token'));
  const attempts=[];await page.route('**/api/privacy/request',route=>{attempts.push(route.request().postDataJSON());return route.fulfill({status:503,json:{error:'Thử lại cùng nội dung.'}});});
  await page.getByLabel('Bạn muốn làm gì?',{exact:true}).selectOption('delete');await page.getByLabel('Phạm vi cần xử lý',{exact:true}).fill('Tôi muốn xóa phần hồ sơ kết nối công khai.');
  for(let n=0;n<2;n++){await page.getByRole('button',{name:'Gửi yêu cầu dữ liệu',exact:true}).click();await page.getByRole('alert').filter({hasText:'Thử lại cùng nội dung.'}).waitFor();}
  assert.equal(attempts.length,2);assert.equal(attempts[0].id,attempts[1].id);assert.equal(attempts[0].action,'delete');
  await page.unroute('**/api/privacy/request');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>window.scrollTo(0,0)); await page.waitForTimeout(900);
  if(process.env.UX_SCREENSHOT_DIR){await mkdir(process.env.UX_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:`${process.env.UX_SCREENSHOT_DIR}/personal-data-${width}.png`,fullPage:true});}
  await context.clearCookies();await signIn(context,'admin');await page.goto(origin+'/admin/du-lieu');
  await page.getByRole('heading',{name:'Rà soát lưu dữ liệu',exact:true}).waitFor();await page.getByText('1 mục đến mốc xem xét',{exact:true}).waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await context.clearCookies();assert.equal((await context.request.get(origin+'/api/privacy/export')).status(),401);
 await context.close();console.log('OK: private self export, data request retains UUID after failure, retention review 390/1440 and anonymous denied.');
}finally{await browser.close();}
