'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ymd } from '@/lib/format';
import { MAX_SLOTS } from '@/lib/constants';
import type { Slot, Selection } from '@/lib/types';

/**
 * Một nguồn dữ liệu cho cả hai bố cục lưới lịch.
 * Bản điện thoại xếp giờ theo hàng dọc, bản desktop xếp sân theo hàng ngang —
 * hai component riêng, nhưng dùng chung hook này.
 */
export function useAvailability(venueId: string, date: Date, live = true) {
  const supabase = useMemo(() => createClient(), []);
  // Bản mobile và bản desktop cùng mount (một cái bị CSS ẩn), nên tên channel
  // phải khác nhau — hai subscription trùng topic thì removeChannel gỡ nhầm.
  const instanceId = useId();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<Slot[]>([]);

  const dateKey = ymd(date);

  const load = useCallback(async () => {
    setFailed(false);
    const { data, error } = await supabase.rpc('get_venue_availability', {
      p_venue_id: venueId,
      p_date: dateKey,
    });
    if (error) setFailed(true);
    else setSlots((data ?? []) as Slot[]);
    setLoading(false);
  }, [supabase, venueId, dateKey]);

  useEffect(() => {
    setPicked([]);
    setLoading(true);
    load();
  }, [load]);

  // Người khác vừa đặt → lưới tự xám đi. Khoảnh khắc ấn tượng nhất khi demo hai máy.
  useEffect(() => {
    if (!live) return;
    const channel = supabase
      .channel(`bookings:${venueId}:${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, venueId, live, load, instanceId]);

  const courts = useMemo(() => {
    const seen = new Map<string, string>();
    slots.forEach((s) => seen.set(s.court_id, s.court_name));
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [slots]);

  const times = useMemo(
    () => [...new Set(slots.map((s) => s.starts_at))].sort(),
    [slots]
  );

  const byKey = useMemo(() => {
    const m = new Map<string, Slot>();
    slots.forEach((s) => m.set(`${s.court_id}|${s.starts_at}`, s));
    return m;
  }, [slots]);

  /** Chỉ cho chọn tối đa MAX_SLOTS khung liền nhau trên cùng một sân. */
  const toggle = useCallback((slot: Slot) => {
    if (!slot.is_available) return;
    setPicked((prev) => {
      if (prev.length && prev[0].court_id !== slot.court_id) return [slot];
      const exists = prev.some((s) => s.starts_at === slot.starts_at);
      const next = exists
        ? prev.filter((s) => s.starts_at !== slot.starts_at)
        : [...prev, slot].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      if (!exists && next.length > MAX_SLOTS) return prev;
      for (let i = 1; i < next.length; i++) {
        if (next[i - 1].ends_at !== next[i].starts_at) return [slot];
      }
      return next;
    });
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

  const pickedKeys = useMemo(
    () => new Set(picked.map((s) => `${s.court_id}|${s.starts_at}`)),
    [picked]
  );

  return { slots, courts, times, byKey, picked, pickedKeys, selection, toggle, loading, failed, reload: load };
}
