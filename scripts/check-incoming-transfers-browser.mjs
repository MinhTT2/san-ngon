// Isolated headless browser. Note writes are intercepted, read views use synthetic fixtures.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const origin=process.argv[2];assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
const context=await browser.newContext({locale:'vi-VN'}),page=await context.newPage();
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
async function actor(role='owner',extra={}){const id=role==='owner'?'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',exp=Math.floor(Date.now()/1000)+3600;const token=`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:id,exp,aud:'authenticated',role:'authenticated',fixture_role:role,...extra})}.fixture`;await context.clearCookies();await context.addCookies([{name:'sb-127-auth-token',url:origin,value:`base64-${b64({access_token:token,refresh_token:'fixture',expires_at:exp,expires_in:3600,token_type:'bearer',user:{id,email:'fixture@example.invalid'}})}`}]);}
const writes=[];let failed=true;
page.on('pageerror',error=>{ throw error; });
await page.route('**/api/incoming-transfers/*/notes',async route=>{writes.push(route.request().postDataJSON());await route.fulfill({status:failed?409:200,contentType:'application/json',body:JSON.stringify(failed?{error:'Giao dịch có thay đổi. Ghi chú được giữ.'}:{ok:true})});});
try{
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});await actor();await page.goto(origin+'/chu-san/tien-vao');await page.getByRole('heading',{name:'Sổ tiền vào',exact:true}).waitFor();
  await page.getByText('Thiếu tiền · cần đối soát',{exact:true}).waitFor();await page.getByText('Thực nhận giao dịch này',{exact:true}).first().waitFor();
  assert(await page.getByText('160.000đ',{exact:false}).count()>0);assert(await page.getByText('Đã kiểm tra sao kê, chờ liên hệ người gửi.',{exact:true}).count()>0);
  const note=page.getByLabel('Ghi chú đối soát',{exact:true}).first(),save=page.getByRole('button',{name:'Lưu ghi chú',exact:true}).first();
  await note.fill('ngắn');assert(await save.isDisabled());const text='Đã kiểm tra ngân hàng, chờ xác nhận từ người chuyển.';await note.fill(text);
  const before=writes.length;failed=true;await Promise.all([page.waitForResponse(response=>response.url().includes('/notes') && response.request().method()==='POST'),save.click()]);await page.getByRole('alert').filter({hasText:'Giao dịch có thay đổi.'}).waitFor();assert.equal(await note.inputValue(),text);assert.equal(writes.length,before+1);
  await Promise.all([page.waitForResponse(response=>response.url().includes('/notes') && response.request().method()==='POST'),save.click()]);assert.equal(writes.at(-1).note_id,writes.at(-2).note_id,'same retry identifier');
  failed=false;await Promise.all([page.waitForResponse(response=>response.url().includes('/notes') && response.request().method()==='POST'),save.click()]);await page.getByRole('status').filter({hasText:'Đã lưu ghi chú.'}).waitFor();assert.equal(await note.inputValue(),'');
  await page.getByRole('link',{name:'Trang sau →',exact:true}).click();await page.waitForURL(/page=2/);assert.equal(await page.getByLabel('Ghi chú đối soát',{exact:true}).count(),10);
  await page.getByLabel('Mã đặt sân, mã giải, mã phí hoặc mã giao dịch').fill('SANABC234');await page.getByRole('button',{name:'Tìm giao dịch',exact:true}).click();await page.waitForURL(/q=SANABC234/);assert.equal(await page.getByLabel('Ghi chú đối soát',{exact:true}).count(),1);
  await page.getByRole('link',{name:'Đã khớp',exact:true}).click();await page.getByText('Chưa có giao dịch phù hợp.',{exact:false}).waitFor();
  await actor('admin');await page.goto(origin+'/admin/tien-vao?filter=all');await page.getByRole('heading',{name:'Sổ tiền vào',exact:true}).waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(process.env.UX_SCREENSHOT_DIR){await mkdir(process.env.UX_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:process.env.UX_SCREENSHOT_DIR+`/incoming-ledger-${width}.png`,fullPage:true});}
  await actor('owner',{fixture_read_failure:'get_incoming_transfer_page'});await page.goto(origin+'/chu-san/tien-vao');await page.getByText('Chưa tải được sổ tiền vào',{exact:true}).waitFor();assert.equal(await page.getByLabel('Ghi chú đối soát',{exact:true}).count(),0);
 }
 console.log('OK: 390/1440 receiver/admin ledger, distinct actual receipt amounts, safe notes/retained failure/idempotent retry, paging/search/filter/empty/read error and no horizontal overflow.');
}finally{await context.close();await browser.close();}
