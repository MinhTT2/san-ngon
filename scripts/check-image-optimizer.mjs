// Verify the real Next image endpoint with existing local assets after dependency updates.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('next/package.json'));
const sharp = nextRequire('sharp');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.argv[2];
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext();
try {
  for (const asset of ['football-editorial', 'badminton-editorial', 'pickleball-editorial']) {
    for (const format of ['image/webp', 'image/avif']) {
      const url = `${origin}/_next/image?url=${encodeURIComponent(`/media/${asset}.webp`)}&w=640&q=75`;
      const response = await context.request.get(url, { headers: { Accept: format } });
      assert.equal(response.status(), 200, `${asset} ${format}: optimizer succeeds`);
      assert.match(response.headers()['content-type'], /^image\//);
      const metadata = await sharp(await response.body()).metadata();
      assert.equal(metadata.width, 640, 'requested resize applied');
      assert(metadata.height > 0);
      const page = await context.newPage();
      try {
        await page.goto(origin);
        const dimensions = await page.evaluate(async source => {
          const img = new Image(); img.src = source; await img.decode();
          return { width: img.naturalWidth, height: img.naturalHeight };
        }, url);
        assert.equal(dimensions.width, 640, 'browser decodes optimized image');
        assert(dimensions.height > 0);
      } finally { await page.close(); }
    }
    console.log(`OK: ${asset} resized, validated by sharp and decoded by Chromium.`);
  }
  const external = await context.request.get(`${origin}/_next/image?url=${encodeURIComponent('https://example.invalid/image.webp')}&w=640&q=75`);
  assert.equal(external.status(), 400, 'optimizer still rejects unconfigured remote hosts');
  const svg = await context.request.get(`${origin}/_next/image?url=${encodeURIComponent('/icon.svg')}&w=640&q=75`);
  assert.equal(svg.status(), 400, 'SVG optimization stays disabled');
  if (process.env.UX_SCREENSHOT_DIR) {
    await mkdir(process.env.UX_SCREENSHOT_DIR, { recursive: true });
    const page = await context.newPage();
    await page.goto(origin);
    await page.setContent(`<main style="display:flex;gap:12px">${['football-editorial', 'badminton-editorial', 'pickleball-editorial'].map(asset => `<img width="320" src="${origin}/_next/image?url=${encodeURIComponent(`/media/${asset}.webp`)}&w=640&q=75" alt="${asset}">`).join('')}</main>`);
    await page.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
    await page.screenshot({ path: `${process.env.UX_SCREENSHOT_DIR}/optimized-sport-images.png` });
  }
  console.log('OK: image optimizer retains remote host and SVG restrictions.');
} finally { await context.close(); await browser.close(); }
