// Isolated test server ONLY. Never import from application code.
import { generateKeyPairSync } from 'node:crypto';
import { fixtureReport } from './ga4-reports.mjs';
if (process.env.RUN_TRAFFIC_E2E !== '1') throw new Error('GA4 fixture requires RUN_TRAFFIC_E2E=1');
const originalFetch = globalThis.fetch;
if (process.env.GA4_FIXTURE_MODE !== 'unconfigured') {
  // Different properties prevent Next's persistent report cache leaking across fixture modes.
  const modes = ['configured', 'empty', 'partial', 'thresholded', 'realtime-failed', 'permission', 'quota', 'regression'];
  process.env.GA4_PROPERTY_ID = String(123456 + Math.max(0, modes.indexOf(process.env.GA4_FIXTURE_MODE)));
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'traffic@test-project.iam.gserviceaccount.com';
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
}
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url ?? input.toString();
  if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'fixture-only-token', expires_in: 3600 });
  if (url.startsWith('https://analyticsdata.googleapis.com/')) {
    const mode = process.env.GA4_FIXTURE_MODE;
    if (mode === 'permission' || mode === 'quota') return Response.json({}, { status: mode === 'permission' ? 403 : 429 });
    if (mode === 'realtime-failed' && url.endsWith(':runRealtimeReport')) return Response.json({}, { status: 500 });
    if (url.endsWith(':runRealtimeReport')) return Response.json({ rows: [{ metricValues: [{ value: '2' }] }] });
    const requests = JSON.parse(init.body).requests;
    if (mode === 'partial' && requests[0].dimensions[0]?.name === 'pagePath') return Response.json({}, { status: 429 });
    return Response.json({ reports: requests.map(request => fixtureReport(request, process.env.GA4_FIXTURE_MODE)) });
  }
  return originalFetch(input, init);
};
