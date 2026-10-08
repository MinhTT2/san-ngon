// A clean, temporary build with synthetic data and no production credentials.
import { spawn, execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staged = process.argv.includes('--staged');
const workspace = await mkdtemp(join(tmpdir(), 'san-ngon-ui-check-'));
const screenshots = resolve(process.env.UX_SCREENSHOT_DIR || join(root, 'output/automated-ui'));
const envNames = ['PATH', 'HOME', 'LANG', 'LC_ALL', 'CI', 'XDG_CACHE_HOME', 'PLAYWRIGHT_BROWSERS_PATH', 'CHROMIUM_EXECUTABLE', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'PATHEXT'];
const env = Object.fromEntries(envNames.filter(name => process.env[name]).map(name => [name, process.env[name]]));
const children = new Set();
function start(args, extra = {}) {
  const child = spawn(process.execPath, args, { cwd: workspace, env: { ...env, ...extra }, stdio: ['ignore', 'inherit', 'inherit'] });
  children.add(child);
  return child;
}
async function run(args, extra) {
  const child = start(args, extra);
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => {
      children.delete(child);
      if (code === 0) resolve();
      else reject(new Error(`${args[0]} exited with ${code}`));
    });
  });
}
async function reservePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, port: server.address().port };
}
async function ready(url, process) {
  const end = Date.now() + 45000;
  while (Date.now() < end) {
    if (process.exitCode !== null) throw new Error(`Server stopped before becoming ready: ${url}`);
    try { const response = await fetch(url, { signal: AbortSignal.timeout(2000) }); if (response.ok) return; } catch { /* Startup in progress. */ }
    await wait(250);
  }
  throw new Error(`Server did not become ready: ${url}`);
}
try {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const path of files) {
    if (path.startsWith('.env') || path.startsWith('output/')) continue;
    const content = staged ? execFileSync('git', ['show', ':' + path], { cwd: root, maxBuffer: 64 * 1024 * 1024 }) : await readFile(join(root, path));
    await mkdir(dirname(join(workspace, path)), { recursive: true });
    await writeFile(join(workspace, path), content);
  }
  // Physical modules avoid Next build tracing resolving outside this isolated checkout.
  if (process.platform === 'linux') execFileSync('cp', ['-a', join(root, 'node_modules'), join(workspace, 'node_modules')]);
  else await cp(join(root, 'node_modules'), join(workspace, 'node_modules'), { recursive: true, verbatimSymlinks: true });
  const [{ server: fixtureReservation, port: fixturePort }, { server: appReservation, port: appPort }] = await Promise.all([reservePort(), reservePort()]);
  await Promise.all([new Promise(resolve => fixtureReservation.close(resolve)), new Promise(resolve => appReservation.close(resolve))]);
  const fixtureURL = `http://127.0.0.1:${fixturePort}`;
  const origin = `http://127.0.0.1:${appPort}`;
  Object.assign(env, { NEXT_PUBLIC_SUPABASE_URL: fixtureURL, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-only', NEXT_PUBLIC_SITE_URL: origin, NEXT_TELEMETRY_DISABLED: '1' });
  const fixture = start(['scripts/dashboard-fixture-server.mjs'], { DASHBOARD_FIXTURE_PORT: String(fixturePort) });
  await ready(`${fixtureURL}/rest/v1/venues`, fixture);
  console.log('Building isolated UI with read-only test data.');
  await run(['node_modules/next/dist/bin/next', 'build']);
  const app = start(['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(appPort)]);
  await ready(`${origin}/dang-nhap`, app);
  const testEnv = { UX_SCREENSHOT_DIR: screenshots };
  await run(['scripts/check-live-refresh-browser.mjs', origin]);
  await run(['scripts/check-public-ui.mjs', origin], testEnv);
  await run(['scripts/check-discovery-ux.mjs', origin], testEnv);
  await run(['scripts/check-site-motion.mjs', origin], testEnv);
  await run(['scripts/check-motion-interactions.mjs', origin], testEnv);
  await run(['scripts/check-dashboard-ui.mjs', origin], testEnv);
  await run(['scripts/capture-ui-review.mjs', origin], testEnv);
  console.log(`UI checks passed. Desktop/mobile images: ${screenshots}`);
} finally {
  await Promise.all([...children].map(async child => {
    if (child.exitCode !== null) return;
    child.kill('SIGTERM');
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), wait(3000)]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }));
  if (await realpath(workspace) !== workspace) throw new Error('Temporary workspace path changed; refusing cleanup.');
  await rm(workspace, { recursive: true, force: true });
}
