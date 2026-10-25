import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.argv[2];
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
async function signIn(context, role) {
  const id = role === 'admin' ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' : 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, exp, aud: 'authenticated', role: 'authenticated', fixture_role: role })}.fixture`;
  await context.addCookies([{ name: 'sb-127-auth-token', url: origin, value: `base64-${b64({ access_token: token, refresh_token: 'fixture', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id, email: 'fixture@example.invalid' } })}` }]);
}
try {
 const context=await browser.newContext({reducedMotion:'reduce'});const page=await context.newPage();const findings=[];
 const routes=[['/','public'],['/tim-san','public'],['/san/san-cau-giay','public'],['/giai-dau','public'],['/dang-nhap','public'],['/quyen-rieng-tu','public'],['/tai-khoan/du-lieu','owner'],['/chu-san/bao-cao-tien','owner'],['/admin/nhat-ky','admin']];
 for(const width of [390,1440]) for(const [path,role] of routes){
  await context.clearCookies();if(role!=='public')await signIn(context,role);await page.setViewportSize({width,height:1000});
  const response=await page.goto(origin+path);assert.equal(response.status(),200,path);await page.locator('h1').first().waitFor();await page.waitForTimeout(300);
  const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  for(const violation of results.violations)findings.push({path,width,id:violation.id,impact:violation.impact,help:violation.help,nodes:violation.nodes.map(node=>({target:node.target,summary:node.failureSummary}))});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path+' overflow '+width);
 }
 await context.clearCookies();await page.goto(origin+'/tim-san');await page.keyboard.press('Tab');
 assert.equal(await page.locator(':focus').getAttribute('href'),'#noi-dung');await page.keyboard.press('Enter');assert.equal(await page.locator(':focus').getAttribute('id'),'noi-dung');
 if(process.env.UX_SCREENSHOT_DIR){await mkdir(process.env.UX_SCREENSHOT_DIR,{recursive:true});await writeFile(`${process.env.UX_SCREENSHOT_DIR}/accessibility.json`,JSON.stringify(findings,null,2));}
 assert.deepEqual(findings,[],'automatically detectable WCAG A/AA issues');
 await context.close();console.log('OK: axe WCAG A/AA public/account/owner/admin 390/1440, overflow and keyboard skip link. Manual screen-reader assessment remains separate.');
}finally{await browser.close();}
