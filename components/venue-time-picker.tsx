'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_SLOTS, PEAK_FROM_HOUR, PEAK_TO_HOUR, SPORT_LABELS } from '@/lib/constants';
import { dayLabel, hhmm, hourOf, vnd } from '@/lib/format';
import type { useAvailability } from '@/lib/use-availability';
import { venueTimeOptions } from '@/lib/venue-time-options';
import type { Court, Sport } from '@/lib/types';

export function VenueTimePicker({
  availability: a,
  courts = [],
  depositPct,
  onConfirm,
}: {
  availability: ReturnType<typeof useAvailability>;
  courts?: Pick<Court, 'id' | 'surface' | 'is_indoor'>[];
  depositPct: number;
  onConfirm: () => void;
}) {
  const [chosenSport, setChosenSport] = useState<Sport | null>(a.selection?.slots[0].sport ?? null);
  const [chosenDuration, setChosenDuration] = useState<number | null>(a.selection?.slots.reduce((sum, slot) => sum + slot.slot_minutes, 0) ?? null);
  const sports = [...new Set(a.slots.map((slot) => slot.sport))];
  const sport = chosenSport && sports.includes(chosenSport) ? chosenSport : sports[0];
  const sportSlots = useMemo(() => a.slots.filter((slot) => slot.sport === sport), [a.slots, sport]);
  const durations = [...new Set(sportSlots.flatMap((slot) =>
    Array.from({ length: MAX_SLOTS }, (_, i) => slot.slot_minutes * (i + 1))))].sort((a, b) => a - b);
  const duration = chosenDuration && durations.includes(chosenDuration) ? chosenDuration : durations[0];
  const times = useMemo(() => venueTimeOptions(sportSlots, duration), [sportSlots, duration]);
  const availableTimes = times.filter((time) => time.choices.length).length;
  const selection = a.selection;
  const courtById = new Map(courts.map((court) => [court.id, court]));
  const describeCourt = (id: string) => {
    const court = courtById.get(id);
    if (!court) return 'Chưa cập nhật đặc điểm sân';
    return `${court.is_indoor ? 'Trong nhà' : 'Ngoài trời'} · ${court.surface?.trim() || 'Chưa cập nhật mặt sân'}`;
  };
  const choices = times.find((time) => time.startsAt === selection?.startsAt)?.choices ?? [];
  const deposit = selection ? Math.min(selection.total, Math.ceil(selection.total * depositPct / 100 / 1000) * 1000) : 0;
  const summaryRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (selection?.startsAt && window.matchMedia('(max-width: 1023px)').matches) {
      summaryRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [selection?.startsAt]);

  if (a.loading) return <div className="h-96 animate-pulse rounded-card border border-hairline bg-sunk" aria-label="Đang tải giờ trống" aria-busy="true" />;
  if (a.failed) return (
    <div role="alert" className="rounded-card border border-hairline p-6 text-center text-sm text-ink-secondary">
      Không tải được lịch sân. <button onClick={a.reload} className="min-h-11 font-semibold text-pitch underline">Tải lại</button>
    </div>
  );
  if (!times.length) return <p className="rounded-card border border-hairline p-8 text-center text-sm text-ink-secondary">Sân chưa mở lịch cho ngày này. Bạn thử chọn ngày khác nhé.</p>;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section aria-label="Giờ chơi của cụm sân" className="min-w-0 rounded-card border border-hairline bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-pitch">Giờ nào còn sân?</h2>
            <p className="mt-1 text-sm leading-6 text-ink-secondary">Chọn giờ bạn muốn chơi, chúng mình tìm sân phù hợp.</p>
          </div>
          <span className={`rounded-pill px-3 py-1 text-xs font-semibold ${availableTimes ? 'bg-free-fill text-free-ink' : 'bg-sunk text-ink-secondary'}`}>
            {availableTimes ? `${availableTimes} giờ bắt đầu còn sân` : 'Hết giờ trống'}
          </span>
        </div>

        <div className="my-5 grid gap-4 border-y border-hairline py-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-pitch">
            <label htmlFor="booking-sport">Môn thể thao</label>
            <select id="booking-sport" value={sport} onChange={(e) => {
              setChosenSport(e.target.value as Sport);
              setChosenDuration(null);
              a.choose(null);
            }} className="h-12 w-full rounded-control border border-hairline bg-page px-3 text-sm">
              {sports.map((value) => <option key={value} value={value}>{SPORT_LABELS[value] ?? value}</option>)}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-pitch">
            <label htmlFor="booking-duration">Chơi bao lâu?</label>
            <select id="booking-duration" value={duration} onChange={(e) => {
              setChosenDuration(Number(e.target.value));
              a.choose(null);
            }} className="h-12 w-full rounded-control border border-hairline bg-page px-3 text-sm">
              {durations.map((value) => <option key={value} value={value}>{value} phút</option>)}
            </select>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-secondary">
          <h3 className="font-semibold text-pitch">Giờ bắt đầu · {duration} phút chơi</h3>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm border border-peak-line bg-peak-fill" />Giờ vàng</span>
        </div>
        {a.selectionLost && <p role="status" className="mb-3 text-sm text-ink-secondary">Sân vừa chọn không còn trống đủ thời gian. Bạn chọn lại một giờ còn sân nhé.</p>}
        {!availableTimes && <p role="status" className="mb-4 rounded-control bg-sunk p-3 text-sm leading-6 text-ink-secondary">Không còn sân trống đủ {duration} phút cho môn này. Bạn thử thời lượng ngắn hơn hoặc ngày khác nhé.</p>}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
          {times.map(({ startsAt, choices }) => {
            const best = choices[0];
            const selected = selection?.startsAt === startsAt;
            const isPeak = hourOf(startsAt) >= PEAK_FROM_HOUR && hourOf(startsAt) < PEAK_TO_HOUR;
            const tone = !best ? 'border-hairline bg-taken-fill text-taken-ink'
              : selected ? 'border-pitch bg-pitch text-pitch-ink'
              : isPeak ? 'border-peak-line bg-peak-fill text-peak-ink hover:border-peak-ink'
              : 'border-free-line bg-free-fill text-free-ink hover:border-pitch';
            return (
              <button key={startsAt} type="button" disabled={!best} aria-pressed={selected}
                aria-label={`${hhmm(startsAt)}, ${best ? `còn sân, từ ${vnd(best.total)} cho ${duration} phút` : `không còn sân cho ${duration} phút`}`}
                onClick={() => a.choose(best)}
                className={`pf-slot relative flex min-h-24 flex-col items-start justify-center gap-1 rounded-control border px-2 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch sm:px-3 ${tone}`}>
                <span className="text-base font-semibold tabular-nums">{hhmm(startsAt)}</span>
                <span className="text-xs">{best ? 'Còn sân' : 'Không còn sân'}</span>
                {best && <span className="text-[11px] font-semibold sm:text-xs">Từ {vnd(best.total)}</span>}
                {selected && <span aria-hidden="true" className="absolute right-3 top-3">✓</span>}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-xs leading-5 text-ink-secondary">Giá cho toàn bộ {duration} phút. Chỉ gợi ý sân trống liền mạch suốt thời gian chơi.</p>
      </section>

      <aside ref={summaryRef} aria-label="Tóm tắt đặt sân" className="min-w-0 rounded-card border border-pitch bg-pitch p-5 text-pitch-ink lg:sticky lg:top-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pitch-ink/65">Buổi chơi của bạn</p>
        <h2 className="mt-2 font-display text-xl font-bold">{selection ? `${hhmm(selection.startsAt)} – ${hhmm(selection.endsAt)}` : 'Chỉ cần chọn giờ phù hợp'}</h2>
        {!selection ? (
          <p className="mt-4 text-sm leading-6 text-pitch-ink/75">Mỗi giờ hiển thị tình trạng của cả cụm. Chọn một giờ còn sân để xem sân được gợi ý và tổng tiền.</p>
        ) : (
          <div className="pf-settle mt-3 flex flex-col gap-4">
            <p className="text-sm text-pitch-ink/75">{dayLabel(new Date(selection.startsAt))} · {SPORT_LABELS[sport] ?? sport}</p>
            <div className="flex min-w-0 flex-col gap-2 text-sm font-semibold">
              <label htmlFor="booking-court">Sân của bạn</label>
              <select id="booking-court" value={selection.courtId} onChange={(e) => a.choose(choices.find((choice) => choice.courtId === e.target.value) ?? null)}
                className="h-12 w-full min-w-0 rounded-control border border-white/30 bg-pitch px-3 text-sm text-pitch-ink">
                {choices.map((choice) => <option key={choice.courtId} value={choice.courtId}>{choice.courtName} · {describeCourt(choice.courtId)} · {vnd(choice.total)}</option>)}
              </select>
            </div>
            <div aria-live="polite" className="rounded-control border border-white/20 bg-white/10 p-3">
              <p className="break-words text-sm font-semibold">{selection.courtName}</p>
              <p className="mt-1 text-sm leading-6 text-pitch-ink/80">{describeCourt(selection.courtId)}</p>
            </div>
            <p className="-mt-2 text-xs leading-5 text-pitch-ink/75">Gợi ý theo giá thấp nhất. Bạn có thể đổi sang sân khác còn trống.</p>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-y border-white/20 py-4">
              <span className="text-sm text-pitch-ink/75">Tổng {duration} phút</span>
              <span key={`${selection.courtId}-${selection.startsAt}`} className="pf-settle font-display text-2xl font-bold">{vnd(selection.total)}</span>
            </div>
            <div className="flex justify-between gap-2 text-sm"><span className="text-pitch-ink/75">Cọc trước {depositPct}%</span><span className="font-semibold">{vnd(deposit)}</span></div>
            <button onClick={onConfirm} className="pf-action inline-flex min-h-11 items-center justify-center self-start rounded-control bg-white px-4 text-sm font-semibold text-pitch hover:bg-free-fill">
              Tiếp tục đặt sân <span aria-hidden="true" className="pf-arrow ml-2">→</span>
            </button>
            <p className="text-xs leading-5 text-pitch-ink/65">Chưa giữ chỗ ở bước này. Bạn sẽ kiểm tra thông tin trước khi đặt cọc.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
