// Read-only UI checks against a local app and its existing public tournament data.
// Uses isolated headless Chromium; never signs in or writes to the database.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.argv[2] || 'http://localhost:3112';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = process.env.UX_SCREENSHOT_DIR || 'output/league-redesign';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
await context.grantPermissions(['clipboard-read', 'clipboard-write']);
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const results = () => page.getByRole('region', { name: 'Kết quả giải đấu' });
const cards = () => results().locator('li');
const openFilters = async () => {
  const button = page.getByRole('button', { name: 'Bộ lọc', exact: true });
  if (await button.isVisible()) await button.click();
};
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${origin}/giai-dau`);
    await results().waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `List overflow at ${width}`);
    if (width < 1024) {
      assert.equal(await page.getByLabel('Môn thi đấu').isVisible(), false);
      await openFilters();
      assert(await page.getByLabel('Môn thi đấu').isVisible());
      await page.getByRole('button', { name: 'Thu gọn', exact: true }).click();
    }
    if ([390, 1440].includes(width)) await page.screenshot({ path: `${output}/list-${width}.png`, fullPage: true });
  }
  await page.goto(`${origin}/giai-dau?q=No-match-UX-8a191&location=Cau-Giay&sort=fee&layout=list&status=completed`);
  const shortcut = page.getByRole('navigation', { name: 'Chọn nhanh môn chơi' }).getByRole('link', { name: 'Cầu lông', exact: true });
  const target = new URL(await shortcut.getAttribute('href'), origin);
  for (const [key, value] of Object.entries({ q: 'No-match-UX-8a191', location: 'Cau-Giay', sort: 'fee', layout: 'list', status: 'completed' })) assert.equal(target.searchParams.get(key), value);
  await shortcut.click();
  await page.waitForURL(url => url.searchParams.get('sport') === 'badminton');
  await results().getByRole('heading', { name: 'Chưa tìm thấy giải phù hợp' }).waitFor();
  await page.getByRole('link', { name: 'Xóa bộ lọc', exact: true }).first().click();
  await page.waitForURL(url => !url.searchParams.has('q') && !url.searchParams.has('sport'));
  await page.getByRole('link', { name: 'Dạng danh sách', exact: true }).click();
  await page.waitForURL(url => url.searchParams.get('layout') === 'list');
  assert.equal(await page.getByRole('link', { name: 'Dạng danh sách', exact: true }).getAttribute('aria-current'), 'true');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Rows overflow at ${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/giai-dau`);
  const available = await cards().count();
  if (available) {
    const title = await cards().first().locator('h3').innerText();
    const address = await cards().first().locator('p').nth(1).innerText();
    const href = await cards().first().locator('a').getAttribute('href');
    await page.getByLabel('Tên giải đấu', { exact: true }).fill(title);
    await page.getByLabel('Khu vực', { exact: true }).fill(address.trim());
    await page.getByRole('button', { name: 'Lọc giải', exact: true }).click();
    await page.waitForURL(url => url.searchParams.get('q') === title);
    assert(await cards().count(), 'Known title and area should match');
    for (const text of await cards().locator('h3').allInnerTexts()) assert(text.toLocaleLowerCase('vi').includes(title.toLocaleLowerCase('vi')));
    await page.getByRole('link', { name: 'Dạng danh sách', exact: true }).click();
    await page.waitForURL(url => url.searchParams.get('layout') === 'list');
    assert.equal(new URL(page.url()).searchParams.get('q'), title);
    await page.reload();
    assert.equal(await page.getByLabel('Tên giải đấu', { exact: true }).inputValue(), title);
    await page.screenshot({ path: `${output}/filtered-list-1440.png`, fullPage: true });
    await page.goto(`${origin}/giai-dau?sort=fee`);
    await results().waitFor();
    const amounts = await cards().evaluateAll(items => items.map(item => {
      const fee = [...item.querySelectorAll('p')].find(p => p.textContent === 'Lệ phí / suất').nextElementSibling.textContent;
      return fee === 'Miễn phí' ? 0 : Number(fee.replace(/[^0-9]/g, ''));
    }));
    assert.deepEqual(amounts, [...amounts].sort((a, b) => a - b), 'Fees must be ascending');
    await page.setViewportSize({ width: 320, height: 1000 });
    await page.goto(`${origin}/giai-dau?q=${'x'.repeat(100)}`);
    await results().waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Long search should wrap');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${origin}/giai-dau?q=${encodeURIComponent('%')}`);
    await results().waitFor();
    for (const text of await cards().locator('h3').allInnerTexts()) assert(text.includes('%'), 'Search must not treat % as a wildcard');
    for (const status of ['open', 'ongoing', 'completed']) {
      await page.goto(`${origin}/giai-dau?status=${status}`);
      await results().waitFor();
      for (const text of await cards().allInnerTexts()) assert(text.includes(status === 'open' ? 'Đang nhận đăng ký' : status === 'ongoing' ? 'Đang diễn ra' : 'Đã kết thúc'));
    }
    await page.goto(`${origin}${href}?view=participants#chinh-sach`);
    await page.getByRole('heading', { name: title, exact: true, level: 1 }).waitFor();
    assert((await page.title()).includes(title));
    assert.equal(new URL(await page.locator('link[rel=canonical]').getAttribute('href')).pathname, href);
    await page.getByRole('button', { name: 'Sao chép liên kết', exact: true }).click();
    await page.getByText('Đã sao chép liên kết giải đấu.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `${origin}${href}`);
    await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { window.__sharedTournament = data; } }));
    await page.getByRole('button', { name: 'Chia sẻ giải', exact: true }).click();
    await page.getByText('Đã mở chia sẻ giải đấu.', { exact: true }).waitFor();
    assert.equal((await page.evaluate(() => window.__sharedTournament)).url, `${origin}${href}`);
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
    await page.getByRole('button', { name: 'Sao chép liên kết', exact: true }).click();
    const manual = page.getByLabel('Liên kết giải đấu', { exact: true });
    await manual.waitFor();
    assert.equal(await manual.inputValue(), `${origin}${href}`);
    await manual.focus();
    assert.equal(await manual.evaluate(input => input.selectionEnd - input.selectionStart), `${origin}${href}`.length);
    await page.reload();
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => document.fonts.ready);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Detail overflow at ${width}`);
      if ([390, 1440].includes(width)) {
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: `${output}/detail-${width}.png`, fullPage: true });
      }
    }
    console.log('OK: real public title/area search, literal wildcard, status filters, retained layout, link metadata, clipboard/native/manual sharing.');
  } else console.log('No public tournaments: populated detail/sharing checks skipped.');
  await page.goto(`${origin}/giai-dau`);
  await page.getByRole('link', { name: 'Đã đăng ký', exact: true }).click();
  await page.waitForURL(/dang-nhap/);
  assert.equal(new URL(page.url()).searchParams.get('next'), '/giai-dau?view=registered');
  assert.deepEqual(errors, []);
  console.log('OK: list/detail at 320/390/768/1024/1440px, empty/reset, mobile filters, login return path; no browser exceptions.');
} finally { await context.close(); await browser.close(); }