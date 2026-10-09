// Isolated checkout fixtures. No real QR requests, bank transfers, sessions or database writes.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { setTimeout as wait } from 'node:timers/promises';
import { chromium } from 'playwright';
const origin = process.argv[2];
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = process.env.UX_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, exp, aud: 'authenticated', role: 'authenticated', fixture_role: 'admin' })}.fixture`;
await context.addCookies([{ name: 'sb-127-auth-token', url: origin, sameSite: 'Lax', value: `base64-${b64({ access_token: token, refresh_token: 'fixture-only', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id, email: 'fixture@example.invalid' } })}` }]);
const page = await context.newPage();
const errors = [], reads = [], writes = [], qrRequests = [];
let status = 'pending', readMode = 'success', qrMode = 'failed', joinMode = 'ok', wire;
page.on('pageerror', error => errors.push(error.message));

// A visibly labelled, non-scannable QR stand-in. It contains no bank details.
const modules = Array.from({ length: 25 * 25 }, (_, index) => {
  const x = index % 25, y = Math.floor(index / 25);
  return (x * 7 + y * 3) % 11 < 5 ? `<rect x="${x * 8 + 20}" y="${y * 8 + 20}" width="8" height="8"/>` : '';
}).join('');
const qrFixture = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="white"/><g fill="#0F3D2E">${modules}</g><rect x="32" y="92" width="176" height="56" fill="white"/><text x="120" y="124" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#0F3D2E">QR KIỂM THỬ</text></svg>`;
await page.route('https://qr.sepay.vn/**', async route => {
  qrRequests.push(new URL(route.request().url()));
  if (qrMode === 'failed') return route.abort('failed');
  await wait(100);
  return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: qrFixture });
});
await page.route('**/rest/v1/bookings?*', async route => {
  const url = new URL(route.request().url());
  if (url.searchParams.get('select') !== 'status') return route.continue();
  assert.equal(route.request().method(), 'GET');
  reads.push(url);
  const before = status, mode = readMode;
  if (mode === 'slow') await wait(800);
  if (mode === 'failed') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Fixture status unavailable"}' });
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: before }) }).catch(() => {});
});
await page.route('**/api/**', route => { writes.push(route.request().url()); return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"Fixture blocks writes"}' }); });

// Phoenix messages exercise the actual Supabase subscription code.
await page.routeWebSocket('**/realtime/v1/websocket*', ws => {
  let channel;
  function send(event, payload, ref = null) { ws.send(JSON.stringify([channel?.joinRef ?? null, ref, channel?.topic ?? 'phoenix', event, payload])); }
  wire = {
    update(nextStatus) {
      assert(channel, 'A booking channel has joined');
      send('postgres_changes', { ids: [1], data: { schema: 'public', table: 'bookings', type: 'UPDATE', commit_timestamp: new Date().toISOString(), columns: [{ name: 'id', type: 'text' }, { name: 'status', type: 'text' }], record: { id: channel.bookingId, status: nextStatus }, old_record: { id: channel.bookingId }, errors: null } });
    },
    fail() { send('phx_error', {}); },
  };
  ws.onMessage(raw => {
    const message = JSON.parse(String(raw));
    const [joinRef, ref, topic, event, payload] = Array.isArray(message) ? message : [message.join_ref, message.ref, message.topic, message.event, message.payload];
    if (event === 'phx_join') {
      const filters = payload.config.postgres_changes;
      assert.equal(filters.length, 1);
      assert.equal(filters[0].event, 'UPDATE');
      assert.equal(filters[0].table, 'bookings');
      assert.match(filters[0].filter, /^id=eq\.checkout-/);
      channel = { joinRef, ref, topic, bookingId: filters[0].filter.slice(6) };
      ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', joinMode === 'ok' ? { status: 'ok', response: { postgres_changes: filters.map((filter, index) => ({ ...filter, id: index + 1 })) } } : { status: 'error', response: {} }]));
    } else if (event === 'heartbeat' || event === 'phx_leave') {
      ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
    }
  });
});
const connection = page.locator('[data-checkout-connection]');
const qr = page.locator('[data-payment-qr]');
async function live() { await page.locator('[data-checkout-connection="live"]').waitFor(); }
async function open(code = 'SANDEF567') { await page.goto(`${origin}/dat-san/${code}`); await page.locator('h1').waitFor(); await live(); }
async function screenshot(name) { await page.evaluate(() => { window.scrollTo(0, 0); return document.fonts.ready; }); await page.waitForTimeout(450); if (output) await page.screenshot({ path: `${output}/${name}.png`, fullPage: true }); }
async function noOverflow(label) { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label); }
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await open();
    await page.getByRole('button', { name: 'Tải lại mã QR', exact: true }).waitFor();
    await noOverflow(`Pending checkout overflow at ${width}`);
    assert.equal(await page.locator('footer').count(), 0, 'Checkout keeps its own compact header and no footer');
    if (width < 1024) {
      const summary = page.getByRole('region', { name: 'Tóm tắt lịch chơi', exact: true });
      const summaryBox = await summary.boundingBox(), qrBox = await qr.boundingBox();
      assert(summaryBox.y + summaryBox.height < qrBox.y, 'Mobile booking summary precedes the QR');
      assert.match(await summary.innerText(), /Sân Cầu Giấy.*Cầu lông 01/s);
      assert.match(await summary.innerText(), /10:00–11:00/);
      const details = summary.locator('details');
      await details.locator('summary').focus(); await page.keyboard.press('Enter');
      assert.notEqual(await details.getAttribute('open'), null);
      assert.match(await details.innerText(), /123 Cầu Giấy, Hà Nội/);
      await page.keyboard.press('Enter');
    } else assert(await page.getByRole('region', { name: 'Thông tin sân đã chọn', exact: true }).isVisible());
    if ([390, 1440].includes(width)) await screenshot(`review-checkout-qr-error-${width}`);
  }

  const failedURL = qrRequests.at(-1);
  qrMode = 'success';
  await page.getByRole('button', { name: 'Tải lại mã QR', exact: true }).click();
  await page.locator('[data-payment-qr="ready"] img').waitFor();
  await qr.locator('img').evaluate(image => image.decode());
  assert(await qr.evaluate(element => document.activeElement === element), 'QR retry retains focus on its stable container');
  const retryURL = qrRequests.at(-1);
  assert.notEqual(retryURL.href, failedURL.href, 'Retry bypasses a failed cached image');
  for (const key of ['acc', 'bank', 'amount', 'des']) assert.equal(retryURL.searchParams.get(key), failedURL.searchParams.get(key), `Retry keeps frozen ${key}`);
  assert.equal(retryURL.searchParams.get('amount'), '120000');
  assert.equal(retryURL.searchParams.get('des'), 'SANDEF567');
  await screenshot('review-checkout-1440');
  await page.setViewportSize({ width: 390, height: 1000 });
  await screenshot('review-checkout-390');

  // Waiting for payment must not issue a periodic HTTP status request.
  const steadyReads = reads.length;
  await page.waitForTimeout(16000);
  assert.equal(reads.length, steadyReads, 'No checkout payment polling');
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.locator('[data-checkout-connection="offline"]').waitFor();
  assert(await connection.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).isDisabled());
  assert.equal(await page.getByRole('heading', { name: 'Đặt cọc thành công!', exact: true }).count(), 0, 'Losing connection never marks a booking as paid');
  await screenshot('review-checkout-offline-390');
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await live();

  readMode = 'failed';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.locator('[data-checkout-connection="error"]').waitFor();
  const check = connection.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true });
  assert(await check.isEnabled());
  assert(await page.getByRole('heading', { name: 'Quét mã để giữ sân', exact: true }).isVisible());
  readMode = 'success';
  await check.click(); await live();

  // A late read with old pending status cannot undo a newer confirmed event.
  readMode = 'slow';
  const beforeRead = reads.length;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.locator('[data-checkout-connection="syncing"]').waitFor();
  assert.equal(reads.length, beforeRead + 1);
  status = 'confirmed'; wire.update('confirmed');
  await page.getByRole('heading', { name: 'Đặt cọc thành công!', exact: true }).waitFor();
  await page.waitForTimeout(950);
  assert(await page.getByRole('heading', { name: 'Đặt cọc thành công!', exact: true }).isVisible());
  assert.equal(await qr.count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Hủy giữ chỗ', exact: true }).count(), 0);
  readMode = 'success';

  status = 'pending'; await open();
  joinMode = 'reject'; wire.fail();
  await page.locator('[data-checkout-connection="disconnected"]').waitFor();
  status = 'confirmed';
  await connection.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).click();
  await page.getByRole('heading', { name: 'Đặt cọc thành công!', exact: true }).waitFor();
  assert.equal(await connection.getAttribute('data-checkout-connection'), 'disconnected', 'A successful manual read does not claim realtime has recovered');
  joinMode = 'ok';

  for (const [code, nextStatus, heading] of [
    ['SANABC234', 'confirmed', 'Đặt cọc thành công!'],
    ['SANHJK234', 'completed', 'Cảm ơn bạn đã ra sân!'],
    ['SANCAN234', 'cancelled', 'Đơn đã hủy'],
    ['SANEXP234', 'pending', 'Đã hết thời gian giữ chỗ'],
    ['SANBAD234', 'pending', 'Chưa thể chuyển khoản'],
  ]) {
    status = nextStatus;
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const imagesBefore = qrRequests.length;
      await open(code); await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      await noOverflow(`${nextStatus}/${code} overflow at ${width}`);
      assert.equal(qrRequests.length, imagesBefore, 'Terminal or unconfigured bookings never request a payment QR');
      if (nextStatus === 'completed') {
        assert.equal(await page.getByText('Lịch chơi đã được xác nhận. Chỉ còn chờ đến giờ ra sân.', { exact: true }).count(), 0);
        assert.equal(await page.getByRole('link', { name: 'Xem lịch sử đặt sân', exact: true }).getAttribute('href'), '/don-cua-toi?filter=history');
        assert.equal(await page.getByRole('link', { name: 'Đặt lịch chơi mới', exact: true }).getAttribute('href'), '/tim-san');
        if ([390, 1440].includes(width)) await screenshot(`review-checkout-completed-${width}`);
      }
    }
  }

  status = 'pending';
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await open('SANLNG234');
    await noOverflow(`Long venue name and large deposit overflow at ${width}`);
    const amount = page.locator('[data-payment-amount]');
    assert.equal(await amount.innerText(), '1.500.000đ');
    assert(await amount.evaluate(element => {
      const range = document.createRange(); range.selectNodeContents(element);
      const text = range.getBoundingClientRect(), box = element.getBoundingClientRect();
      return text.left >= box.left - 1 && text.right <= box.right + 1;
    }), `Large deposit is fully readable at ${width}`);
  }

  const noJS = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 1000 }, storageState: await context.storageState() });
  const staticPage = await noJS.newPage();
  await staticPage.route('https://qr.sepay.vn/**', route => route.fulfill({ contentType: 'image/svg+xml', body: qrFixture }));
  await staticPage.goto(`${origin}/dat-san/SANDEF567`);
  assert(await staticPage.getByRole('region', { name: 'Tóm tắt lịch chơi', exact: true }).isVisible());
  assert.equal(await staticPage.getByRole('link', { name: 'tải lại trạng thái đơn', exact: true }).getAttribute('href'), '/dat-san/SANDEF567');
  assert(await staticPage.getByRole('img', { name: 'Mã QR chuyển khoản cọc cho đơn SANDEF567', exact: true }).isVisible());
  assert(await staticPage.getByText('SAN NGON KIEM THU', { exact: true }).isVisible());
  await noJS.close();
  assert.deepEqual(writes, [], 'Viewing/retrying/reconnecting checkout never mutates a booking');
  assert.deepEqual(errors, []);
  console.log('OK: checkout at 320/390/768/1024/1440px, summary before QR, QR retry/frozen receiver, no polling, offline/reconnect/error recovery, realtime/read race, completed/closed/unconfigured states and no-JS. Synthetic QR and read-only fixtures only.');
} finally { await context.close(); await browser.close(); }
