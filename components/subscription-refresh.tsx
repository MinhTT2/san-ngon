'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, subscribeWithSession } from '@/lib/supabase/client';

export function SubscriptionRefresh({ ownerId, paidUntil }: { ownerId: string; paidUntil: string | null }) {
  const router = useRouter();
  useEffect(() => {
    const db = createClient();
    const refresh = () => router.refresh();
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    const channel = db.channel(`subscription:${ownerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'owner_subscriptions', filter: `owner_id=eq.${ownerId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscription_invoices', filter: `owner_id=eq.${ownerId}` }, refresh);
    const stop = subscribeWithSession(db, channel, status => { if (status === 'SUBSCRIBED') refresh(); });
    // Schedule a refresh at expiry; timezone/calendar arithmetic remains in SQL.
    const remaining = paidUntil ? Date.parse(paidUntil) - Date.now() : 0;
    const timer = remaining > 0 ? window.setTimeout(refresh, Math.min(remaining, 2147483000) + 100) : undefined;
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => { stop(); window.clearTimeout(timer); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', visible); };
  }, [ownerId, paidUntil, router]);
  return null;
}
