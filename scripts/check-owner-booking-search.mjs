// Synthetic read fixtures only; no real account, booking or payment is modified.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin = process.argv[2];
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
try {
 for (const width of [390,1440]) {
  const context = await browser.newContext({ locale:'vi-VN', timezoneId:'Asia/Ho_Chi_Minh', viewport:{width,height:1000} });
  try {
   const exp=Math.floor(Date.now()/1000)+3600, id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
   const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
   const token=`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:id,exp,aud:'authenticated',role:'authenticated',fixture_role:'owner',fixture_owner_history:true})}.fixture`;
   await context.addCookies([{name:'sb-127-auth-token',url:origin,sameSite:'Lax',value:`base64-${b64({access_token:token,refresh_token:'fixture-only',expires_at:exp,expires_in:3600,token_type:'bearer',user:{id,email:'fixture@example.invalid'}})}`}]);
   const page=await context.newPage(), errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`${origin}/chu-san/don?scope=all`);
   await page.getByRole('heading',{name:'Cả lịch sử đặt sân',exact:true}).waitFor();
   assert.equal(await page.locator('.pf-booking-record').count(),30);
   await page.getByText(/1–30 \/ 42 đơn/).waitFor();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.getByRole('link',{name:'Trang sau',exact:true}).click();
   await page.getByText('Trang 2 / 2',{exact:true}).waitFor();
   assert.equal(await page.locator('.pf-booking-record').count(),12);
   assert.equal(new URL(page.url()).searchParams.get('scope'),'all');
   assert.equal(await page.getByLabel('Phạm vi',{exact:true}).inputValue(),'all');
   await page.getByLabel('Mã đơn, số điện thoại hoặc tên khách',{exact:true}).fill('SANXYZ234');
   await page.getByRole('button',{name:'Lọc đơn',exact:true}).click();
   await page.getByText('Khách lịch sử',{exact:true}).waitFor();
   assert.equal(await page.locator('.pf-booking-record').count(),1);
   assert.equal(new URL(page.url()).searchParams.has('page'),false,'filter resets pagination');
   await page.getByLabel('Mã đơn, số điện thoại hoặc tên khách',{exact:true}).fill('0912345678');
   await page.getByRole('button',{name:'Lọc đơn',exact:true}).click();
   await page.getByText('Khách lịch sử',{exact:true}).waitFor();
   assert.equal(await page.locator('.pf-booking-record').count(),1);
   if(process.env.UX_SCREENSHOT_DIR) {await page.locator('main form').scrollIntoViewIfNeeded();await page.evaluate(async () => {await document.fonts.ready;await Promise.allSettled(document.getAnimations().map(a=>a.finished));});await mkdir(process.env.UX_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:`${process.env.UX_SCREENSHOT_DIR}/owner-order-search-${width}.png`,fullPage:true});}
   await page.getByRole('link',{name:'Xóa lọc',exact:true}).click();
   await page.waitForURL(url => !url.searchParams.has('q'));
   await page.waitForFunction(() => document.querySelector('input[name=q]')?.value === '');
   assert.equal(await page.getByLabel('Mã đơn, số điện thoại hoặc tên khách',{exact:true}).inputValue(),'');
   assert.equal(await page.getByLabel('Phạm vi',{exact:true}).inputValue(),'upcoming');
   await page.getByLabel('Chỉ đơn cần hoàn cọc',{exact:true}).check();
   await page.getByRole('button',{name:'Lọc đơn',exact:true}).click();
   await page.getByText('Khách lịch sử',{exact:true}).waitFor();
   assert.equal(await page.locator('.pf-booking-record').count(),1);
   assert.equal(await page.getByLabel('Phạm vi',{exact:true}).inputValue(),'all');
   await page.goto(`${origin}/chu-san/don?from=2026-10-10&to=2026-10-09`);
   await page.getByRole('alert').filter({hasText:'Khoảng ngày không hợp lệ'}).waitFor();
   assert.equal(await page.getByText('Chưa có đơn nào',{exact:true}).count(),0,'invalid range is never empty data');
   assert.deepEqual(errors,[]);
   console.log(`OK owner booking search ${width}px: history, paging, code/phone filters, reset and invalid range.`);
  } finally {await context.close();}
 }
} finally {await browser.close();}
