// Isolated headless Chromium and synthetic sessions. All mutations intercepted.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import('playwright');
const origin=process.argv[2];assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
const output=process.env.UX_SCREENSHOT_DIR; if(output)await mkdir(output,{recursive:true});
const id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',venue='cccccccc-cccc-4ccc-8ccc-cccccccccccc',court='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const errors=[];
async function session(width,extra={}){
 const context=await browser.newContext({locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh',viewport:{width,height:900},acceptDownloads:true});
 const exp=Math.floor(Date.now()/1000)+3600,b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const token=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:id,exp,aud:'authenticated',role:'authenticated',fixture_role:'owner',...extra})+'.fixture';
 await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+b64({access_token:token,refresh_token:'fixture',expires_at:exp,expires_in:3600,token_type:'bearer',user:{id}}),url:origin,sameSite:'Lax'}]);
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 return {context,page};
}
async function fit(page,label){await page.evaluate(()=>document.fonts.ready);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+': no overflow');}
async function shot(page,name,width){if(output && [390,1440].includes(width))await page.screenshot({path:output+'/remaining-'+name+'-'+width+'.png',fullPage:true});}
try{
 for(const width of [320,390,768,1024,1440]){
  const {context,page}=await session(width,{fixture_many_courts:true,fixture_pending_invoice:true});
  try{
   await page.goto(origin+'/');await page.getByRole('heading',{level:1}).waitFor();
   const search=await page.locator('main form').first().boundingBox(),carousel=await page.getByRole('button',{name:'Dừng chuyển ảnh'}).boundingBox();
   assert(search.y<carousel.y,'Homepage search precedes carousel');
   await page.getByRole('button',{name:'Dừng chuyển ảnh'}).click();assert.equal(await page.getByRole('button',{name:'Tiếp tục chuyển ảnh'}).getAttribute('aria-pressed'),'true');await fit(page,'Home');
   await shot(page,'home',width);
   await page.goto(origin+'/tim-san?ngay=2026-10-09&gio=10%3A00&phut=120');
   await page.getByRole('heading',{name:'Danh sách sân',exact:true}).waitFor();
   assert.equal(await page.getByLabel('Giờ bắt đầu (tùy chọn)').inputValue(),'10:00');
   assert.equal(await page.getByLabel('Thời lượng chơi').inputValue(),'120');
   const schedule=page.getByRole('link',{name:'Xem lịch',exact:true}).first();
   const href=await schedule.getAttribute('href');assert(href.includes('gio=10%3A00')&&href.includes('phut=120')&&href.endsWith('#lich-san'));
   await schedule.click();await page.getByRole('region',{name:'Thông tin đặt sân'}).waitFor({state:'hidden'});
   await page.getByRole('heading',{name:'Giờ nào còn sân?',exact:true}).waitFor();
   await page.getByRole('button',{name:/10:00, còn sân/}).waitFor();
   assert.equal(await page.getByRole('button',{name:/10:00, còn sân/}).getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('#booking-duration').inputValue(),'120');
   assert((await page.getByRole('button',{name:'Chia sẻ'}).count())>0);
   await fit(page,'Venue');await shot(page,'venue',width);
   if(width<1024){const bar=page.getByRole('region',{name:'Lựa chọn nhanh trên điện thoại'});await bar.getByRole('button',{name:'Tiếp tục →',exact:true}).click();}
   else await page.getByRole('button',{name:'Tiếp tục đặt sân',exact:false}).click();
   await page.getByRole('region',{name:'Thông tin đặt sân'}).waitFor();await fit(page,'Booking form');
   await page.goto(origin+'/chu-san');await page.getByRole('heading',{name:'Sân Cầu Giấy',exact:true}).waitFor();
   await page.getByText('Chuẩn bị nhận đặt').waitFor();
   const today=await page.getByRole('heading',{name:'Đơn hôm nay',exact:true}).boundingBox(),revenue=await page.getByText('Theo dõi doanh thu và công suất để biết sân nào cần lấp lịch.',{exact:true}).boundingBox();
   assert(today.y<revenue.y,'Operations ahead of revenue');await fit(page,'Owner');await shot(page,'owner',width);
   await page.goto(origin+'/chu-san/hoan-coc');await page.getByRole('heading',{name:'Hoàn cọc và lịch sử'}).waitFor();
   await page.getByRole('link',{name:/Đã hoàn/}).click();await page.getByText('Khách đã hoàn',{exact:false}).waitFor();
   assert.equal(await page.getByRole('button',{name:'Đã hoàn cọc',exact:true}).count(),0);await fit(page,'Refund history');await shot(page,'refunds',width);
   await page.goto(origin+'/chu-san/lich?court='+court);
   await page.getByRole('heading',{name:'Lịch sân',exact:true}).waitFor();
   await page.getByLabel('Tìm sân nhanh').fill('kiem thu 14');
   assert.equal(await page.getByRole('navigation',{name:'Chọn sân',exact:true}).getByRole('link').count(),1);
   await fit(page,'Court picker');await shot(page,'court-picker',width);
   await page.goto(origin+'/chu-san/bang-gia/'+court);await page.getByRole('button',{name:'Xem giá đã lưu',exact:true}).click();
   await page.getByRole('region',{name:'Xem giá thực tế'}).getByText('100.000đ',{exact:true}).waitFor();await fit(page,'Price preview');await shot(page,'price-preview',width);
   await page.route('**/qr.sepay.vn/**',route=>route.abort());
   await page.goto(origin+'/chu-san/phi-dich-vu');await page.getByText('Không tải được mã QR.',{exact:false}).waitFor();
   await page.getByRole('button',{name:'Tải lại mã QR',exact:true}).waitFor();await page.getByRole('button',{name:'Sao chép số tiền',exact:true}).waitFor();
   await page.route('**/qr.sepay.vn/**',route=>route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="white"/></svg>'}));
   await page.getByRole('button',{name:'Tải lại mã QR',exact:true}).click();await page.getByRole('button',{name:'Lưu ảnh QR',exact:true}).waitFor();
   const download=page.waitForEvent('download');await page.getByRole('button',{name:'Lưu ảnh QR',exact:true}).click();assert((await download).suggestedFilename().endsWith('.svg'));await fit(page,'Subscription');await shot(page,'subscription',width);
   await page.goto(origin+'/ho-tro-giao-dich?code=SANABC234');await page.getByRole('heading',{name:'Hỗ trợ chuyển khoản',exact:true}).waitFor();
   await fit(page,'Private support');await shot(page,'support',width);
   const csv=await context.request.get(origin+'/api/owner/reconciliation?venue='+venue+'&from=2026-10-01&to=2026-10-09');
   assert.equal(csv.status(),200);const text=await csv.text();assert(text.includes("'=HYPERLINK"));assert(text.includes('Cọc trên đơn (VND)'));
   const invalid=await context.request.get(origin+'/api/owner/reconciliation?venue='+venue+'&from=2026-10-09&to=2026-10-01');assert.equal(invalid.status(),400);
  }finally{await context.close();}
  console.log('OK: remaining audit flows at '+width+'px');
 }
 const {context,page}=await session(390);
 try{
  await page.goto(origin+'/ket-noi/ho-so');const preview=page.locator('[aria-label="Xem trước quyền công khai"]');
  await preview.getByText('Hồ sơ đang chọn ẩn.',{exact:false}).waitFor();
  await page.locator('input[name=is_public]').check();await preview.getByText('Ẩn toàn bộ kênh liên hệ.',{exact:true}).waitFor();
  await page.locator('input[name=show_phone]').check();await preview.getByText('Điện thoại: 0901234567',{exact:true}).waitFor();
  assert.equal(await preview.getByText('Zalo:',{exact:false}).count(),0);
  await page.locator('input[name=display_name]').fill('Bản nháp chưa lưu');
  page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('link',{name:'← Kết nối người chơi',exact:true}).click();assert(new URL(page.url()).pathname==='/ket-noi/ho-so');await fit(page,'Privacy');await shot(page,'privacy',390);
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('link',{name:'← Kết nối người chơi',exact:true}).click();
  await page.goto(origin+'/ho-tro-giao-dich?code=SANABC234');
  await page.getByLabel('Nội dung cần đối soát').fill('Đã chuyển tiền nhưng đơn sân chưa được xác nhận.');
  const bodies=[];await page.route('**/api/payment-support',route=>{bodies.push(route.request().postDataJSON());return route.fulfill({status:bodies.length===1?503:200,contentType:'application/json',body:JSON.stringify(bodies.length===1?{error:'Lỗi đối soát giả lập'}:{id:'ffffffff-ffff-4fff-8fff-ffffffffffff'})});});
  await page.getByRole('button',{name:'Gửi yêu cầu đối soát',exact:true}).click();await page.getByRole('alert').filter({hasText:'Lỗi đối soát giả lập'}).waitFor();
  assert((await page.getByLabel('Nội dung cần đối soát').inputValue()).length>20);
  await page.getByRole('button',{name:'Gửi yêu cầu đối soát',exact:true}).click();await page.getByText('Đã tiếp nhận.',{exact:false}).waitFor();assert.equal(bodies[0].id,bodies[1].id);
 }finally{await context.close();}
 assert.deepEqual(errors,[]);console.log('OK: privacy switches, unsaved drafts, private inquiry retry and scoped CSV.');
}finally{await browser.close();}
