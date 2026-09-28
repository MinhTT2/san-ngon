'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createClient, subscribeWithSession } from '@/lib/supabase/client';
import type { Slot, Selection } from '@/lib/types';

/** Shared live availability and the concrete court selected for booking. */
export function useAvailability(venueId: string, dateKey: string, live = true) {
  const supabase = useMemo(() => createClient(), []);
  const instanceId = useId();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<Slot[]>([]);
  const [selectionLost, setSelectionLost] = useState(false);

  const requestId = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    const { data, error } = await supabase.rpc('get_venue_availability', {
      p_venue_id: venueId,
      p_date: dateKey,
    });
    if (request !== requestId.current) return;
    setFailed(Boolean(error));
    if (!error) {
      const next = (data ?? []) as Slot[];
      setSlots(next);
      setPicked((prev) => {
        const updated = prev.map((picked) => next.find((slot) =>
          slot.court_id === picked.court_id && slot.starts_at === picked.starts_at
          && slot.ends_at === picked.ends_at && slot.sport === picked.sport && slot.is_available));
        if (updated.every((slot): slot is Slot => Boolean(slot))) return updated;
        setSelectionLost(true);
        return [];
      });
    }
    setLoading(false);
  }, [supabase, venueId, dateKey]);

  useEffect(() => {
    setPicked([]);
    setSelectionLost(false);
    setLoading(true);
    void load();
    return () => {
      // This is a request generation counter, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestId.current++;
    };
  }, [load]);

  // RLS hides other customers' bookings, so their postgres_changes are not public.
  // Refresh anonymous availability only; never expose booking rows to bypass RLS.
  useEffect(() => {
    if (!live) return;
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    const channel = supabase
      .channel(`bookings:${venueId}:${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => load());
    const unsubscribe = subscribeWithSession(supabase, channel);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
      unsubscribe();
    };
  }, [supabase, venueId, live, load, instanceId]);

  useEffect(() => {
    if (!live) return;
    const expiries = slots.flatMap((slot) => slot.hold_expires_at ? [Date.parse(slot.hold_expires_at)] : []);
    if (!expiries.length) return;
    const timer = setTimeout(() => void load(), Math.max(1000, Math.min(...expiries) - Date.now() + 250));
    return () => clearTimeout(timer);
  }, [slots, live, load]);

  const choose = useCallback((choice: Selection | null) => {
    setPicked(choice?.slots ?? []);
    setSelectionLost(false);
  }, []);

  const selection: Selection | null = useMemo(() => {
    if (!picked.length) return null;
    return {
      courtId: picked[0].court_id,
      courtName: picked[0].court_name,
      startsAt: picked[0].starts_at,
      endsAt: picked[picked.length - 1].ends_at,
      total: picked.reduce((sum, s) => sum + s.price, 0),
      slots: picked,
    };
  }, [picked]);

  return { slots, selection, choose, selectionLost, loading, failed, reload: load };
}
