// Build/start a separate copy with VERCEL_ENV=production and
// NEXT_PUBLIC_GA_MEASUREMENT_ID=G-0BN7KY5V59, then run:
// node scripts/check-google-analytics.mjs http://127.0.0.1:<port>
// Browser traffic for the production hostname is routed to this LOCAL server.
// Google collection is always intercepted, never sent to the real property.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ANALYTICS_ORIGIN, analyticsPage, analyticsReferrer, productionAnalyticsId } from '../lib/analytics.ts';

const base = new URL(process.argv[2]);
assert(['localhost', '127.0.0.1'].includes(base.hostname), 'only an isolated local server is allowed');
const id = 'G-0BN7KY5V59';
assert.equal(productionAnalyticsId('production', id), id);
for (const env of ['preview', 'development', undefined]) assert.equal(productionAnalyticsId(env, id), null);
for (const value of ['', undefined, '16158036292', 'G-bad', 'G-X<script>']) assert.equal(productionAnalyticsId('production', value), null);
for (const path of ['/', '/tim-san', '/san/san-demo', '/giai-dau', '/ket-noi', '/lien-he', '/quyen-rieng-tu']) assert(analyticsPage(path));
for (const path of ['/admin', '/chu-san', '/dat-san/SANABC234', '/tai-khoan', '/don-cua-toi', '/dang-nhap', '/giai-dau/tao', '/giai-dau/fixture', '/ket-noi/fixture', '/ho-tro-giao-dich', '/gop-y', '/new-route', '/constructor', '/san/person%40example.com']) assert.equal(analyticsPage(path), null, path);
assert.equal(analyticsReferrer(`${ANALYTICS_ORIGIN}/dat-san/SANABC234?token=secret#private`), `${ANALYTICS_ORIGIN}/`);
assert.equal(analyticsReferrer(`${ANALYTICS_ORIGIN}/tim-san?email=private#token`), `${ANALYTICS_ORIGIN}/tim-san`);
assert.equal(analyticsReferrer('https://www.google.com/search?q=private#token'), 'https://www.google.com/');
assert.equal(analyticsReferrer('javascript:alert(1)'), '');
assert.equal(analyticsReferrer('not a URL'), '');

const stub = `
window.__gaCommands = [];
window.dataLayer = window.dataLayer || [];
const consume = command => {
  const args = Array.from(command);
  window.__gaCommands.push(args);
  if (args[0] === 'event' && !window['ga-disable-${id}']) {
    const fields = args[2];
    const query = new URLSearchParams({tid: '${id}', en: args[1], dl: fields.page_location, dr: fields.page_referrer, dt: fields.page_title});
    fetch('https://www.google-analytics.com/g/collect?' + query, {method: 'POST', keepalive: true});
  }
};
window.dataLayer.forEach(consume);
window.dataLayer.push = function(command) { consume(command); return Array.prototype.push.call(this, command); };
`;

const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const contexts = [];
async function fixture({ hostname = 'san-ngon.vercel.app', blocked = false, delayed = false, realSdk = false } = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  contexts.push(context);
  const hits = [];
  const errors = [];
  let scripts = 0;
  let release;
  const gate = delayed ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname.endsWith('google-analytics.com') || url.pathname.endsWith('/collect')) {
      hits.push({ url: request.url(), body: request.postData() });
      await route.fulfill({ status: 204 });
    } else if (url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtag/js') {
      scripts++;
      await gate;
      if (blocked) await route.abort('blockedbyclient');
      else if (realSdk) await route.continue();
      else await route.fulfill({ contentType: 'application/javascript', body: stub });
    } else if (url.hostname === hostname) {
      assert.equal(request.method(), 'GET', 'browser checks must not mutate application data');
      const response = await route.fetch({ url: `${base.origin}${url.pathname}${url.search}` });
      await route.fulfill({ response });
    } else {
      // No other third-party requests leave this isolated test context.
      await route.abort('blockedbyclient');
    }
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const origin = `https://${hostname}`;
  const views = () => hits.filter(hit => new URL(hit.url).searchParams.get('en') === 'page_view');
  return { page, hits, errors, origin, views, scripts: () => scripts, release };
}

