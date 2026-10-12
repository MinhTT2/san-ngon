// Public policy pages use synthetic infrastructure; no messages or account writes.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const origin=process.argv[2];assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
try {
 const context=await browser.newContext({locale:'vi-VN'}),page=await context.newPage();
 for(const width of [390,1440]) {
  await page.setViewportSize({width,height:1000});
  for(const [path,title] of [['/quyen-rieng-tu','Quyền riêng tư'],['/dieu-khoan-su-dung','Điều khoản sử dụng']]) {
   const response=await page.goto(origin+path);assert.equal(response.status(),200);
   await page.getByRole('heading',{level:1,name:title,exact:true}).waitFor();
   assert(await page.getByRole('heading',{level:2}).count()>=5);
   assert(await page.getByRole('link',{name:'sanngon.exe@gmail.com',exact:true}).count()>0);
   assert(await page.locator('a[href^="/gop-y?trang="]').count()>0);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(process.env.UX_SCREENSHOT_DIR){await mkdir(process.env.UX_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:process.env.UX_SCREENSHOT_DIR+`/policy-${path.slice(1)}-${width}.png`,fullPage:true});}
  }
 }
 const sitemap=await page.request.get(origin+'/sitemap.xml');assert.equal(sitemap.status(),200);const xml=await sitemap.text();
 for(const path of ['/quyen-rieng-tu','/dieu-khoan-su-dung'])assert(xml.includes(path));
 for(const path of ['/admin','/chu-san','/tai-khoan','/gop-y'])assert(!xml.includes(origin+path));
 await context.close();
 const noJs=await browser.newContext({javaScriptEnabled:false}),plain=await noJs.newPage();
 for(const [path,title] of [['/quyen-rieng-tu','Quyền riêng tư'],['/dieu-khoan-su-dung','Điều khoản sử dụng']]){await plain.goto(origin+path);await plain.getByRole('heading',{level:1,name:title,exact:true}).waitFor();}
 await noJs.close();console.log('OK: policies 390/1440, anonymous/no-JS access, help/contact links, public-only sitemap and no horizontal overflow.');
}finally{await browser.close();}
