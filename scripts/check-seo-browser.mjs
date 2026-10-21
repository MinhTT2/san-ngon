import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin=process.argv[2];assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
try{
 const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage();
 for(const path of ['/tim-san','/giai-dau']){
  await page.goto(origin+path);assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),origin+path);
  const robots=await page.locator('meta[name=robots]').count()?await page.locator('meta[name=robots]').getAttribute('content'):null;assert(!robots?.includes('noindex'));
  for(const query of ['?sport=badminton','?page=2','?q=abc&q=def']){
   const response=await page.goto(origin+path+query);assert.equal(response.status(),200);await page.getByRole('heading',{name:path==='/tim-san'?'Tìm sân ở Hà Nội':'Giải đấu thể thao',exact:true}).waitFor();
   assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),origin+path);
   const value=await page.locator('meta[name=robots]').getAttribute('content');assert(value.includes('noindex')&&!value.includes('nofollow'));
  }
 }
 await page.goto(origin+'/san/san-cau-giay?ngay=2026-10-08&sport=badminton');
 assert.match(await page.title(),/Sân Cầu Giấy/);
 assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),origin+'/san/san-cau-giay');
 let schema=JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
 assert.equal(schema['@type'],'SportsActivityLocation');assert.equal(schema.name,'Sân Cầu Giấy');assert.equal(schema.address.addressCountry,'VN');assert(!('owner_id' in schema));
 const id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeef';
 await page.goto(origin+'/giai-dau/'+id);schema=JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
 assert.equal(schema['@type'],'SportsEvent');assert.equal(schema.name,'Cầu lông Hà Nội mở rộng');assert.equal(schema.startDate,'2026-12-01T03:00:00Z');
 assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),origin+'/giai-dau/'+id);
 await page.goto(origin+'/giai-dau/'+id+'?view=payments');assert.equal(await page.locator('script[type="application/ld+json"]').count(),0);assert.match(await page.locator('meta[name=robots]').getAttribute('content'),/noindex, nofollow/);
 // The isolated fixture lets an authorized manager see hidden content to exercise metadata guards.
 const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),exp=Math.floor(Date.now()/1000)+3600,userId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 const token=b64({alg:'HS256'})+'.'+b64({sub:userId,exp,aud:'authenticated',role:'authenticated',fixture_role:'owner',fixture_content_hidden:true})+'.fixture';
 await context.addCookies([{name:'sb-127-auth-token',url:origin,value:'base64-'+b64({access_token:token,refresh_token:'fixture',expires_at:exp,expires_in:3600,token_type:'bearer',user:{id:userId,email:'fixture@example.invalid'}})}]);
 await page.goto(origin+'/giai-dau/'+id);assert.equal(await page.locator('script[type="application/ld+json"]').count(),0);assert.match(await page.locator('meta[name=robots]').getAttribute('content'),/noindex, nofollow/);assert(!((await page.title()).includes('Hà Nội mở rộng')));
 await context.close();console.log('OK: venue/event metadata and JSON-LD, filtered canonical/noindex, private views and hidden event guards.');
}finally{await browser.close();}
