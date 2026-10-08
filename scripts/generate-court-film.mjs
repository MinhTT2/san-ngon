// Original, seamless sports artwork. No remote footage, accounts or API keys.
import { writeFile, mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
try {
  const page = await browser.newPage();
  const result = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 960; canvas.height = 540;
    const ctx = canvas.getContext('2d');
    const duration = 12;
    function draw(t) {
      ctx.fillStyle = '#0F3D2E'; ctx.fillRect(0, 0, 960, 540);
      // Flat court, subtle alternating lanes; all colours match the site tokens.
      ctx.fillStyle = '#9FC6B2'; ctx.globalAlpha = 0.05;
      for (let i = 0; i < 8; i += 2) ctx.fillRect(90 + i * 97.5, 74, 97.5, 392);
      ctx.globalAlpha = 1;
      const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
      ctx.save(); ctx.translate(480, 270); ctx.rotate(-0.045);
      ctx.strokeStyle = '#9FC6B2'; ctx.lineWidth = 2;
      ctx.strokeRect(-352, -172, 704, 344);
      line(0, -172, 0, 172);
      ctx.beginPath(); ctx.arc(0, 0, 64, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeRect(-352, -93, 100, 186); ctx.strokeRect(252, -93, 100, 186);
      // Badminton / pickleball service lines cross-fade over the football court.
      const phase = (1 - Math.cos(t / duration * Math.PI * 2)) / 2;
      ctx.globalAlpha = phase * 0.7;
      line(-216, -172, -216, 172); line(216, -172, 216, 172);
      line(-352, -120, 352, -120); line(-352, 120, 352, 120);
      line(-352, 0, -80, 0); line(80, 0, 352, 0);
      ctx.globalAlpha = 1;
      // A continuous rally; trail and ball loop without a hard cut.
      const position = time => {
        const a = time / duration * Math.PI * 2;
        return [Math.cos(a * 2) * 268, Math.sin(a * 3) * 116];
      };
      for (let i = 24; i >= 1; i--) {
        const [x, y] = position(t - i * 0.025);
        ctx.globalAlpha = (1 - i / 25) * 0.27;
        ctx.fillStyle = '#EAF5EF'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      const [x, y] = position(t);
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
      for (const direction of [-1, 1]) {
        ctx.fillStyle = '#9FC6B2'; ctx.beginPath();
        ctx.arc(direction * 310, Math.sin(t / duration * Math.PI * 4 + direction) * 92, 13, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#EAF5EF'; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.restore();
      // Framing marks resemble a sports broadcast, without invented live data.
      ctx.strokeStyle = '#9FC6B2'; ctx.globalAlpha = 0.4; ctx.lineWidth = 1;
      for (const [x, y, sx, sy] of [[34, 34, 1, 1], [926, 34, -1, 1], [34, 506, 1, -1], [926, 506, -1, -1]]) {
        line(x, y, x + 25 * sx, y); line(x, y, x, y + 25 * sy);
      }
      ctx.globalAlpha = 1;
    }
    draw(0);
    const poster = canvas.toDataURL('image/webp', 0.9).split(',')[1];
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mime) throw new Error('WebM recording unavailable');
    const stream = canvas.captureStream(24);
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 650000 });
    const chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const stopped = new Promise(resolve => { recorder.onstop = resolve; });
    recorder.start(); const start = performance.now();
    await new Promise(resolve => {
      function frame() {
        const seconds = (performance.now() - start) / 1000;
        draw(seconds % duration);
        if (seconds < duration) requestAnimationFrame(frame); else resolve();
      }
      frame();
    });
    recorder.stop(); await stopped; stream.getTracks().forEach(track => track.stop());
    const blob = new Blob(chunks, { type: mime });
    const video = await new Promise(resolve => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(blob);
    });
    return { poster, video, size: blob.size };
  });
  await mkdir('public/media', { recursive: true }); await mkdir('public/videos', { recursive: true });
  await writeFile('public/media/court-flow.webp', Buffer.from(result.poster, 'base64'));
  await writeFile('public/videos/court-flow.webm', Buffer.from(result.video, 'base64'));
  console.log(`Created original 12s silent court film (${result.size} bytes).`);
} finally { await browser.close(); }
