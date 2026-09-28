// Pass a fresh headless Chromium Playwright page; this check only reads a public venue.
export default async function checkVenueGallery(page, venueUrl = 'http://127.0.0.1:3000/san/san-cau-long-fpt') {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(venueUrl);
  const opener = page.getByRole('button', { name: /^Mở ảnh 1 / });
  await opener.click();
  const viewer = page.getByRole('dialog');
  const zoomIn = viewer.getByRole('button', { name: 'Phóng to', exact: true });
  const zoomOut = viewer.getByRole('button', { name: 'Thu nhỏ', exact: true });
  const stage = viewer.locator('[data-gallery-stage]');
  const photo = stage.locator('img');
  await page.waitForFunction(() => document.querySelector('dialog button[aria-label="Phóng to"]')?.getAttribute('aria-disabled') === 'false');
  check(await zoomOut.isDisabled(), 'Zoom starts at the minimum');
  await zoomIn.click();
  await zoomIn.click();
  check(await viewer.getByLabel('Mức phóng to').textContent() === '200%', 'Zoom buttons must update scale');
  const bounds = await stage.boundingBox();
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  const before = await photo.getAttribute('style');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 120, y + 90, { steps: 6 });
  await page.mouse.up();
  check(await photo.getAttribute('style') !== before, 'Dragging must move the zoomed image');
  await page.mouse.wheel(0, -100);
  await page.waitForFunction(() => document.querySelector('dialog output')?.textContent === '225%');
  await viewer.getByRole('button', { name: 'Vừa khung ảnh' }).click();
  check(await photo.evaluate(element => new DOMMatrix(getComputedStyle(element).transform).isIdentity), 'Reset must restore scale and position');
  check(await photo.evaluate(element => {
    const { width, height } = element.getBoundingClientRect();
    return Math.abs(width / height - element.naturalWidth / element.naturalHeight) < 0.01
      && (Math.abs(width - element.parentElement.clientWidth) < 2 || Math.abs(height - element.parentElement.clientHeight) < 2);
  }), 'Fitted photo must preserve its aspect ratio and fill one dimension of the stage');
  // A short or vertical drag must not accidentally change photos.
  const swipe = async (dx, dy = 0) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 6 });
    await page.mouse.up();
  };
  await swipe(-30);
  await swipe(-80, 140);
  check(await viewer.getByRole('button', { name: 'Xem ảnh 1', exact: true }).getAttribute('aria-pressed') === 'true', 'Short and vertical gestures must not navigate');
  await swipe(-150);
  check(await viewer.getByRole('button', { name: 'Xem ảnh 2', exact: true }).getAttribute('aria-pressed') === 'true', 'Dragging left must select the next image');
  await swipe(150);
  check(await viewer.getByRole('button', { name: 'Xem ảnh 1', exact: true }).getAttribute('aria-pressed') === 'true', 'Dragging right must select the previous image');
  await page.waitForFunction(() => document.querySelector('dialog button[aria-label="Phóng to"]')?.getAttribute('aria-disabled') === 'false');
  await page.mouse.move(x + 80, y + 80);
  await page.mouse.wheel(0, -100);
  await page.waitForFunction(() => document.querySelector('dialog output')?.textContent === '125%');
  const anchored = await photo.evaluate(element => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return matrix.e < 0 || matrix.f < 0;
  });
  check(anchored, 'Zoom must stay anchored under the pointer');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 150, y);
  await stage.dispatchEvent('pointercancel');
  await page.mouse.up();
  check(await viewer.getByRole('button', { name: 'Xem ảnh 1', exact: true }).getAttribute('aria-pressed') === 'true', 'Panning or cancelling must not navigate');
  check(!(await stage.getAttribute('class')).includes('cursor-grabbing'), 'Cancelled gesture must release dragging state');
  await viewer.getByRole('button', { name: 'Vừa khung ảnh' }).click();
  await page.keyboard.press('ArrowRight');
  await viewer.getByRole('button', { name: 'Xem ảnh 2', exact: true }).waitFor();
  check(await viewer.getByRole('button', { name: 'Xem ảnh 2', exact: true }).getAttribute('aria-pressed') === 'true', 'Keyboard must navigate photos');
  await page.keyboard.press('Escape');
  await viewer.waitFor({ state: 'detached' });
  check(await opener.evaluate(element => element === document.activeElement), 'Closing must return keyboard focus');
  check(await page.evaluate(() => document.body.style.overflow !== 'hidden'), 'Closing must unlock page scroll');
  await page.setViewportSize({ width: 390, height: 844 });
  await opener.click();
  await page.waitForFunction(() => document.querySelector('dialog button[aria-label="Phóng to"]')?.getAttribute('aria-disabled') === 'false');
  check(await viewer.evaluate(element => element.scrollWidth <= innerWidth), 'Viewer must fit mobile width');
  const close = viewer.getByRole('button', { name: 'Đóng ảnh' });
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  check(await viewer.evaluate(element => element.contains(document.activeElement)), 'Keyboard focus must remain inside viewer');
  const cdp = await page.context().newCDPSession(page);
  const mobileBounds = await stage.boundingBox();
  const touchDrag = async (dx, dy = 0) => {
    const x = mobileBounds.x + mobileBounds.width / 2;
    const y = mobileBounds.y + mobileBounds.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 6; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step / 6, y: y + dy * step / 6 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await touchDrag(-120);
  check(await viewer.getByRole('button', { name: 'Xem ảnh 2', exact: true }).getAttribute('aria-pressed') === 'true', 'Touch swipe must navigate');
  await page.waitForFunction(() => document.querySelector('dialog button[aria-label="Phóng to"]')?.getAttribute('aria-disabled') === 'false');
  await zoomIn.click();
  await zoomIn.click();
  const beforeTouch = await photo.getAttribute('style');
  await touchDrag(80, 60);
  check(await photo.getAttribute('style') !== beforeTouch, 'Touch drag must pan a zoomed photo');
  check(await viewer.getByRole('button', { name: 'Xem ảnh 2', exact: true }).getAttribute('aria-pressed') === 'true', 'Touch pan must keep the selected photo');
  await cdp.detach();
  await page.keyboard.press('ArrowLeft');
  check(await viewer.getByLabel('Mức phóng to').textContent() === '100%', 'Changing photos must reset zoom');
  await close.click();
  await viewer.waitFor({ state: 'detached' });
  return 'OK: anchored zoom, pan, swipe thresholds/directions, cancellation, reset, keyboard navigation, focus/scroll restoration, and mobile layout.';
}
