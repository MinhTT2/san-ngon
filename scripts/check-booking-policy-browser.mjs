// Only isolated synthetic data; no payment or booking creation.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin=process.argv[2];assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
const context=await browser.newContext();const page=await context.newPage();
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',exp=Math.floor(Date.now()/1000)+3600;
const token=`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:id,exp,aud:'authenticated',role:'authenticated'})}.fixture`;
await context.addCookies([{name:'sb-127-auth-token',url:origin,value:`base64-${b64({access_token:token,refresh_token:'fixture',expires_at:exp,expires_in:3600,token_type:'bearer',user:{id,email:'fixture@example.invalid'}})}`}]);
try{
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});
  for(const [code,hours,days] of [['SANDEF567',2,3],['SANPOL234',6,5]]){
   await page.goto(origin+'/dat-san/'+code);const section=page.getByRole('region',{name:'Chính sách của đơn'});await section.waitFor();
   assert((await section.innerText()).includes(`${hours} giờ`));assert((await section.innerText()).includes(`${days} ngày làm việc`));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.goto(origin+'/don-cua-toi');
  const legacy=page.locator('tr').filter({hasText:'SANABC234'});
  await legacy.locator('summary').filter({hasText:'Các thao tác khác'}).click();
  await legacy.locator('summary').filter({hasText:'Chính sách của đơn'}).click();
  await legacy.getByText('Đơn cũ chưa lưu thời hạn xử lý hoàn tiền.',{exact:false}).waitFor();
 }
 console.log('OK: 390/1440 checkout uses per-order 2/3 and 6/5 snapshots, history honestly identifies an unrecorded legacy refund deadline.');
}finally{await context.close();await browser.close();}
