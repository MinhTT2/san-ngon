'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, subscribeWithSession } from '@/lib/supabase/client';
export function TournamentRefresh({ id, deadline }: { id: string; deadline: string }) {
  const router = useRouter();
  useEffect(() => {
    const db = createClient();
    const refresh = () => router.refresh();
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    const channel = db.channel(`tournament:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_registrations', filter: `tournament_id=eq.${id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_payment_events' }, refresh);
    const stop = subscribeWithSession(db, channel, status => { if (status === 'SUBSCRIBED') refresh(); });
    const remaining = Date.parse(deadline) - Date.now();
    const timer = remaining > 0 ? window.setTimeout(refresh, Math.min(remaining + 100, 2147483000)) : undefined;
    window.addEventListener('online', refresh); window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => { stop(); window.clearTimeout(timer); window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); };
  }, [id, deadline, router]);
  return null;
}
