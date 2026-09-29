'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, subscribeWithSession } from '@/lib/supabase/client';
export function TournamentRefresh({ id, deadlines }: { id: string; deadlines: string[] }) {
  const router = useRouter();
  const deadlineKey = deadlines.join(',');
  useEffect(() => {
    const db = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => router.refresh(), 150); };
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    const channel = db.channel(`tournament:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_registrations', filter: `tournament_id=eq.${id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_payment_events' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_settlements', filter: `tournament_id=eq.${id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_transfers', filter: `tournament_id=eq.${id}` }, refresh);
    const stop = subscribeWithSession(db, channel, status => { if (status === 'SUBSCRIBED') refresh(); });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const remaining = Math.min(...deadlineKey.split(',').map(d => Date.parse(d) - Date.now()).filter(ms => ms > 0));
      if (Number.isFinite(remaining)) timer = setTimeout(() => { refresh(); schedule(); }, Math.min(remaining + 100, 2147483000));
    };
    schedule();
    window.addEventListener('online', refresh); window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => { stop(); clearTimeout(refreshTimer); window.clearTimeout(timer); window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); };
  }, [id, deadlineKey, router]);
  return null;
}
