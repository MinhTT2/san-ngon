'use client';

import { useEffect, useId } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createRefreshQueue } from '@/lib/refresh-queue';

const TABLES = {
  admin: ['profiles', 'venues', 'courts', 'bookings', 'tournaments', 'owner_subscriptions', 'subscription_invoices', 'feedback'],
  owner: ['venues', 'courts', 'bookings', 'court_closures', 'tournaments', 'owner_subscriptions'],
};

/** Refresh read views through their existing session/RLS, never payment checkout. */
export function LivePageRefresh({ scope }: { scope: keyof typeof TABLES | 'discovery' }) {
  const router = useRouter();
  const path = usePathname();
  const instance = useId();
  useEffect(() => {
    const dirty = new Set<HTMLFormElement>();
    const queue = createRefreshQueue(() => router.refresh(), () => {
      dirty.forEach(form => { if (!form.isConnected) dirty.delete(form); });
      return document.visibilityState === 'visible' && navigator.onLine && !dirty.size
        && !document.querySelector('dialog[open], [role="dialog"]')
        && !document.querySelector('[data-unsaved-changes="true"], [data-unsaved-busy="true"]')
        && !document.activeElement?.matches('input, select, textarea, [contenteditable="true"]');
    });
    const formState = new MutationObserver(queue.flush);
    formState.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-unsaved-changes', 'data-unsaved-busy'] });
    const request = () => queue.request();
    const edit = (event: Event) => {
      const form = event.target instanceof Element ? event.target.closest('form') : null;
      if (form) dirty.add(form);
    };
    const finish = (event: Event) => {
      if (event.target instanceof HTMLFormElement) dirty.delete(event.target);
      queue.flush();
    };
    let disposed = false;
    let stop = () => {};
    // Discovery only refreshes its public RPC; don't load the private realtime SDK.
    if (scope !== 'discovery') void import('@/lib/supabase/client').then(({ createClient, subscribeWithSession }) => {
      if (disposed) return;
      const db = createClient();
      const channel = db.channel(`live-page:${scope}:${instance}`);
      TABLES[scope].forEach(table => channel.on('postgres_changes', { event: '*', schema: 'public', table }, request));
      stop = subscribeWithSession(db, channel, status => { if (status === 'SUBSCRIBED') request(); });
    }).catch(request);
    // Public availability hides other customers' rows; refresh the public RPC result.
    // Other read views also recover when realtime is unavailable. No hidden-tab requests.
    const interval = window.setInterval(request, scope === 'discovery' ? 15000 : 30000);
    window.addEventListener('focus', request);
    window.addEventListener('online', request);
    window.addEventListener('san-ngon:page-refresh', request);
    document.addEventListener('visibilitychange', request);
    document.addEventListener('input', edit, true);
    document.addEventListener('change', edit, true);
    document.addEventListener('submit', finish, true);
    document.addEventListener('reset', finish, true);
    document.addEventListener('focusout', queue.flush);
    return () => {
      disposed = true;
      queue.dispose(); formState.disconnect(); stop(); clearInterval(interval);
      window.removeEventListener('focus', request);
      window.removeEventListener('online', request);
      window.removeEventListener('san-ngon:page-refresh', request);
      document.removeEventListener('visibilitychange', request);
      document.removeEventListener('input', edit, true);
      document.removeEventListener('change', edit, true);
      document.removeEventListener('submit', finish, true);
      document.removeEventListener('reset', finish, true);
      document.removeEventListener('focusout', queue.flush);
    };
  }, [scope, path, instance, router]);
  return null;
}
