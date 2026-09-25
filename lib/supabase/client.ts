'use client';
import { REALTIME_SUBSCRIBE_STATES, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** Join only after restoring the browser session, otherwise private changes use anon RLS. */
export function subscribeWithSession(
  client: SupabaseClient,
  channel: RealtimeChannel,
  onStatus?: Parameters<RealtimeChannel['subscribe']>[0],
) {
  let stopped = false;
  void (async () => {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (stopped) return;
    await client.realtime.setAuth(data.session?.access_token ?? null);
    if (!stopped) channel.subscribe(onStatus);
  })().catch(() => {
    if (!stopped) onStatus?.(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR, new Error('Realtime session unavailable'));
  });
  return () => { stopped = true; void client.removeChannel(channel); };
}
