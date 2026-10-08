// Create an original, silent Sân Ngon explainer with native canvas/MediaRecorder.
// Requires a local app for its existing Bricolage Grotesque / Be Vietnam Pro fonts.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import { mkdir, writeFile } from 'node:fs/promises';

// MediaRecorder omits Duration. Add it to the unindexed WebM Info element so
// browsers show a finite timeline and can seek; the video frames stay unchanged.
export function withWebmDuration(bytes, milliseconds) {
  const element = offset => {
    const width = start => {
      let length = 1;
      while (length <= 8 && !(bytes[start] & (1 << (8 - length)))) length++;
      if (length > 8) throw new Error('Invalid EBML header');
      return length;
    };
    const idLength = width(offset);
    const id = Number.parseInt(bytes.subarray(offset, offset + idLength).toString('hex'), 16);
    const sizeOffset = offset + idLength;
    const sizeLength = width(sizeOffset);
    let size = BigInt(bytes[sizeOffset] & ((1 << (8 - sizeLength)) - 1));
    for (let i = 1; i < sizeLength; i++) size = (size << 8n) | BigInt(bytes[sizeOffset + i]);
    const unknown = size === (1n << BigInt(7 * sizeLength)) - 1n;
    const start = sizeOffset + sizeLength;
    return { id, offset, sizeOffset, sizeLength, start, unknown, end: unknown ? bytes.length : start + Number(size) };
  };
  let segment;
  for (let offset = 0; offset < bytes.length;) {
    const current = element(offset);
    if (current.id === 0x18538067) { segment = current; break; }
    offset = current.end;
  }
  if (!segment?.unknown) throw new Error('Expected an unindexed MediaRecorder WebM');
  for (let offset = segment.start; offset < segment.end;) {
    const info = element(offset);
    if (info.id === 0x114d9b74) throw new Error('Indexed WebM needs a full remux');
    if (info.id === 0x1549a966) {
      let scale = 1000000;
      for (let child = info.start; child < info.end;) {
        const field = element(child);
        if (field.id === 0x2ad7b1) scale = Number.parseInt(bytes.subarray(field.start, field.end).toString('hex'), 16);
        if (field.id === 0x4489) throw new Error('Recording already has a duration');
        child = field.end;
      }
      const duration = Buffer.alloc(11);
      duration.set([0x44, 0x89, 0x88]);
      duration.writeDoubleBE(milliseconds * 1000000 / scale, 3);
      const size = Buffer.alloc(info.sizeLength);
      let encoded = BigInt(info.end - info.start + duration.length);
      if (encoded >= (1n << BigInt(info.sizeLength * 7)) - 1n) throw new Error('Info header needs resizing');
      encoded |= 1n << BigInt(info.sizeLength * 7);
      for (let i = size.length - 1; i >= 0; i--) { size[i] = Number(encoded & 255n); encoded >>= 8n; }
      return Buffer.concat([bytes.subarray(0, info.sizeOffset), size, bytes.subarray(info.start, info.end), duration, bytes.subarray(info.end)]);
    }
    offset = info.end;
  }
  throw new Error('WebM Info missing');
}

