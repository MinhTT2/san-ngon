import assert from 'node:assert/strict';
import { chromium } from 'playwright';
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
 const context=await browser.newContext();const page=await context.newPage();await signIn(context,'admin');
 for(const width of [390,1440]) {
  await page.setViewportSize({width,height:1000});await page.goto(origin+'/admin/thong-ke-truy-cap');
  await page.getByRole('heading',{name:'Từ tạo đơn đến xác nhận cọc',exact:true}).waitFor();
  await page.getByText('Tỷ lệ đơn đã có cọc: 40%',{exact:true}).waitFor();
  await page.getByText('Xem theo ngày tạo đơn',{exact:true}).click();
  await page.getByRole('rowheader',{name:'2026-10-21',exact:true}).waitFor();
  await page.getByRole('heading',{name:'Chưa kết nối báo cáo Google Analytics',exact:true}).waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await context.close();console.log('OK: exact booking cohort remains usable without GA4, daily table and clear conversion 390/1440.');
}finally{await browser.close();}
