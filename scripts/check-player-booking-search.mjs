// Private synthetic history on localhost; no account, money or booking mutation.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin=process.argv[2];
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE} : {})});
try {
 for (const width of [390,1440]) {
  const context=await browser.newContext({locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh',viewport:{width,height:1000}});
  const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  async function login(failure='') {
   const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',exp=Math.floor(Date.now()/1000)+3600;
   const token=`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:id,exp,aud:'authenticated',role:'authenticated',fixture_role:'admin',fixture_player_history:true,fixture_read_failure:failure})}.fixture`;
   await context.addCookies([{name:'sb-127-auth-token',url:origin,sameSite:'Lax',value:`base64-${b64({access_token:token,refresh_token:'fixture-only',expires_at:exp,expires_in:3600,token_type:'bearer',user:{id,email:'fixture@example.invalid'}})}`}]);
  }
  try {
   await login();const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`${origin}/don-cua-toi?filter=history`);
   await page.getByRole('status').filter({hasText:'42 đơn trong mục đang xem'}).waitFor();
   assert.equal(await page.locator('.pf-player-booking').count(),30);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.getByRole('link',{name:'Trang sau',exact:true}).click();
   await page.getByRole('navigation',{name:'Phân trang đơn của tôi'}).getByText(/Trang 2 \/ 2/).waitFor();
   assert.equal(await page.locator('.pf-player-booking').count(),12);
   const search=page.getByRole('searchbox',{name:'Tìm đơn theo mã hoặc tên sân',exact:true});
   await search.fill('SANXYZ234');
   await page.getByRole('status').filter({hasText:'1 đơn trong mục đang xem'}).waitFor();
   assert.equal(await page.locator('.pf-player-booking').count(),1);
   await page.getByText('Đang chờ hoàn cọc',{exact:true}).waitFor();
   assert(!new URL(page.url()).searchParams.has('page'));
   assert(await search.evaluate(el=>el===document.activeElement),'server search keeps typing focus');
   await page.reload();
   await page.getByRole('link',{name:'SANXYZ234',exact:true}).waitFor();
   assert.equal(await search.inputValue(),'SANXYZ234');
   await page.getByRole('button',{name:'Xóa tìm kiếm',exact:true}).click();
   await page.getByRole('status').filter({hasText:'42 đơn trong mục đang xem'}).waitFor();
   await search.fill('cau long cau giay');
   await page.getByRole('status').filter({hasText:'42 đơn trong mục đang xem'}).waitFor();
   await page.waitForURL(url=>url.searchParams.get('q')==='cau long cau giay');
   assert.equal(await page.locator('.pf-player-booking').count(),30);
   await page.getByRole('group',{name:'Lọc đơn đặt sân'}).getByRole('button',{name:/Tất cả/}).click();
   await page.getByRole('status').filter({hasText:'44 đơn trong mục đang xem'}).waitFor();
   assert.equal(await page.locator('.pf-player-booking').count(),30);
   if(process.env.UX_SCREENSHOT_DIR) {await page.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled(document.getAnimations().map(a=>a.finished));});await mkdir(process.env.UX_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:`${process.env.UX_SCREENSHOT_DIR}/player-order-history-${width}.png`,fullPage:true});}
   await page.goto(`${origin}/don-cua-toi?filter=all&from=2026-10-10&to=2026-10-09`);
   await page.getByRole('alert').filter({hasText:'Khoảng ngày không hợp lệ'}).waitFor();
   assert.equal(await page.locator('.pf-player-booking').count(),0);
   await page.getByRole('link',{name:'Xóa lọc ngày',exact:true}).click();
   await page.getByRole('status').filter({hasText:'44 đơn trong mục đang xem'}).waitFor();
   await login('search_my_bookings');await page.reload();
   await page.getByRole('alert').filter({hasText:'Chưa tải được đơn của bạn'}).waitFor();
   assert.equal(await page.getByRole('heading',{name:'Chưa có buổi chơi nào',exact:true}).count(),0);
   await login();await page.getByRole('button',{name:'Thử lại',exact:true}).click();
   await page.getByRole('status').filter({hasText:'44 đơn trong mục đang xem'}).waitFor();
   assert.deepEqual(errors,[]);
   console.log(`OK player history ${width}px: bounded pages, full counts, old refund, search/reload/focus, accent-free search, invalid dates and read recovery.`);
  } finally {await context.close();}
 }
} finally {await browser.close();}
