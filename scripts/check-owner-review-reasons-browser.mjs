// Synthetic review writes are intercepted; no email, upload or live RPC.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin=process.argv[2];assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
const context=await browser.newContext({locale:'vi-VN'});const page=await context.newPage();
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
async function actor(extra={}){const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',exp=Math.floor(Date.now()/1000)+3600;const token=`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:id,exp,aud:'authenticated',role:'authenticated',fixture_role:'admin',...extra})}.fixture`;await context.clearCookies();await context.addCookies([{name:'sb-127-auth-token',url:origin,value:`base64-${b64({access_token:token,refresh_token:'fixture',expires_at:exp,expires_in:3600,token_type:'bearer',user:{id,email:'fixture@example.invalid'}})}`}]);}
const reviews=[],registrations=[];
await page.route('**/api/admin/owners/*/status',async route=>{reviews.push(route.request().postDataJSON());await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Lỗi thử: hồ sơ vẫn được giữ.'})});});
await page.route('**/api/owner-registration',async route=>{registrations.push(route.request().postData());await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Lỗi thử: giấy tờ vẫn được giữ.'})});});
try{
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});await actor();await page.goto(origin+'/admin/owners/owner-0');
  await page.getByRole('button',{name:'Từ chối',exact:true}).click();const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Lý do cần bổ sung').fill('ngắn');assert(await dialog.getByRole('button',{name:'Gửi yêu cầu bổ sung'}).isDisabled());
  const reason='Bổ sung giấy tờ rõ nét, thể hiện tên người đại diện.';
  await dialog.getByLabel('Lý do cần bổ sung').fill(reason);const n=reviews.length;
  await dialog.getByRole('button',{name:'Gửi yêu cầu bổ sung'}).click();await dialog.getByRole('alert').waitFor();assert.equal(reviews.length,n+1);assert.equal(reviews.at(-1).reason,reason);assert.equal(await dialog.getByLabel('Lý do cần bổ sung').inputValue(),reason);
  await dialog.getByRole('button',{name:'Quay lại'}).click();
  await actor({fixture_application:'rejected'});await page.goto(origin+'/dang-ky-san');await page.getByText(reason,{exact:true}).waitFor();
  await page.getByRole('link',{name:/Cập nhật và gửi lại hồ sơ/}).click();
  await page.getByRole('button',{name:/Tiếp theo/}).click();await page.getByText('Sẽ dùng lại giấy tờ đã gửi:',{exact:false}).waitFor();
  const before=registrations.length;await page.getByRole('button',{name:/Tiếp tục: tài khoản nhận cọc/}).click();await page.getByRole('alert').waitFor();assert.equal(registrations.length,before+1);assert(registrations.at(-1).includes('"reuse_document":true'));assert(!registrations.at(-1).includes('filename='));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 console.log('OK: 390/1440 admin reason validation/failure preserves text, rejected owner sees reason, resubmits with saved document and no new upload.');
}finally{await context.close();await browser.close();}
