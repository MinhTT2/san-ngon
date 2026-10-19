'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export const ACTIVITY_IDLE_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 30 * 1000;

/** Sends state only. SQL measures elapsed time and deduplicates concurrent tabs. */
export function UserActivityTracker() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    const db = createClient();
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const sessionId = crypto.randomUUID();
    let lastInput = performance.now();
    let active = false;
    let pending: boolean | null = null;
    let sending = false;
    let idleTimer: ReturnType<typeof setTimeout>;

    // Serialize and coalesce state changes so an old active request cannot follow a stop.
    async function send(next: boolean) {
      pending = next;
      if (sending) return;
      sending = true;
      try {
        while (pending !== null) {
          const value = pending;
          pending = null;
          await fetch('/api/activity', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, active: value }),
            keepalive: true, signal: AbortSignal.timeout(8000),
          }).catch(() => {});
        }
      } finally { sending = false; }
    }
    function sync(heartbeat = false) {
      const next = document.visibilityState === 'visible' && document.hasFocus() && performance.now() - lastInput < ACTIVITY_IDLE_MS;
      if (next !== active || (next && heartbeat)) {
        active = next;
        void send(next);
      }
    }
    function input() {
      lastInput = performance.now();
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => sync(), ACTIVITY_IDLE_MS);
      sync();
    }
    function visibility() {
      if (document.visibilityState === 'visible' && document.hasFocus()) input();
      else sync();
    }
    function blur() { sync(); }
    function stop() {
      if (active) { active = false; void send(false); }
    }
    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;
    events.forEach(event => window.addEventListener(event, input, { passive: true }));
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('focus', input);
    window.addEventListener('blur', blur);
    window.addEventListener('pagehide', stop);
    window.addEventListener('pageshow', input);
    const heartbeat = setInterval(() => sync(true), HEARTBEAT_MS);
    input();
    return () => {
      clearInterval(heartbeat); clearTimeout(idleTimer);
      events.forEach(event => window.removeEventListener(event, input));
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', input);
      window.removeEventListener('blur', blur);
      window.removeEventListener('pagehide', stop);
      window.removeEventListener('pageshow', input);
      stop();
    };
  }, [userId]);

  return null;
}
