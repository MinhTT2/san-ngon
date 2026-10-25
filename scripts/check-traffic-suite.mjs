// Clean staged build; synthetic Supabase/Google providers, headless isolated Chromium.
// Stage the task files first, then: node scripts/check-traffic-suite.mjs
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, cp, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as wait } from 'node:timers/promises';
const root = process.cwd(), workspace = await mkdtemp(join(tmpdir(), 'san-ngon-traffic-check.'));
const children = new Set();
const env = Object.fromEntries(['PATH', 'HOME', 'LANG', 'CI', 'CHROMIUM_EXECUTABLE', 'PLAYWRIGHT_BROWSERS_PATH'].filter(name => process.env[name]).map(name => [name, process.env[name]]));
Object.assign(env, { NEXT_TELEMETRY_DISABLED: '1', VERCEL_ENV: 'production', NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-0BN7KY5V59', RUN_TRAFFIC_E2E: '1' });
function start(args, extra = {}) {
  const child = spawn(process.execPath, args, { cwd: workspace, env: { ...env, ...extra }, stdio: ['ignore', 'inherit', 'inherit'] });
  children.add(child); child.once('exit', () => children.delete(child)); return child;
}
function run(args, extra = {}) { return new Promise((resolve, reject) => { const child = start(args, extra); child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${args.join(' ')} exited ${code}`))); }); }
async function port() { const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve)); const value = socket.address().port; await new Promise(resolve => socket.close(resolve)); return value; }
async function ready(url, child) {
  for (let i = 0; i < 160; i++) {
    if (child.exitCode !== null) throw new Error('Fixture server exited');
    try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) return; } catch { /* startup */ }
    await wait(250);
  }
  throw new Error('Fixture server timeout');
}
try {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const path of files) {
    if (path.startsWith('.env') || path.startsWith('output/')) continue;
    await mkdir(dirname(join(workspace, path)), { recursive: true });
    await writeFile(join(workspace, path), execFileSync('git', ['show', ':' + path], { maxBuffer: 64 * 1024 * 1024 }));
  }
  if (process.platform === 'linux') execFileSync('cp', ['-a', join(root, 'node_modules'), join(workspace, 'node_modules')]);
  else await cp(join(root, 'node_modules'), join(workspace, 'node_modules'), { recursive: true });
  const fixturePort = await port();
  const fixtureUrl = `http://127.0.0.1:${fixturePort}`;
  Object.assign(env, { NEXT_PUBLIC_SUPABASE_URL: fixtureUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-only', NEXT_PUBLIC_SITE_URL: 'https://san-ngon.vercel.app' });
  const fixture = start(['scripts/dashboard-fixture-server.mjs'], { DASHBOARD_FIXTURE_PORT: String(fixturePort) });
  await ready(`${fixtureUrl}/rest/v1/venues`, fixture);
  await run(['node_modules/next/dist/bin/next', 'build']);
  for (const mode of ['configured', 'empty', 'partial', 'thresholded', 'realtime-failed', 'unconfigured', 'permission', 'quota', 'regression']) {
    const appPort = await port(), origin = `http://127.0.0.1:${appPort}`;
    const app = start(['--import', './scripts/fixtures/ga4-fetch.mjs', 'node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(appPort)], { GA4_FIXTURE_MODE: mode, VERCEL_ENV: mode === 'regression' ? 'preview' : 'production' });
    await ready(`${origin}/dang-nhap`, app);
    if (mode !== 'regression') await run(['scripts/check-traffic-browser.mjs', origin, mode]);
    if (mode === 'configured') {
      await run(['scripts/check-google-analytics.mjs', origin]);
    }
    if (mode === 'regression') for (const check of ['check-booking-recovery', 'check-booking-policy-browser', 'check-checkout-ux', 'check-live-refresh-browser']) await run([`scripts/${check}.mjs`, origin]);
    app.kill('SIGTERM');
    await Promise.race([new Promise(resolve => app.once('exit', resolve)), wait(3000)]);
  }
  await mkdir(join(root, 'output/traffic'), { recursive: true });
  await cp(join(workspace, 'output/traffic'), join(root, 'output/traffic'), { recursive: true });
  console.log('PASS: clean production build, traffic/error states, GA collection privacy, booking recovery/policy/checkout and reconnect refresh.');
} finally {
  for (const child of children) child.kill('SIGTERM');
  await wait(1000);
  for (const child of children) if (child.exitCode === null) child.kill('SIGKILL');
  if (await realpath(workspace) !== workspace) throw new Error('Temporary path changed');
  await rm(workspace, { recursive: true, force: true });
}
