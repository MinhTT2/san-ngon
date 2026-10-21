// Deployment setup. Secrets travel through stdin/private temporary SQL, never argv or logs.
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, chmod, realpath, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const mode = process.argv.includes('--prepare') ? 'prepare' : process.argv.includes('--activate') ? 'activate' : 'help';
if (mode === 'help') {
  console.log('Prepare Vercel secret: node scripts/configure-notification-worker.mjs --prepare');
  console.log('After deploy, activate Supabase Vault/pg_net/cron: node scripts/configure-notification-worker.mjs --activate --origin=https://san-ngon.vercel.app');
  process.exit(0);
}
const state = join(homedir(), '.local', 'state', 'san-ngon');
const secretPath = join(state, 'notification-worker-secret');
await mkdir(state, { recursive: true, mode: 0o700 });
let secret = await readFile(secretPath, 'utf8').catch(() => '');
if (!secret && mode === 'prepare') { secret = randomBytes(32).toString('hex'); await writeFile(secretPath, secret, { mode: 0o600, flag: 'wx' }); }
if (!/^[0-9a-f]{64}$/.test(secret)) throw new Error('Restore the saved notification worker secret before activation.');
await chmod(secretPath, 0o600);
if (mode === 'prepare') {
  const result = spawnSync('node_modules/.bin/vercel', ['env', 'add', 'NOTIFICATION_WORKER_SECRET', 'production', '--sensitive', '--force', '--yes'], { input: secret, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Vercel environment update failed; verify CLI login/project. Provider output withheld to protect the secret.');
  console.log('Production worker secret configured. Back up the private state file, then deploy the code before activation.');
  process.exit(0);
}
const originArg = process.argv.find(value => value.startsWith('--origin='))?.slice(9);
const origin = new URL(originArg || 'https://san-ngon.vercel.app');
if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) throw new Error('Expected an HTTPS site origin.');
const endpoint = new URL('/api/sepay/notifications', origin).href;
const probe = await fetch(endpoint, { method: 'POST', signal: AbortSignal.timeout(15000), redirect: 'error' });
if (probe.status !== 401) throw new Error('Protected worker route is not deployed. Activation refused.');
const sqlString = value => "'" + value.replaceAll("'", "''") + "'";
const directory = await mkdtemp(join(tmpdir(), 'san-ngon-worker-setup-'));
try {
  await chmod(directory, 0o700);
  const file = join(directory, 'activate.sql');
  await writeFile(file, `begin;
create extension if not exists pg_net with schema extensions;
do $$ declare existing uuid; first_activation boolean; begin
 select id into existing from vault.secrets where name='san_ngon_notification_worker';
 if existing is null then perform vault.create_secret(${sqlString(secret)},'san_ngon_notification_worker','Private notification worker authentication');
 else perform vault.update_secret(existing,${sqlString(secret)});end if;
 first_activation:=not exists(select 1 from public.notification_worker_config);
 insert into public.notification_worker_config(singleton,endpoint_url) values(true,${sqlString(endpoint)})
  on conflict(singleton) do update set endpoint_url=excluded.endpoint_url;
 -- The preceding deployment might have delivered inline. Keep its pending jobs
 -- for explicit review, so activating this worker cannot send those messages twice.
 if first_activation then update public.notification_deliveries set status='failed',last_reason='ROLLOUT_DELIVERY_REVIEW',updated_at=clock_timestamp() where status='pending';end if;
end $$;
select cron.schedule('notification-delivery','* * * * *','select public.dispatch_notification_worker()');
commit;
`, { mode: 0o600 });
  const result = spawnSync('node_modules/.bin/supabase', ['db', 'query', '--linked', '--file', file], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Scheduler activation failed; SQL output withheld to protect the worker secret. No setup transaction was committed.');
  console.log('Notification worker scheduled every minute. Review rollout jobs in /admin/van-hanh; no historical jobs are sent automatically.');
} finally {
  if (await realpath(directory) !== directory) throw new Error('Private setup directory changed; refusing cleanup.');
  await rm(directory, { recursive: true, force: true });
}
