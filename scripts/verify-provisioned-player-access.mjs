// Verify operator-provisioned password accounts against the configured production Auth.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as wait } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';

const file = process.argv[2];
assert(file, 'Provide the private credential JSON path; never put credentials in Git.');
const accounts = JSON.parse(await readFile(file, 'utf8'));
assert.equal(accounts.length, Number(process.argv[5] || 40));
const env = Object.fromEntries((await readFile(process.argv[3] || '.env.local', 'utf8')).split(/\r?\n/).flatMap(line => {
  const match = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (!match) return [];
  const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  return [[match[1], value]];
}));
assert(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const offset = Number(process.argv[4] || 0);
assert(Number.isInteger(offset) && offset >= 0 && offset < accounts.length);
let verified = 0;
for (const account of accounts.slice(offset)) {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let result;
  for (let attempt = 0; attempt < 5; attempt++) {
    result = await client.auth.signInWithPassword({ email: account.email, password: account.password });
    if (result.error?.status !== 429) break;
    console.log('Auth rate limit: waiting 30 seconds before retry.');
    await wait(30000);
  }
  const { data, error } = result;
  assert.ifError(error);
  try {
    assert.equal(data.user.id, account.id);
    assert.equal(data.user.email, account.email);
    assert.equal(data.user.app_metadata.account_kind, 'simulation');
    assert.equal(data.user.app_metadata.mailbox_ownership_verified, false);
    const profile = await client.from('profiles').select('id,full_name,role').eq('id', account.id).single();
    assert.ifError(profile.error);
    assert.equal(profile.data.full_name, account.full_name);
    assert.equal(profile.data.role, 'player');
    const admin = await client.rpc('is_admin');
    assert.ifError(admin.error);
    assert.equal(admin.data, false);
    verified++;
    if (verified % 10 === 0) console.log(JSON.stringify({ password_logins_verified: verified }));
  } finally {
    await client.auth.signOut({ scope: 'local' });
    await wait(2000);
  }
}
console.log(JSON.stringify({ password_logins_verified: verified, profiles_verified: verified, previously_verified: offset, privileged_accounts: 0 }));
