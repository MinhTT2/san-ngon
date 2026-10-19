// Isolated test server ONLY. Never import from application code.
import { generateKeyPairSync } from 'node:crypto';
if (process.env.RUN_TRAFFIC_E2E !== '1') throw new Error('GA4 fixture requires RUN_TRAFFIC_E2E=1');
const originalFetch = globalThis.fetch;
if (process.env.GA4_FIXTURE_MODE !== 'unconfigured') {
  process.env.GA4_PROPERTY_ID = '123456';
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'traffic@test-project.iam.gserviceaccount.com';
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
}
const row = (dimensions, metrics) => ({ dimensionValues: dimensions.map(value => ({ value })), metricValues: metrics.map(value => ({ value: String(value) })) });
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url ?? input.toString();
  if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'fixture-only-token', expires_in: 3600 });
  if (url.startsWith('https://analyticsdata.googleapis.com/')) return Response.json({ reports: [
    { rows: [row([], [2, 6, 3, 120, 60])], metadata: { timeZone: 'Asia/Ho_Chi_Minh' } },
    { rows: [row(['20261018'], [2, 1]), row(['20261019'], [4, 2])] },
    { rows: [row(['Organic Search'], [2]), row(['Direct'], [1])] },
    { rows: [row(['mobile'], [1]), row(['desktop'], [1])] },
    { rows: [row(['/tim-san'], [4]), row(['/'], [2])] },
  ] });
  return originalFetch(input, init);
};
