'use client';

import { useEffect } from 'react';
import { SlotCell } from './slot-cell';
import { useAvailability } from '@/lib/use-availability';
import { dayLabel, hhmm, vnd } from '@/lib/format';
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
  date: string;
  depositPct: number;
  onSelectionChange?: (s: Selection | null) => void;
  onConfirm?: () => void;
}) {
  const a = useAvailability(venueId, date);

  useEffect(() => { onSelectionChange?.(a.selection); }, [a.selection, onSelectionChange]);

  if (a.loading) return <div className="h-[30rem] animate-pulse rounded-card border border-hairline bg-sunk" aria-busy="true" />;
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

  const cols = `112px repeat(${a.times.length}, minmax(78px, 1fr))`;
  const deposit = a.selection ? Math.ceil((a.selection.total * depositPct) / 100 / 1000) * 1000 : 0;

  const availableCount = a.slots.filter((slot) => slot.is_available).length;

  return (
    <div className="flex flex-col gap-4 xl:flex-row">
      <div className="min-w-0 flex-1 rounded-card border border-hairline bg-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-pitch">Lịch sân trong ngày</p><p className="mt-1 text-xs text-ink-secondary">Bấm các giờ liền nhau trên cùng một sân · tối đa 3 khung</p></div><span className="rounded-pill bg-free-fill px-3 py-1 text-xs font-semibold text-free-ink">{availableCount} khung còn trống</span></div>
        <p className="mb-3 text-xs leading-5 text-ink-secondary">Ô “Giữ chỗ” đang chờ cọc tối đa 15 phút; “Đã đặt” đã được xác nhận. Hết hạn giữ chỗ, khung giờ sẽ mở lại.</p>
        <div className="overflow-x-auto pb-2"><div className="min-w-[720px]">
        <div className="grid gap-1 pb-2" style={{ gridTemplateColumns: cols }}>
          <span className="flex items-end pb-1 text-[11px] font-semibold text-ink-secondary">Sân / giờ</span>
          {a.times.map((t) => (
            <span key={t} className="text-center text-[11px] font-semibold tabular-nums text-ink-secondary">
              {hhmm(t)}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-2">
        {a.courts.map((c) => (
          <div key={c.id} className="grid gap-1 rounded-control border border-hairline bg-page p-1" style={{ gridTemplateColumns: cols }}>
            <span className="flex items-center px-2 text-[13px] font-semibold text-pitch">{c.name}</span>
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
        </div></div>
      </div>

      <aside className="w-full flex-none rounded-card border border-pitch bg-pitch p-5 text-pitch-ink xl:sticky xl:top-5 xl:w-80 xl:self-start">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-pitch-ink/65">Tóm tắt đặt sân</p><h2 className="mt-2 font-display text-xl font-bold">{a.selection ? 'Sẵn sàng chốt kèo?' : 'Chọn giờ bạn muốn chơi'}</h2></div>{a.selection && <span aria-hidden="true" className="pf-check-pop grid size-8 place-items-center rounded-full bg-white/15 text-sm">✓</span>}</div>
        {!a.selection ? (
          <p className="mt-6 text-[13px] leading-relaxed text-pitch-ink/75">
            Bấm vào ô còn trống có hiển thị giá. Bạn có thể chọn tối đa 3 khung liền nhau trên cùng một sân.
          </p>
        ) : (
          <div className="pf-settle mt-6 flex flex-col gap-4">
            <p className="text-sm font-semibold">{dayLabel(new Date(a.selection.startsAt))}</p>
            <div className="rounded-control bg-white/10 p-3"><Row label="Sân" value={a.selection.courtName} /><div className="mt-2"><Row label="Thời gian" value={`${hhmm(a.selection.startsAt)} – ${hhmm(a.selection.endsAt)}`} /></div></div>
            <div className="flex items-baseline justify-between border-b border-white/20 pb-4">
              <span className="text-sm text-pitch-ink/75">Tổng tiền sân</span>
              <span className="font-display text-2xl font-bold">{vnd(a.selection.total)}</span>
            </div>
            <div className="flex flex-col gap-2 text-sm"><Row label={`Cọc trước ${depositPct}%`} value={vnd(deposit)} /><Row label="Trả tại sân" value={vnd(a.selection.total - deposit)} /></div>
            <button onClick={onConfirm} className="pf-action h-12 rounded-control bg-white text-[15px] font-semibold text-pitch transition-colors hover:bg-free-fill">
              Tiếp tục đặt sân <span aria-hidden="true" className="pf-arrow ml-2">→</span>
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
      <span className="text-pitch-ink/70">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
