'use client';

import { useEffect } from 'react';
import { createClient, subscribeWithSession } from '@/lib/supabase/client';

/** RLS limits events to the signed-in user's bookings/courts. No payment polling. */
export function useBookingUpdates(refresh: () => void, courtId?: string) {
  useEffect(() => {
    const db = createClient();
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    const channel = db.channel(`owner-bookings:${courtId ?? 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', ...(courtId ? { filter: `court_id=eq.${courtId}` } : {}) }, refresh);
    const unsubscribe = subscribeWithSession(db, channel, status => { if (status === 'SUBSCRIBED') refresh(); });
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsubscribe();
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, courtId]);
}
