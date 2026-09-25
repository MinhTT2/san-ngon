// Run with an existing Playwright page. API writes are intercepted; no booking is created.
export default async function checkBooking(page, origin = 'http://localhost:3000') {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  await page.bringToFront();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/tim-san`);
  const venue = await page.locator('a[href^="/san/"]').first().getAttribute('href');
  check(venue, 'Need one public venue with available slots for this check');
  await page.goto(origin + venue);
  // SQL supplies a future date; the browser does no timezone arithmetic.
  const day = await page.locator('a[aria-current="date"]').locator('..').locator('a').nth(1).getAttribute('href');
  await page.goto(origin + venue.split('?')[0] + day);
  const venueUrl = page.url();
  const slot = page.locator('button[aria-pressed]:enabled:visible').first();
  await slot.click();
  const label = await slot.getAttribute('aria-label');
  await page.setViewportSize({ width: 390, height: 844 });
  check(await page.locator('button[aria-pressed="true"]:visible').count() === 1, 'Selection lost on mobile');
  check(await page.locator('button[aria-pressed="true"]:visible').getAttribute('aria-label') === label, 'Selected court/time changed');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile page overflows');
  await page.getByRole('button', { name: 'Tiếp tục đặt sân' }).click();
  await page.getByLabel('Tên người đặt').fill('Kiểm tra hệ thống');
  await page.getByLabel('Số điện thoại').fill('0900000000');
  const submit = page.locator('button[type="submit"]');
  const offline = route => route.abort('internetdisconnected');
  await page.route('**/api/bookings', offline);
  try {
    await submit.click();
    await page.getByRole('alert').filter({ hasText: 'Không kết nối được' }).waitFor();
    check(await submit.isEnabled(), 'Submit remains disabled after a network error');
  } finally { await page.unroute('**/api/bookings', offline); }
  const signedOut = route => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
  await page.route('**/api/bookings', signedOut);
  try {
    await submit.click();
    await page.waitForURL('**/dang-nhap?**');
    const next = await page.evaluate(() => new URL(location.href).searchParams.get('next'));
    check(origin + next === venueUrl, 'Login return path lost the chosen date');
    await page.goto(origin + next);
    await page.getByLabel('Tên người đặt').waitFor();
    check(await page.getByLabel('Tên người đặt').inputValue() === 'Kiểm tra hệ thống', 'Booking contact was not restored');
    await page.getByRole('button', { name: 'Chọn lại', exact: true }).click();
  } finally { await page.unroute('**/api/bookings', signedOut); }
  return 'OK: desktop/mobile selection, network retry, and login draft restoration.';
}
