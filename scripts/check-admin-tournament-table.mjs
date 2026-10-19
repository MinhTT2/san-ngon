// Synthetic fixtures only; headless Chromium and an isolated session.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin=process.argv[2];
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const output=process.env.UX_SCREENSHOT_DIR;
if(output) await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE} : {})});
try {
  for(const width of [320,390,1024,1440]) {
    const context=await browser.newContext({locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh',viewport:{width,height:1000}});
    try {
      const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',exp=Math.floor(Date.now()/1000)+3600,b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
      async function actor(extra={}) {
        const token=`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:id,exp,aud:'authenticated',role:'authenticated',fixture_role:'admin',fixture_tournament_table:'many',...extra})}.fixture`;
        await context.addCookies([{name:'sb-127-auth-token',url:origin,sameSite:'Lax',value:`base64-${b64({access_token:token,refresh_token:'fixture-only',expires_at:exp,expires_in:3600,token_type:'bearer',user:{id}})}`}]);
      }
      await actor();
      const page=await context.newPage(),errors=[];let writes=0;
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/api/tournaments',async route=>{writes++;await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Cần giữ hồ sơ để đối soát.'})});});
      const region=page.getByRole('region',{name:'Danh sách giải đấu admin'}),groups=page.getByRole('navigation',{name:'Nhóm giải đấu'});
      async function shot(name) {
        if(output && [390,1440].includes(width)) {
          await page.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled(document.getAnimations().map(a=>a.finished));});
          await page.screenshot({path:`${output}/admin-tournaments-${name}-${width}.png`,fullPage:!await page.getByRole('dialog').count()});
        }
      }
      await page.goto(`${origin}/admin/giai-dau`);
      await page.getByRole('heading',{name:'Đề xuất chờ duyệt',exact:true}).waitFor();
      await page.getByText('1–20 / 25 giải',{exact:true}).waitFor();
      assert.match(await groups.locator('[aria-current=page]').innerText(),/Chờ duyệt/);
      assert.equal(await region.getByRole('table').count(),width>=1280 ? 1 : 0,'desktop is a table');
      assert.equal(await region.locator('.pf-tournament-card').count(),0,'admin has no promotional cards');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
      assert.equal(await region.getByRole('link',{name:'Duyệt đề xuất',exact:true}).count(),20);
      assert((await region.getByRole('link',{name:'Duyệt đề xuất',exact:true}).first().getAttribute('href')).endsWith('#duyet-giai'));
      await shot('pending');
      await page.getByRole('link',{name:'Trang sau',exact:true}).click();
      await page.getByText('21–25 / 25 giải',{exact:true}).waitFor();
      assert.equal(await region.getByRole('link',{name:'Duyệt đề xuất',exact:true}).count(),5);
      await region.getByText('Chưa bố trí sân',{exact:true}).filter({visible:true}).waitFor();
      await page.getByRole('searchbox',{name:'Tên giải đấu',exact:true}).fill('Giải chờ duyệt 01');
      await page.getByRole('button',{name:'Lọc giải',exact:true}).click();
      await page.getByText('1–1 / 1 giải',{exact:true}).waitFor();
      assert(!new URL(page.url()).searchParams.has('page'),'filter resets page');
      await groups.getByRole('link',{name:/^Tất cả/}).click();
      assert.equal(new URL(page.url()).searchParams.get('q'),'Giải chờ duyệt 01','group retains name search');
      await page.getByRole('link',{name:'Xóa lọc',exact:true}).click();
      await page.getByText('1–20 / 25 giải',{exact:true}).waitFor();
      await groups.getByRole('link',{name:/^Lịch sử/}).click();
      await page.getByText('1–8 / 8 giải',{exact:true}).waitFor();
      await page.getByLabel('Trạng thái',{exact:true}).selectOption('cancelled');
      await page.getByRole('button',{name:'Lọc giải',exact:true}).click();
      await page.getByText('1–2 / 2 giải',{exact:true}).waitFor();
      await shot('history');
      await page.goto(`${origin}/admin/giai-dau?status=all&page=999999`);
      await page.getByText('41–45 / 45 giải',{exact:true}).waitFor();
      await page.getByLabel('Môn thi đấu',{exact:true}).selectOption('pickleball');
      await page.getByRole('button',{name:'Lọc giải',exact:true}).click();
      await page.getByText('1–1 / 1 giải',{exact:true}).waitFor();
      const record = width >= 1280 ? region.locator('table tbody tr').first() : region.locator('ul > li').first();
      await record.locator('summary').click();
      await region.getByRole('button',{name:'Xóa giải đấu',exact:true}).click();
      const dialog=page.getByRole('dialog',{name:'Xóa giải đấu',exact:true});await dialog.waitFor();
      assert.equal(writes,0,'opening delete never mutates');
      await dialog.getByRole('button',{name:'Quay lại',exact:true}).click();
      assert.equal(writes,0,'dismiss never mutates');
      await region.getByRole('button',{name:'Xóa giải đấu',exact:true}).click();
      await dialog.getByRole('button',{name:'Xác nhận xóa',exact:true}).click();
      await dialog.getByRole('alert').filter({hasText:'Cần giữ hồ sơ'}).waitFor();assert.equal(writes,1);
      await shot('delete');await page.keyboard.press('Escape');
      await actor({fixture_tournament_table:'empty'});
      await page.goto(`${origin}/admin/giai-dau`);
      await page.getByText('Không có đề xuất đang chờ duyệt',{exact:true}).waitFor();
      assert.equal(await page.getByRole('link',{name:'Đề xuất tổ chức giải',exact:true}).count(),0,'admin empty state stays in admin');
      await shot('empty');
      await actor({fixture_read_failure:'tournaments'});
      await page.goto(`${origin}/admin/giai-dau`);
      await page.getByRole('alert').filter({hasText:'Chưa tải được danh sách giải đấu'}).waitFor();
      assert.equal(await page.getByText('Không có đề xuất đang chờ duyệt',{exact:true}).count(),0,'failure is not empty');
      assert.deepEqual(errors,[]);
      console.log(`OK admin tournament table ${width}px: filters, counts, paging/clamp, direct review, missing court, deletion confirmation, empty/error.`);
    } finally {await context.close();}
  }
} finally {await browser.close();}
