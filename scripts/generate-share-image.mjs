// Rebuild the static share preview using the site's fonts and logo, without network access.
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

let fonts = await readFile('app/fonts/fonts.css', 'utf8');
for (const filename of new Set([...fonts.matchAll(/url\(\.\/([^)]+)\)/g)].map(match => match[1]))) {
  const data = (await readFile('app/fonts/' + filename)).toString('base64');
  fonts = fonts.replaceAll('./' + filename, 'data:font/woff2;base64,' + data);
}
const icon = (await readFile('app/icon.svg', 'utf8')).replace('width="30" height="30"', 'width="58" height="58"');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
try {
  const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.setContent(`<html lang="vi"><style>${fonts}
    *{box-sizing:border-box}body{margin:0;width:1200px;height:630px;background:#0F3D2E;color:white;font-family:"Be Vietnam Pro";padding:56px 64px;position:relative;overflow:hidden}
    header{display:flex;align-items:center;gap:16px;font:700 36px "Bricolage Grotesque"}header svg{border:1px solid #9FC6B2;border-radius:16px}
    .copy{position:relative;z-index:1;width:810px}h1{font:800 76px/1.1 "Bricolage Grotesque";letter-spacing:-2px;margin:64px 0 24px}
    p{font-size:22px;line-height:1.7;color:#EAF5EF;width:660px;margin:0}
    footer{position:absolute;left:64px;right:64px;bottom:44px;display:flex;justify-content:space-between;border-top:1px solid #9FC6B2;padding-top:22px;font-size:18px;color:#EAF5EF}
    .court{position:absolute;right:-100px;top:96px;width:360px;height:380px;border:2px solid #9FC6B2;transform:rotate(-20deg);opacity:.45}
    .court:before{content:"";position:absolute;inset:24px;border:2px solid #9FC6B2}.court:after{content:"";position:absolute;top:50%;left:0;right:0;border-top:2px solid #9FC6B2}
    .ring{position:absolute;width:104px;height:104px;border:2px solid #9FC6B2;border-radius:50%;left:calc(50% - 52px);top:calc(50% - 52px)}
  </style><header>${icon}<span>Sân Ngon</span></header><div class="copy"><h1>Tìm sân trống.<br>Chọn giờ, ra sân.</h1><p>Xem lịch và giá trước khi đặt.<br>Thanh toán bằng chuyển khoản theo mã đơn.</p></div><div class="court"><div class="ring"></div></div><footer><span>Hà Nội · Bóng đá · Cầu lông · Pickleball</span><span>Đặt sân trên website</span></footer></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'public/media/share-default.png' });
  await context.close();
} finally { await browser.close(); }