async function waitViews(test, count) {
  await assertEventually(() => assert.equal(test.views().length, count));
}
async function assertEventually(check) {
  const until = Date.now() + 15000;
  while (true) {
    try { check(); return; } catch (error) { if (Date.now() >= until) throw error; }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
async function clickFooter(page, href) {
  await page.locator(`footer a[href="${href}"]`).click();
  await page.waitForURL(url => url.pathname === href);
}
async function quiet(page) { await page.waitForTimeout(400); }
function checkSanitized(hits) {
  for (const hit of hits) {
    const params = new URL(hit.url).searchParams;
    assert.equal(params.get('tid'), id);
    for (const key of ['dl', 'dr']) {
      const value = params.get(key);
      if (value) {
        const url = new URL(value);
        assert.equal(url.search, '', `${key} has no query`);
        assert.equal(url.hash, '', `${key} has no hash`);
        assert(!/SANABC234|private|secret|person%40|person@/.test(value), `${key} has no sensitive identifiers`);
      }
    }
    assert(!/private|secret|person%40|person@/.test(hit.body ?? ''), 'no sensitive data in body');
  }
}

try {
  if (process.env.GA4_TEST_EXPECT_DISABLED === '1') {
    const disabled = await fixture();
    await disabled.page.goto(`${disabled.origin}/tro-giup`);
    await clickFooter(disabled.page, '/lien-he');
    await quiet(disabled.page);
    assert.equal(disabled.scripts(), 0, 'disabled environment never loads Google');
    assert.equal(disabled.hits.length, 0);
    assert.deepEqual(disabled.errors, []);
    console.log('PASS: disabled server configuration loads no Google SDK and sends no events.');
  } else {
  const test = await fixture();
  await test.page.goto(`${test.origin}/tro-giup?email=person%40example.com#secret`, { referer: 'https://www.google.com/search?q=private' });
  await waitViews(test, 1);
  assert.equal(new URL(test.views()[0].url).searchParams.get('dr'), 'https://www.google.com/');
  await clickFooter(test.page, '/lien-he');
  await waitViews(test, 2);
  await test.page.goBack();
  await waitViews(test, 3);
  await test.page.goForward();
  await waitViews(test, 4);
  await test.page.evaluate(() => {
    history.pushState(null, '', '/lien-he?email=person%40example.com#secret');
    history.replaceState(null, '', '/lien-he?token=private#another');
  });
  await quiet(test.page);
  assert.equal(test.views().length, 4, 'query/hash changes do not add views');
  // Footer is a real Next Link: this preserves the loaded SDK across the transition.
  await test.page.locator('footer a[href="/tai-khoan"]').click();
  await test.page.waitForURL(url => url.pathname === '/dang-nhap');
  await test.page.waitForFunction(id => window['ga-disable-' + id] === true, id);
  await quiet(test.page);
  assert.equal(test.views().length, 4, 'private navigation sends no view');
  await clickFooter(test.page, '/quyen-rieng-tu');
  await waitViews(test, 5);
  assert.equal(new URL(test.views()[4].url).searchParams.get('dr'), `${ANALYTICS_ORIGIN}/`, 'private referrer is reduced to origin');
  await test.page.reload();
  await waitViews(test, 6);
  checkSanitized(test.hits);
  assert.equal(test.scripts(), 2, 'SDK loads once per document, not per client navigation');
  assert.deepEqual(test.errors, []);

  const privateFirst = await fixture();
  await privateFirst.page.goto(`${privateFirst.origin}/dang-nhap?next=%2Fdat-san%2FSANABC234#secret`);
  await privateFirst.page.waitForFunction(id => window['ga-disable-' + id] === true, id);
  assert.equal(privateFirst.scripts(), 0, 'direct private entry never loads SDK');
  await clickFooter(privateFirst.page, '/tro-giup');
  await waitViews(privateFirst, 1);
  checkSanitized(privateFirst.hits);

  const delayed = await fixture({ delayed: true });
  await delayed.page.goto(`${delayed.origin}/tro-giup`, { waitUntil: 'domcontentloaded' });
  await delayed.page.locator('footer a[href="/tai-khoan"]').click();
  await delayed.page.waitForURL(url => url.pathname === '/dang-nhap');
  await delayed.page.waitForFunction(id => window['ga-disable-' + id] === true, id);
  delayed.release();
  await quiet(delayed.page);
  assert.equal(delayed.views().length, 0, 'late SDK does not replay a departed page');
  await clickFooter(delayed.page, '/lien-he');
  await waitViews(delayed, 1);

  for (const hostname of ['preview-san-ngon.vercel.app', 'localhost']) {
    const otherHost = await fixture({ hostname });
    await otherHost.page.goto(`${otherHost.origin}/tro-giup`);
    await quiet(otherHost.page);
    assert.equal(otherHost.scripts(), 0, `${hostname} never loads SDK`);
  }

  const blocked = await fixture({ blocked: true });
  await blocked.page.goto(`${blocked.origin}/tro-giup`);
  await clickFooter(blocked.page, '/lien-he');
  assert.equal(blocked.views().length, 0);
  assert.deepEqual(blocked.errors, [], 'blocked Google does not break the website');

  // Optional actual SDK run, still blocking EVERY collection request.
  if (process.env.GA4_TEST_REAL_SDK === '1') {
    const real = await fixture({ realSdk: true });
    await real.page.goto(`${real.origin}/tro-giup?email=person%40example.com#secret`, { referer: 'https://www.google.com/search?q=private' });
    await waitViews(real, 1);
    await clickFooter(real.page, '/lien-he');
    await waitViews(real, 2);
    await real.page.evaluate(() => history.pushState(null, '', '/lien-he?email=person%40example.com#secret'));
    await real.page.waitForTimeout(1200);
    assert.equal(real.views().length, 2, 'actual SDK does not auto-count history/query changes');
    await real.page.locator('footer a[href="/tai-khoan"]').click();
    await real.page.waitForURL(url => url.pathname === '/dang-nhap');
    await real.page.waitForFunction(id => window['ga-disable-' + id] === true, id);
    const privateHits = real.hits.length;
    await real.page.waitForTimeout(1200);
    assert.equal(real.hits.length, privateHits, 'actual SDK stops collection on private pages');
    assert.equal(real.views().length, 2);
    await clickFooter(real.page, '/quyen-rieng-tu');
    await waitViews(real, 3);
    await real.page.waitForTimeout(1200);
    assert.equal(real.views().length, 3, 'actual SDK does not double-count returning to public pages');
    checkSanitized(real.hits);
    console.log('Actual Google SDK: collection intercepted and URLs sanitized; no data sent to GA4.');
  }
  console.log('PASS: GA4 production/config guards, public allowlist, sanitized URLs/referrers, direct/client navigation, Back/Forward, query/hash, reload, private transitions, delayed/blocked SDK, Preview/local hosts. No real collection requests sent.');
  }
} finally {
  await Promise.all(contexts.map(async context => {
    await context.setOffline(true);
    await context.unrouteAll({ behavior: 'ignoreErrors' });
    await context.close();
  }));
  await browser.close();
}
