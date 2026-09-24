'use client';

import { hhmm, hourOf, vnd, vndShort } from '@/lib/format';
import { PEAK_FROM_HOUR, PEAK_TO_HOUR } from '@/lib/constants';
import type { Slot } from '@/lib/types';

/**
 * Ô một khung giờ. Bốn trạng thái, mỗi trạng thái một bộ ba token màu.
 * Ô đã đặt vẫn là <button disabled> chứ không phải <div>: trình đọc màn hình
 * phải biết đây là thứ đáng lẽ bấm được nhưng hiện không.
 */
export function SlotCell({
  slot,
  selected,
  onClick,
  height = 48,
}: {
  slot: Slot;
  selected: boolean;
  onClick: () => void;
  height?: number;
}) {
  const hour = hourOf(slot.starts_at);
  const isPeak = hour >= PEAK_FROM_HOUR && hour < PEAK_TO_HOUR;

  const base = 'relative flex w-full items-center justify-center rounded-slot border text-xs font-semibold tabular-nums transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch disabled:cursor-default';

  const tone = !slot.is_available
    ? 'bg-taken-fill border-hairline text-taken-ink'
    : selected
      ? 'bg-pitch border-pitch text-pitch-ink'
      : isPeak
        ? 'bg-peak-fill border-peak-line text-peak-ink hover:border-peak-ink'
        : 'bg-free-fill border-free-line text-free-ink hover:border-pitch';

  const label = `${slot.court_name} lúc ${hhmm(slot.starts_at)}${
    slot.is_available ? `, ${vnd(slot.price)}` : ', đã có người đặt'
  }`;

  return (
    <button
      type="button"
      disabled={!slot.is_available}
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      style={{ height }}
      className={`${base} ${tone}`}
    >
      {slot.is_available ? <><span>{vndShort(slot.price)}</span>{selected && <span className="absolute right-1 top-1 text-[10px] leading-none">✓</span>}</> : '—'}
    </button>
  );
}
