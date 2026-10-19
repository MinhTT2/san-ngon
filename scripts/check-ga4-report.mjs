// Offline tests with ephemeral RSA credentials and mocked Google responses. No provider requests.
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { usageDuration } from '../lib/usage-duration.ts';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const savedFetch = globalThis.fetch;
const names = ['GA4_PROPERTY_ID', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'];
const savedEnv = Object.fromEntries(names.map(name => [name, process.env[name]]));
const source = readFileSync(new URL('../lib/ga4-report.ts', import.meta.url), 'utf8')
  .replace("import 'server-only';", '')
  .replace("import { unstable_cache } from 'next/cache';", 'const unstable_cache = (fn) => fn;')
  .replace("from './analytics';", `from '${new URL('../lib/analytics.ts', import.meta.url).href}';`);
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { getGa4Report } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
let calls = 0;
let reportStatus = 200;
const row = (dimensions, metrics) => ({ dimensionValues: dimensions.map(value => ({ value })), metricValues: metrics.map(value => ({ value: String(value) })) });
let reports = [
  { rows: [row([], [2, 6, 3, 120, 60])], metadata: { timeZone: 'Asia/Ho_Chi_Minh' } },
  { rows: [row(['20261019'], [6, 2])] },
  { rows: [row(['Organic Search'], [3])] },
  { rows: [row(['mobile'], [2])] },
  { rows: [row(['/tim-san'], [4]), row(['/admin/users?secret=never-display'], [2])] },
];
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
  assert.equal(url, 'https://analyticsdata.googleapis.com/v1beta/properties/123456:batchRunReports');
  assert.equal(init.headers.authorization, 'Bearer fixture-only-token');
  const body = JSON.parse(init.body);
  assert.equal(body.requests.length, 5);
  assert.deepEqual(body.requests[0].dateRanges, [{ startDate: '29daysAgo', endDate: 'today' }]);
  assert.equal(body.requests[4].dimensions[0].name, 'pagePath');
  return reportStatus === 200 ? Response.json({ reports }) : Response.json({ error: 'provider details must stay private' }, { status: reportStatus });
};
try {
  names.forEach(name => delete process.env[name]);
  assert.equal((await getGa4Report(30)).status, 'not_configured');
  assert.equal(calls, 0, 'no configuration makes no network request');
  process.env.GA4_PROPERTY_ID = '123456';
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'traffic@test-project.iam.gserviceaccount.com';
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = pem.replaceAll('\n', '\\n');
  const result = await getGa4Report(30);
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.report.summary, { users: 2, views: 6, sessions: 3, engagement_seconds: 120, average_seconds: 60 });
  assert.equal(result.report.pages.length, 1, 'private/unknown GA paths never enter the report');
  assert.equal(result.report.time_zone, 'Asia/Ho_Chi_Minh');
  assert.equal(calls, 2, 'one token and one batch request');
  for (const [status, expected] of [[401, 'permission'], [403, 'permission'], [429, 'quota'], [500, 'unavailable']]) {
    reportStatus = status;
    assert.deepEqual(await getGa4Report(30), { status: expected });
  }
  reportStatus = 200;
  reports = [{}, {}, {}, {}, {}];
  const empty = await getGa4Report(30);
  assert.equal(empty.status, 'ready');
  assert.equal(empty.report.summary.users, 0, 'successful empty report is a real zero');
  reports = [{}];
  assert.deepEqual(await getGa4Report(30), { status: 'unavailable' });
  globalThis.fetch = async () => { throw new Error('fixture timeout'); };
  assert.deepEqual(await getGa4Report(30), { status: 'unavailable' });
  assert.equal(usageDuration(null), 'Chưa ghi nhận');
  assert.equal(usageDuration(0), '0 giây');
  assert.equal(usageDuration(30), '30 giây');
  assert.equal(usageDuration(125), '2 phút');
  assert.equal(usageDuration(9300), '2 giờ 35 phút');
  console.log('PASS: GA4 readonly JWT/signature, batching/metrics, private path filtering, no-config/empty/permission/quota/provider/timeout states, duration formatting. No external requests.');
} finally {
  globalThis.fetch = savedFetch;
  for (const name of names) {
    if (savedEnv[name] === undefined) delete process.env[name]; else process.env[name] = savedEnv[name];
  }
}
