// Starts a disposable LOCAL Supabase stack. Never links, reads production env, or uses a cloud DB URL.
import { spawn, execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const preflight = process.argv.includes('--preflight');
if (!preflight && (process.env.CI !== 'true' || process.platform !== 'linux')) throw new Error('SQL stack runs only in isolated Linux CI. Local development stays remote-only.');
const files = execFileSync('git', ['ls-files', '-z', 'supabase/migrations/*.sql'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
if (!files.length || files.some(file => !/^supabase\/migrations\/\d+_[a-z0-9_]+\.sql$/.test(file))) throw new Error('Invalid tracked migration inventory');
const checks = ['vip-booking','booking-holds','booking-input-guards','booking-policy','booking-details-snapshot','booking-refunds','sepay-registration','owner-subscriptions','tournaments','community','profile','owner-review-reasons','incoming-transfers','notification-delivery','operations-audit','operational-health','cash-report','booking-conversion','content-moderation','personal-data'];
for (const name of checks) {
  const sql = await readFile(join(root, `scripts/check-${name}.sql`), 'utf8');
  if (!/\bbegin;/.test(sql) || !/rollback;\s*$/.test(sql)) throw new Error(`Rollback check required: ${name}`);
}
if (preflight) { console.log(`OK: ${files.length} tracked migrations, ${checks.length} rollback checks; no credentials or linked database required.`); process.exit(0); }
const workspace = await mkdtemp(join(tmpdir(), 'san-ngon-sql-ci-'));
const cli = join(root, 'node_modules/.bin/supabase');
const env = Object.fromEntries(['PATH','HOME','USER','LANG','CI','XDG_RUNTIME_DIR'].filter(name => process.env[name]).map(name => [name, process.env[name]]));
async function run(args, quiet = false) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cli, [...args, '--workdir', workspace], { cwd: workspace, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk).slice(-20000); if (!quiet) process.stdout.write(chunk); });
    child.once('error', reject); child.once('exit', code => code === 0 ? resolvePromise() : reject(new Error(`${args[0]} failed (${code}): ${output}`)));
  });
}
async function query(file) {
  const sql = await readFile(file, 'utf8');
  await new Promise((resolvePromise, reject) => {
    const child = spawn('docker', ['exec', '-i', 'supabase_db_san-ngon-sql-ci', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk).slice(-20000); });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolvePromise() : reject(new Error(`SQL failed (${code}): ${output}`)));
    child.stdin.on('error', reject); child.stdin.end(sql);
  });
}
try {
  await run(['init'], true);
  const config = join(workspace, 'supabase/config.toml');
  const source = await readFile(config, 'utf8');
  await writeFile(config, source.replace(/^project_id = .*$/m, 'project_id = "san-ngon-sql-ci"'));
  await mkdir(join(workspace, 'supabase/migrations'), { recursive: true });
  for (const path of files) await cp(join(root, path), join(workspace, path));
  await writeFile(join(workspace, '.sql-ci-isolated'), 'LOCAL ONLY');
  console.log('Creating disposable local database and applying all tracked migrations. No production credentials are passed.');
  await run(['start','--exclude','studio,edge-runtime,logflare,vector,imgproxy,supavisor,postgres-meta'], true);
  // Background jobs are tested explicitly and cannot dispatch externally in this stack.
  const disable = join(workspace, 'disable-jobs.sql');
  await writeFile(disable, 'select cron.unschedule(jobid) from cron.job;');
  await query(disable);
  for (const name of checks) { console.log(`SQL: ${name}`); await query(join(root, `scripts/check-${name}.sql`)); }
  await new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [join(root, 'scripts/check-booking-concurrency.mjs'), workspace], { cwd: root, env, stdio: 'inherit' });
    child.once('error', reject); child.once('exit', code => code === 0 ? resolvePromise() : reject(new Error('Booking concurrency check failed')));
  });
  console.log(`OK: fresh migrations, ${checks.length} SQL checks and concurrent booking constraint.`);
} finally {
  try { await run(['stop','--no-backup'], true); } catch (error) { console.error('Local stack cleanup:', error.message); }
  if (await realpath(workspace) !== workspace || !workspace.startsWith(join(tmpdir(), 'san-ngon-sql-ci-'))) throw new Error('Refusing cleanup outside the disposable CI directory');
  await rm(workspace, { recursive: true, force: true });
}
