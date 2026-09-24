'use client';

import { useEffect } from 'react';
import { SlotCell } from './slot-cell';
import { useAvailability } from '@/lib/use-availability';
import { hhmm, vnd } from '@/lib/format';
import { MAX_SLOTS } from '@/lib/constants';
import type { Selection } from '@/lib/types';

/** Điện thoại: giờ theo hàng dọc, sân là cột. Dùng cho màn hình dưới 768px. */
export function SlotPickerMobile({
  venueId,
  date,
  depositPct,
  onSelectionChange,
  onConfirm,
}: {
  venueId: string;
  date: Date;
  depositPct: number;
  onSelectionChange?: (s: Selection | null) => void;
  onConfirm?: () => void;
}) {
  const a = useAvailability(venueId, date);

  useEffect(() => { onSelectionChange?.(a.selection); }, [a.selection, onSelectionChange]);

  if (a.loading) return <div className="h-96 animate-pulse rounded-card bg-sunk" aria-busy="true" />;

  if (a.failed) {
    return (
      <div className="rounded-card border border-hairline p-6 text-center">
        <p className="text-sm text-ink-secondary">Không tải được lịch sân.</p>
        <button onClick={a.reload} className="mt-3 h-11 rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink">
          Tải lại
        </button>
      </div>
    );
  }

  if (!a.times.length) {
    return (
      <div className="rounded-card border border-hairline p-8 text-center text-sm text-ink-secondary">
        Sân chưa mở lịch cho ngày này. Chọn ngày khác giúp bạn nhé.
      </div>
    );
  }

  const deposit = a.selection ? Math.ceil((a.selection.total * depositPct) / 100 / 1000) * 1000 : 0;
  const availableCount = a.slots.filter((slot) => slot.is_available).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3"><div><p className="text-sm font-semibold text-pitch">Chọn giờ trên lịch</p><p className="mt-1 text-xs text-ink-secondary">Chọn giờ liền nhau trên cùng một sân</p></div><span className="rounded-pill bg-free-fill px-3 py-1 text-xs font-semibold text-free-ink">{availableCount} giờ trống</span></div>
      <Legend />

      <div className="overflow-x-auto rounded-card border border-hairline bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-16 bg-card px-3 py-3 text-left text-xs font-semibold text-ink-secondary">Giờ</th>
              {a.courts.map((c) => (
                  <th key={c.id} className="min-w-[92px] border-l border-hairline px-1 py-3 text-xs font-semibold text-pitch">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {a.times.map((t) => (
              <tr key={t} className="border-t border-hairline">
                <th className="sticky left-0 z-10 bg-card px-3 py-1 text-left align-middle text-xs font-medium tabular-nums text-ink-secondary">
                  {hhmm(t)}
                </th>
                {a.courts.map((c) => {
                  const key = `${c.id}|${t}`;
                  const slot = a.byKey.get(key);
                  return (
                    <td key={key} className="border-l border-hairline p-1">
                      {slot ? (
                        <SlotCell slot={slot} selected={a.pickedKeys.has(key)} onClick={() => a.toggle(slot)} />
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {a.selection ? (
        <div className="sticky bottom-3 z-20 -mx-1 rounded-card border border-pitch bg-pitch px-4 pb-4 pt-4 text-pitch-ink">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">
                {a.selection.courtName} · {hhmm(a.selection.startsAt)}–{hhmm(a.selection.endsAt)}
              </span>
              <span className="text-xs text-pitch-ink/70">Cọc trước {vnd(deposit)}</span>
            </div>
            <span className="font-display text-xl font-bold">{vnd(a.selection.total)}</span>
          </div>
          <button onClick={onConfirm} className="h-12 w-full rounded-control bg-white text-base font-semibold text-pitch transition-colors hover:bg-free-fill">
            Tiếp tục đặt sân <span aria-hidden="true" className="ml-2">→</span>
          </button>
        </div>
      ) : (
        <p className="rounded-control bg-sunk px-3 py-3 text-xs leading-5 text-ink-secondary">
          Chọn tối đa {MAX_SLOTS} khung giờ liền nhau trên cùng một sân. Giờ vàng được tô màu vàng.
        </p>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-ink-secondary">
      <Item className="bg-free-fill border-free-line" label="Còn trống" />
      <Item className="bg-peak-fill border-peak-line" label="Giờ vàng" />
      <Item className="bg-taken-fill border-hairline" label="Đã đặt" />
    </div>
  );
}

function Item({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-[3px] border ${className}`} />
      {label}
    </span>
  );
}
