// Offline contract checks: signed JWT, real reader, fixed provider responses. No external requests.
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { fixtureReport } from './fixtures/ga4-reports.mjs';
import { usageDuration } from '../lib/usage-duration.ts';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const names = ['GA4_PROPERTY_ID', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'];
const savedEnv = Object.fromEntries(names.map(name => [name, process.env[name]]));
const savedFetch = globalThis.fetch;
const source = readFileSync(new URL('../lib/ga4-report.ts', import.meta.url), 'utf8')
  .replace("import 'server-only';", '')
  .replace("import { unstable_cache } from 'next/cache';", 'const unstable_cache = (fn) => fn;')
  .replace("from './analytics';", `from '${new URL('../lib/analytics.ts', import.meta.url).href}';`);
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { getGa4Report, getGa4Realtime } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
let calls = 0, status = 200, mode = 'configured', expectedDays = 30;
const dimensions = new Set();
globalThis.fetch = async (url, init) => {
  calls++;
  assert.equal(init.cache, 'no-store');
  if (url === 'https://oauth2.googleapis.com/token') {
    const [header, payload, signature] = init.body.get('assertion').split('.');
    assert(createVerify('RSA-SHA256').update(`${header}.${payload}`).verify(publicKey, signature, 'base64url'));
    const claims = JSON.parse(Buffer.from(payload, 'base64url'));
    assert.equal(claims.scope, 'https://www.googleapis.com/auth/analytics.readonly');
    assert.equal(claims.iss, 'traffic@test-project.iam.gserviceaccount.com');
    assert.equal(claims.exp - claims.iat, 3600);
    return Response.json({ access_token: 'fixture-only-token', expires_in: 3600 });
  }
  assert.equal(init.headers.authorization, 'Bearer fixture-only-token');
  if (status !== 200) return Response.json({ error: 'private provider details' }, { status });
  const body = JSON.parse(init.body);
  if (url.endsWith(':runRealtimeReport')) {
    assert.deepEqual(body.minuteRanges, [{ startMinutesAgo: 29, endMinutesAgo: 0 }]);
    assert.deepEqual(body.metrics, [{ name: 'activeUsers' }]);
    return mode === 'empty' ? Response.json({}) : Response.json({ rows: [{ metricValues: [{ value: '2' }] }] });
  }
  assert.equal(url, 'https://analyticsdata.googleapis.com/v1beta/properties/123456:batchRunReports');
  assert(body.requests.length <= 5);
  for (const request of body.requests) {
    assert(request.metrics.length <= 10);
    const dimension = request.dimensions[0]?.name;
    dimensions.add(dimension ?? 'summary');
    const range = request.dateRanges[0];
    assert.deepEqual(range, range.endDate === 'today'
      ? { startDate: `${expectedDays - 1}daysAgo`, endDate: 'today' }
      : { startDate: `${expectedDays * 2 - 1}daysAgo`, endDate: `${expectedDays}daysAgo` });
    if (dimension === 'date') assert.equal(request.limit, expectedDays);
    if (dimension === 'hour') assert.equal(request.limit, 24);
    if (dimension === 'eventName') assert.deepEqual(request.dimensionFilter.filter.inListFilter.values.sort(), ['discovery_booking_continue', 'discovery_search', 'discovery_venue_open']);
  }
  if (mode === 'partial' && body.requests[0].dimensions[0]?.name === 'pagePath') return Response.json({}, { status: 429 });
  let reports = body.requests.map(request => fixtureReport(request, mode));
  if (mode === 'malformed') reports = [{}];
  if (mode === 'invalid-metric') reports[0] = { rows: [{ metricValues: [{ value: 'NaN' }] }] };
  return Response.json({ reports });
};
try {
  names.forEach(name => delete process.env[name]);
  assert.equal((await getGa4Report(30)).status, 'not_configured');
  assert.equal((await getGa4Realtime()).status, 'not_configured');
  assert.equal(calls, 0);
  process.env.GA4_PROPERTY_ID = '123456';
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'traffic@test-project.iam.gserviceaccount.com';
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).replaceAll('\n', '\\n');
  for (const days of [7, 30, 90]) {
    expectedDays = days;
    const result = await getGa4Report(days);
    assert.equal(result.status, 'ready');
    const report = result.report;
    assert.equal(report.summary.views, 6); assert.equal(report.previous.views, 3);
    assert.equal(report.summary.new_users, 1); assert.equal(report.summary.engagement_rate, 2 / 3);
    assert.equal(report.summary.bounce_rate, 1 / 3); assert.equal(report.summary.views_per_session, 2);
    assert.equal(report.pages.length, 2); assert.equal(report.landing.length, 2);
    assert.equal(report.events.length, 3); assert.equal(report.sources[0].name, 'google / organic');
    assert.equal(report.audiences[1].name, 'returning'); assert.equal(report.hours[1].name, '18');
    assert.deepEqual(report.partial, []); assert.equal(report.time_zone, 'Asia/Ho_Chi_Minh');
    assert(!JSON.stringify(report).includes('never-display')); assert(!JSON.stringify(report).includes('SANABC234'));
  }
  assert.equal(dimensions.size, 15, 'all report dimensions exercised');
  assert.equal((await getGa4Realtime()).users, 2);
  for (const [http, expected] of [[401, 'permission'], [403, 'permission'], [429, 'quota'], [500, 'unavailable']]) {
    status = http;
    assert.deepEqual(await getGa4Report(90), { status: expected });
    assert.deepEqual(await getGa4Realtime(), { status: expected });
  }
  status = 200;
  mode = 'empty';
  const empty = await getGa4Report(90);
  assert.equal(empty.report.summary.users, 0); assert.deepEqual(empty.report.events, []);
  assert.equal((await getGa4Realtime()).users, 0);
  mode = 'partial';
  const partial = await getGa4Report(90);
  assert.equal(partial.status, 'ready'); assert.equal(partial.report.summary.views, 6);
  assert.equal(partial.report.pages, null); assert.equal(partial.report.countries, null);
  assert.equal(partial.report.events.length, 3); assert.equal(partial.report.partial.length, 1);
  mode = 'thresholded'; assert.equal((await getGa4Report(90)).report.limited, true);
  for (mode of ['malformed', 'invalid-metric']) assert.deepEqual(await getGa4Report(90), { status: 'unavailable' });
  globalThis.fetch = async () => { throw new Error('fixture timeout'); };
  assert.deepEqual(await getGa4Report(90), { status: 'unavailable' });
  assert.deepEqual(await getGa4Realtime(), { status: 'unavailable' });
  assert.equal(usageDuration(null), 'Chưa ghi nhận'); assert.equal(usageDuration(0), '0 giây');
  assert.equal(usageDuration(125), '2 phút');
  console.log('PASS: GA4 JWT, 7/30/90-day comparison windows, batching/API limits, all breakdowns, realtime, privacy filtering, empty/partial/threshold/quota/permission/malformed/timeout states. No external requests.');
} finally {
  globalThis.fetch = savedFetch;
  for (const name of names) { if (savedEnv[name] === undefined) delete process.env[name]; else process.env[name] = savedEnv[name]; }
}
