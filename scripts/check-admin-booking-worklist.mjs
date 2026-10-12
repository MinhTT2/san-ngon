import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin=process.argv[2];
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE} : {})});
const output=process.env.UX_SCREENSHOT_DIR;
if(output) await mkdir(output,{recursive:true});
try {
  for(const width of [320,390,1024,1440]) {
    const context=await browser.newContext({locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh',viewport:{width,height:1000}});
    try {
      const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url'),id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',exp=Math.floor(Date.now()/1000)+3600;
      const token=`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:id,exp,aud:'authenticated',role:'authenticated',fixture_role:'admin',fixture_owner_history:true})}.fixture`;
      await context.addCookies([{name:'sb-127-auth-token',url:origin,sameSite:'Lax',value:`base64-${b64({access_token:token,refresh_token:'fixture-only',expires_at:exp,expires_in:3600,token_type:'bearer',user:{id,email:'fixture@example.invalid'}})}`}]);
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      const groups=page.getByRole('navigation',{name:'Nhóm đơn đặt sân'});
      const rows=page.getByRole('button',{name:/Chi tiết đơn/}).filter({visible:true});
      async function shot(name) {
        if(!output || ![390,1440].includes(width))return;
        await page.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled(document.getAnimations().map(a=>a.finished));});
        await page.screenshot({path:`${output}/admin-bookings-${name}-${width}.png`,fullPage:true});
      }
      await page.goto(`${origin}/admin?view=bookings`);
      await page.getByRole('heading',{name:'Đơn sắp chơi và đang chơi',exact:true}).waitFor();
      assert.equal(await rows.count(),1,'default excludes cancelled/history');
      assert.match(await groups.locator('[aria-current=page]').innerText(),/Sắp chơi/);
      assert.match(await groups.getByRole('link',{name:/^Lịch sử/}).innerText(),/43/);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page fits viewport');
      await shot('upcoming');
      const trigger=rows.first();await trigger.click();
      const dialog=page.getByRole('dialog',{name:'Đơn SANABC234',exact:true});await dialog.waitFor();
      assert(await dialog.getByText('Chủ sân phụ trách',{exact:true}).count());
      assert(await dialog.getByText('Mốc xử lý',{exact:true}).count());
      assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),'detail fits viewport');
      await shot('detail');await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
      assert(await trigger.evaluate(el=>el===document.activeElement),'focus returns to details button');
      await groups.getByRole('link',{name:/^Chờ cọc/}).click();
      await page.getByRole('heading',{name:'Đơn chờ cọc',exact:true}).waitFor();
      assert.equal(await rows.count(),1,'expired holds are not pending');
      assert.equal(await page.getByText('SANEXP234',{exact:true}).filter({visible:true}).count(),0);
      await groups.getByRole('link',{name:/^Cần hoàn/}).click();
      await page.getByRole('heading',{name:'Đơn cần hoàn cọc',exact:true}).waitFor();
      assert.equal(await rows.count(),1);
      assert.equal(await page.getByText('SANXYZ234',{exact:true}).filter({visible:true}).count(),1);
      await shot('refund');
      await groups.getByRole('link',{name:/^Lịch sử/}).click();
      await page.getByText('1–30 / 43 đơn',{exact:true}).waitFor();assert.equal(await rows.count(),30);
      await page.getByRole('link',{name:'Trang sau',exact:true}).click();
      await page.getByText('31–43 / 43 đơn',{exact:true}).waitFor();assert.equal(await rows.count(),13);
      await shot('history');
      await page.getByRole('searchbox',{name:'Mã đơn, khách, điện thoại hoặc sân',exact:true}).fill('SANXYZ234');
      await page.getByRole('button',{name:'Tìm đơn',exact:true}).click();
      await page.getByText('1–1 / 1 đơn',{exact:true}).waitFor();
      assert.equal(new URL(page.url()).searchParams.get('filter'),'all','search covers every order');
      assert.equal(new URL(page.url()).searchParams.has('page'),false,'search resets pagination');
      assert.equal(await rows.count(),1);
      await groups.getByRole('link',{name:/^Cần hoàn/}).click();
      assert.equal(new URL(page.url()).searchParams.get('q'),'SANXYZ234','queue switch keeps search');
      await page.getByRole('link',{name:'Xóa lọc',exact:true}).click();
      await page.getByRole('heading',{name:'Đơn sắp chơi và đang chơi',exact:true}).waitFor();
      await page.goto(`${origin}/admin?view=bookings&from=2026-10-12&to=2026-10-11`);
      await page.getByRole('alert').filter({hasText:'Khoảng ngày không hợp lệ'}).waitFor();
      await page.goto(`${origin}/admin?view=bookings&q=missing-order&filter=upcoming`);
      await page.getByText('Không có đơn phù hợp',{exact:true}).waitFor();
      assert.equal(await rows.count(),0);
      const refundToken=`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:id,exp,aud:'authenticated',role:'authenticated',fixture_role:'admin',fixture_owner_history:true,fixture_refunds:true})}.fixture`;
      await context.addCookies([{name:'sb-127-auth-token',url:origin,sameSite:'Lax',value:`base64-${b64({access_token:refundToken,refresh_token:'fixture-only',expires_at:exp,expires_in:3600,token_type:'bearer',user:{id,email:'fixture@example.invalid'}})}`}]);
      await page.goto(`${origin}/admin?view=bookings`);
      await page.getByText('Chưa có đơn sắp chơi',{exact:true}).waitFor();
      assert.equal(await rows.count(),0,'do not fill the default view with cancelled orders');
      await shot('empty');
      await page.getByRole('link',{name:'Xem lịch sử đơn',exact:true}).click();
      await page.getByRole('heading',{name:'Lịch sử đặt sân',exact:true}).waitFor();
      assert.deepEqual(errors,[]);
      console.log(`OK admin worklist ${width}px: queues, refunds, history, search, paging, details, focus, dates and empty results.`);
    } finally {await context.close();}
  }
} finally {await browser.close();}
