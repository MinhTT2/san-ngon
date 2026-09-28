// Run with an isolated headless Playwright page. All booking writes are intercepted.
export default async function checkVenueTimePicker(page, origin = 'http://localhost:3000') {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/tim-san`);
  const venue = await page.locator('a[href^="/san/"]').first().getAttribute('href');
  check(venue, 'Need a public venue');
  let slots = Array.from({ length: 100 }, (_, court) => Array.from({ length: 12 }, (_, index) => ({
    court_id: `court-${court}`, court_name: `Sân ${court + 1}`, sport: 'badminton', slot_minutes: 60,
    starts_at: `2026-09-29T${String(index + 3).padStart(2, '0')}:00:00+00:00`,
    ends_at: `2026-09-29T${String(index + 4).padStart(2, '0')}:00:00+00:00`,
    price: 100000 + court * 1000, is_available: !(court === 0 && index === 1),
  }))).flat();
  slots.push({ ...slots[0], court_id: 'football', court_name: 'Sân bóng', sport: 'football7', price: 400000 });
  let fail = false;
  const availability = route => route.fulfill({ status: fail ? 500 : 200, contentType: 'application/json', body: JSON.stringify(fail ? { message: 'test failure' } : slots) });
  await page.route('**/rest/v1/rpc/get_venue_availability', availability);
  await page.goto(origin + venue);
  const region = page.getByRole('region', { name: 'Giờ chơi của cụm sân' });
  const summary = page.getByRole('complementary', { name: 'Tóm tắt đặt sân' });
  await region.waitFor();
  check(await region.locator('button[aria-pressed]').count() === 12, '100 courts must render only 12 start times');
  await page.getByLabel('Chơi bao lâu?').selectOption('120');
  await region.locator('button:enabled').first().click();
  check(await page.getByLabel('Sân của bạn', { exact: true }).inputValue() === 'court-1', 'Suggested a court with a gap');
  check(await page.getByLabel('Sân của bạn', { exact: true }).locator('option').count() === 99, 'Candidate list includes a court without continuous availability');
  check((await summary.innerText()).includes('202.000đ'), 'Total must cover both hours');
  await page.getByLabel('Sân của bạn', { exact: true }).selectOption('court-5');
  await page.setViewportSize({ width: 390, height: 844 });
  check(await page.getByLabel('Sân của bạn', { exact: true }).inputValue() === 'court-5', 'Selection lost on mobile');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow');
  await page.getByRole('button', { name: 'Tiếp tục đặt sân' }).click();
  check((await page.locator('form').innerText()).includes('Sân 6'), 'Booking form has wrong court');
  await page.getByRole('button', { name: 'Chọn lại', exact: true }).click();
  // The form remounts the picker: duration must remain consistent with its selected slots.
  check(await page.getByLabel('Chơi bao lâu?').inputValue() === '120', 'Duration lost when returning from confirmation');
  await page.getByLabel('Môn thể thao').selectOption('football7');
  check(await region.locator('button[aria-pressed="true"]').count() === 0, 'Sport change retained another sport selection');
  check(await region.locator('button[aria-pressed]').count() === 1, 'Sport filter mixed courts');
  await page.getByLabel('Chơi bao lâu?').selectOption('120');
  await page.getByRole('status').filter({ hasText: 'Không còn sân trống đủ' }).waitFor();
  await page.getByLabel('Môn thể thao').selectOption('badminton');
  await region.locator('button:enabled').first().click();
  slots = slots.map(slot => slot.court_id === 'court-0' ? { ...slot, is_available: false } : slot);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByRole('status').filter({ hasText: 'Sân vừa chọn' }).waitFor();
  check(await page.getByRole('button', { name: 'Tiếp tục đặt sân' }).count() === 0, 'Can confirm a lost selection');
  fail = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByRole('alert').filter({ hasText: 'Không tải được lịch sân' }).waitFor();
  fail = false;
  await page.getByRole('button', { name: 'Tải lại', exact: true }).click();
  await region.waitFor();
  await page.unroute('**/rest/v1/rpc/get_venue_availability', availability);
  return 'OK: 100 courts, duration, continuous availability, court choice, mobile, confirmation, sport, refresh and retry.';
}