const origin = process.argv[2] || 'http://localhost:3112';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(origin + '/giai-dau');
  await page.evaluate(async () => {
    await Promise.all([document.fonts.load('800 64px "Bricolage Grotesque"'), document.fonts.load('600 28px "Be Vietnam Pro"')]);
  });
  const media = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
    document.body.replaceChildren(canvas); document.body.style.margin = '0';
    const ctx = canvas.getContext('2d');
    const pitch = '#0F3D2E', line = '#9FC6B2', soft = '#EAF5EF', white = '#FFFFFF';
    const round = (x,y,w,h,r,fill,stroke) => { ctx.beginPath(); ctx.roundRect(x,y,w,h,r); if(fill){ctx.fillStyle=fill;ctx.fill();} if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();} };
    const text = (value,x,y,size=28,color=white,display=false) => { ctx.fillStyle=color;ctx.font=`${display?'800':'600'} ${size}px "${display?'Bricolage Grotesque':'Be Vietnam Pro'}", sans-serif`;ctx.fillText(value,x,y); };
    const path = (points,color=line,width=3) => { ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke(); };
    const trophy = (x,y,s=1) => {
      ctx.save();ctx.translate(x,y);ctx.scale(s,s);
      ctx.strokeStyle=line;ctx.lineWidth=5;ctx.lineJoin='round';
      ctx.beginPath();ctx.moveTo(-48,-68);ctx.lineTo(48,-68);ctx.lineTo(40,-8);ctx.quadraticCurveTo(0,56,-40,-8);ctx.closePath();ctx.stroke();
      path([[-48,-52],[-77,-52],[-72,-14],[-44,0]],line,5);path([[48,-52],[77,-52],[72,-14],[44,0]],line,5);
      path([[0,26],[0,80],[-35,80],[35,80]],line,5);ctx.restore();
    };
    const draw = (seconds) => {
      ctx.fillStyle=pitch;ctx.fillRect(0,0,1280,720);
      ctx.globalAlpha=0.14;round(718,72,480,510,10,null,line);path([[958,72],[958,582]],line,2);
      ctx.beginPath();ctx.ellipse(958,327,90,90,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
      round(64,52,42,42,10,white);path([[72,83],[80,62],[90,62],[99,83],[72,83]],pitch,2);path([[77,74],[94,74]],pitch,2);
      text('Sân Ngon',120,84,28);text('GIẢI ĐẤU',64,175,21,line);
      const scene=Math.min(3,Math.floor(seconds/4.5));const progress=(seconds%4.5)/4.5;
      const copy=[['Chung một đam mê.','Cùng nhau ra sân.','Một giải đấu. Thêm một thử thách.'],['01 / Chọn giải','phù hợp với bạn.','Xem lịch, môn thi đấu, thể lệ và lệ phí.'],['02 / Gửi đăng ký.','Chờ duyệt tham gia.','Ban tổ chức xét duyệt từng người hoặc đội.'],['03 / Đóng cọc','sau khi được duyệt.','Xác nhận suất. Hẹn ngày ra sân.']][scene];
      text(copy[0],64,282,62,white,true);text(copy[1],64,362,62,line,true);text(copy[2],64,425,24,soft);
      round(64,477,330,64,12,white);text(scene===3?'Sẵn sàng cho ngày thi đấu':'Khám phá giải đấu',88,519,23,pitch);
      ctx.save();ctx.translate(958,323+Math.sin(seconds*1.2)*7);
      if(scene===0 || scene===3) {
        round(-140,-140,280,280,40,pitch,line);trophy(0,0,1.35);
        for(let i=0;i<6;i++){const a=i*Math.PI/3+seconds*0.12;ctx.beginPath();ctx.arc(Math.cos(a)*181,Math.sin(a)*181,5,0,Math.PI*2);ctx.fillStyle=line;ctx.fill();}
      } else if(scene===1) {
        round(-150,-150,300,300,24,white);round(-126,-125,252,56,12,soft);
        text('LỊCH THI ĐẤU',-110,-89,22,pitch);for(let row=0;row<3;row++)for(let col=0;col<4;col++){const active=row===1&&col===2;round(-118+col*60,-44+row*62,48,48,10,active?pitch:soft);if(active)path([[12,43],[23,54],[42,30]],white,4);}
      } else {
        round(-160,-150,320,310,24,white);text('ĐĂNG KÝ THAM GIA',-132,-103,21,pitch);
        for(let i=0;i<3;i++){round(-130,-66+i*51,260,36,7,soft);round(-114,-51+i*51,90+i*37,6,3,line);}
        round(-130,110,260,34,7,pitch);text('GỬI ĐĂNG KÝ',-74,134,15,white);
        const circle=30+progress*2;ctx.beginPath();ctx.arc(156,128,circle,0,Math.PI*2);ctx.fillStyle=pitch;ctx.fill();path([[140,128],[152,140],[172,115]],white,4);
      }
      ctx.restore();
      text('Chọn giải → Gửi đăng ký → Đóng cọc sau duyệt',64,624,22,soft);
      for(let i=0;i<4;i++){round(64+i*288,664,268,4,2,'#55665C');const fill=Math.max(0,Math.min(1,(seconds-i*4.5)/4.5));if(fill>0)round(64+i*288,664,268*fill,4,2,line);}
    };
    draw(0.1);const poster=canvas.toDataURL('image/webp',0.9).split(',')[1];
    const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(MediaRecorder.isTypeSupported);
    if(!mime)throw new Error('No supported WebM encoder');
    const stream=canvas.captureStream(24);const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1200000});const chunks=[];
    recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
    const completed=new Promise(resolve=>recorder.onstop=()=>resolve());
    recorder.start(1000);const start=performance.now();
    await new Promise(resolve=>{function frame(){const seconds=(performance.now()-start)/1000;draw(Math.min(seconds,17.95));if(seconds<18)requestAnimationFrame(frame);else resolve();}frame();});
    recorder.stop();await completed;stream.getTracks().forEach(track=>track.stop());
    const blob=new Blob(chunks,{type:mime});
    const base64=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(blob);});
    return {poster,base64,mime,size:blob.size};
  });
  await mkdir('public/videos',{recursive:true});
  await writeFile('public/videos/tournament-guide.webm',withWebmDuration(Buffer.from(media.base64,'base64'), 18000));
  await writeFile('public/media/tournament-guide.webp',Buffer.from(media.poster,'base64'));
  console.log(`Created original 18s silent explainer (${media.size} bytes, ${media.mime}).`);
} finally {await browser.close();}