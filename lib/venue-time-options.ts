import { MAX_SLOTS } from '@/lib/constants';
import type { Selection, Slot } from '@/lib/types';

/** Group SQL-provided slots for display. create_booking still validates and prices the booking. */
export function venueTimeOptions(slots: Slot[], duration: number) {
  const byKey = new Map(slots.map((slot) => [`${slot.court_id}|${slot.starts_at}`, slot]));
  const byTime = new Map<string, Selection[]>();

  for (const first of slots) {
    if (!byTime.has(first.starts_at)) byTime.set(first.starts_at, []);
    const picked: Slot[] = [];
    let minutes = 0;
    let slot: Slot | undefined = first;
    while (slot?.is_available && minutes < duration && picked.length < MAX_SLOTS) {
      picked.push(slot);
      minutes += slot.slot_minutes;
      slot = byKey.get(`${slot.court_id}|${slot.ends_at}`);
    }
    if (!picked.length || minutes !== duration) continue;
    byTime.get(first.starts_at)!.push({
      courtId: first.court_id,
      courtName: first.court_name,
      startsAt: first.starts_at,
      endsAt: picked[picked.length - 1].ends_at,
      total: picked.reduce((sum, item) => sum + item.price, 0),
      slots: picked,
    });
  }

  return [...byTime].sort(([a], [b]) => a.localeCompare(b)).map(([startsAt, choices]) => ({
    startsAt,
    choices: choices.sort((a, b) => a.total - b.total || a.courtName.localeCompare(b.courtName, 'vi', { numeric: true })),
  }));
}
