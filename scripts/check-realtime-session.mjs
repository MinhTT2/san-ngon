import assert from 'node:assert/strict';
import { subscribeWithSession } from '../lib/supabase/client.ts';

for (const stopBeforeSession of [false, true]) {
  const events = [];
  let restore;
  const session = new Promise(resolve => { restore = resolve; });
  const client = { auth: { getSession: () => session }, realtime: { setAuth: async token => { assert.equal(token, 'test-owner-session'); events.push('authenticated'); } }, removeChannel: async () => { events.push('removed'); } };
  const channel = { subscribe: () => { assert.deepEqual(events, ['authenticated']); events.push('subscribed'); } };
  const stop = subscribeWithSession(client, channel);
  assert.deepEqual(events, [], 'must not join before session restoration');
  if (stopBeforeSession) stop();
  restore({ data: { session: { access_token: 'test-owner-session' } }, error: null });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events, stopBeforeSession ? ['removed'] : ['authenticated', 'subscribed']);
  if (!stopBeforeSession) stop();
}
let status;
subscribeWithSession({ auth: { getSession: async () => { throw Error('offline'); } } }, { subscribe: () => assert.fail('must not join anonymously after auth error') }, s => { status = s; });
await new Promise(resolve => setImmediate(resolve));
assert.equal(status, 'CHANNEL_ERROR');
console.log('OK: private realtime waits for session, and unmounted/error paths cannot join.');
