'use client';

import { useEffect } from 'react';
import { SlotCell } from './slot-cell';
import { useAvailability } from '@/lib/use-availability';
import { hhmm, vnd } from '@/lib/format';
import type { Selection } from '@/lib/types';

/**
 * Desktop: sân theo hàng ngang, giờ là cột — cả ngày của cả cụm sân trong một khung hình.
 * Đây là bố cục khác hẳn bản điện thoại, không phải bản co giãn. Dữ liệu thì chung.
 */
export function SlotPickerDesktop({
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

  if (a.loading) return <div className="h-64 animate-pulse rounded-card bg-sunk" aria-busy="true" />;
  if (a.failed) {
    return (
      <div className="rounded-card border border-hairline p-6 text-center text-sm text-ink-secondary">
        Không tải được lịch sân.{' '}
        <button onClick={a.reload} className="font-semibold text-pitch underline">Tải lại</button>
      </div>
    );
  }
  if (!a.times.length) {
    return <div className="rounded-card border border-hairline p-8 text-center text-sm text-ink-secondary">Sân chưa mở lịch cho ngày này.</div>;
  }

  const cols = `92px repeat(${a.times.length}, minmax(0, 1fr))`;
  const deposit = a.selection ? Math.ceil((a.selection.total * depositPct) / 100 / 1000) * 1000 : 0;

  return (
    <div className="flex gap-8">
      <div className="min-w-0 flex-grow rounded-card border border-hairline bg-card p-4">
        <div className="grid gap-1 pb-1" style={{ gridTemplateColumns: cols }}>
          <span className="text-[11px] text-ink-secondary">Giờ</span>
          {a.times.map((t) => (
            <span key={t} className="text-center text-[11px] tabular-nums text-ink-secondary">
              {hhmm(t).slice(0, 2)}
            </span>
          ))}
        </div>

        {a.courts.map((c) => (
          <div key={c.id} className="grid gap-1 pb-1" style={{ gridTemplateColumns: cols }}>
            <span className="flex items-center text-[13px] font-semibold text-pitch">{c.name}</span>
            {a.times.map((t) => {
              const key = `${c.id}|${t}`;
              const slot = a.byKey.get(key);
              return slot ? (
                <SlotCell key={key} slot={slot} selected={a.pickedKeys.has(key)} onClick={() => a.toggle(slot)} height={54} />
              ) : (
                <span key={key} />
              );
            })}
          </div>
        ))}
      </div>

      <aside className="w-80 flex-none rounded-card border border-hairline bg-card p-5">
        <h2 className="mb-4 text-[15px] font-semibold">Khung giờ bạn chọn</h2>
        {!a.selection ? (
          <p className="text-[13px] leading-relaxed text-ink-secondary">
            Bấm vào ô trống trên lịch. Chọn được tối đa 3 giờ liền nhau trên cùng một sân.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <Row label="Sân" value={a.selection.courtName} />
            <Row label="Giờ" value={`${hhmm(a.selection.startsAt)} – ${hhmm(a.selection.endsAt)}`} />
            <div className="h-px bg-hairline" />
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-ink-secondary">Tổng tiền sân</span>
              <span className="font-display text-2xl font-bold text-pitch">{vnd(a.selection.total)}</span>
            </div>
            <Row label={`Cọc trước ${depositPct}%`} value={vnd(deposit)} />
            <Row label="Trả tại sân" value={vnd(a.selection.total - deposit)} />
            <button onClick={onConfirm} className="h-12 rounded-control bg-pitch text-[15px] font-semibold text-pitch-ink">
              Đặt và trả cọc
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-ink-secondary">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
