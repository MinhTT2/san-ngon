import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const workspace = process.argv[2];
assert(process.env.CI === 'true' && workspace, 'only the disposable CI stack is allowed');
assert.equal(await readFile(join(workspace, '.sql-ci-isolated'), 'utf8'), 'LOCAL ONLY');
const config = await readFile(join(workspace, 'supabase/config.toml'), 'utf8');
assert(/^project_id = "san-ngon-sql-ci"$/m.test(config));
async function run(file) {
 const sql=await readFile(file,'utf8');
 return new Promise((resolvePromise,reject) => {
  const child=spawn('docker',['exec','-i','supabase_db_san-ngon-sql-ci','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});let output='';
  for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>output+=chunk);
  child.once('error',reject);child.once('exit',code=>resolvePromise({code,output}));
  child.stdin.on('error',reject);child.stdin.end(sql);
 });
}
let setup=(await readFile('scripts/check-operations-audit.sql','utf8')).split("select set_config('request.jwt.claim.sub'")[0].replaceAll('e023','e029').replaceAll('operations-audit-rollback','booking-race-ci').replaceAll('SANAUD234','SANRAC236');
await writeFile(join(workspace,'race-setup.sql'),setup+'\ncommit;');
const setupResult=await run(join(workspace,'race-setup.sql'));assert.equal(setupResult.code,0,setupResult.output);
for(const [index,code] of ['SANRAC234','SANRAC235'].entries()) {
 const sql=`begin;set local statement_timeout='15s';insert into public.bookings(code,court_id,user_id,starts_at,ends_at,status,total_amount,deposit_amount,customer_phone) values('${code}','e0290000-0000-4000-8000-000000000030','e0290000-0000-4000-8000-000000000003',now()+interval '2 days',now()+interval '2 days 1 hour','pending',100000,100000,'0901111111');select pg_sleep(1);commit;`;
 await writeFile(join(workspace,`race-${index}.sql`),sql);
}
const results=await Promise.all([run(join(workspace,'race-0.sql')),run(join(workspace,'race-1.sql'))]);
assert.equal(results.filter(r=>r.code===0).length,1,'exactly one concurrent booking commits');
assert(results.some(r=>r.code!==0 && /exclusion constraint|23P01/.test(r.output)),JSON.stringify(results));
console.log('OK: two database connections raced for the same court/time; one committed, one was rejected by GiST.');
