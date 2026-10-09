// Snapshot fixtures deliberately differ from current venue/court data.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin=process.argv[2];assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE} : {})});
try {
 for(const width of [390,1440]) {
  const context=await browser.newContext({locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh',viewport:{width,height:1000}});
  try {
   const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
   async function login(role) {
    const id=role==='owner' ? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' : 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',exp=Math.floor(Date.now()/1000)+3600;
    const token=`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:id,exp,aud:'authenticated',role:'authenticated',fixture_role:role,fixture_booking_snapshot:true})}.fixture`;
    await context.addCookies([{name:'sb-127-auth-token',url:origin,sameSite:'Lax',value:`base64-${b64({access_token:token,refresh_token:'fixture-only',expires_at:exp,expires_in:3600,token_type:'bearer',user:{id,email:'fixture@example.invalid'}})}`}]);
   }
   await login('admin');const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://qr.sepay.vn/**',route=>route.abort('failed'));
   for(const code of ['SANDEF567','SANABC234','SANHJK234','SANCAN234']) {
    await page.goto(`${origin}/dat-san/${code}`);
    await page.getByText('Cụm sân lúc đặt',{exact:true}).filter({visible:true}).first().waitFor();
    const details=page.getByText('Thông tin chi tiết',{exact:true}).filter({visible:true});if(await details.count()) await details.click();
    const text=await page.locator('main').innerText();assert.match(text,/Sân con lúc đặt/);assert.match(text,/12 Địa chỉ lúc đặt/);
    assert.doesNotMatch(text,/Sân con mới|Cụm sân mới|34 Địa chỉ mới/);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   }
   await page.goto(`${origin}/don-cua-toi?filter=all`);
   await page.locator('.pf-player-booking').first().waitFor();
   assert.equal(await page.locator('.pf-player-booking').count(),2);
   for(const row of await page.locator('.pf-player-booking').all()) {assert.match(await row.innerText(),/Cụm sân lúc đặt/);assert.match(await row.innerText(),/Sân con lúc đặt/);assert.match(await row.innerText(),/Quận lúc đặt/);}
   await login('owner');await page.goto(`${origin}/chu-san/don`);
   await page.locator('.pf-booking-record').first().waitFor();
   assert.equal(await page.locator('.pf-booking-record').count(),2);
   for(const row of await page.locator('.pf-booking-record').all()) assert.match(await row.innerText(),/Sân con lúc đặt/);
   assert.deepEqual(errors,[]);
   console.log(`OK booking details ${width}px: original names/address on pending, confirmed, completed, cancelled checkout and private histories.`);
  } finally {await context.close();}
 }
} finally {await browser.close();}
