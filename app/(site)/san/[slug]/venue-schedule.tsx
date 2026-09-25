'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SlotPickerMobile } from '@/components/slot-picker-mobile';
import { SlotPickerDesktop } from '@/components/slot-picker-desktop';
import { BookingForm } from '@/components/booking-form';
import { useAvailability } from '@/lib/use-availability';
import type { Selection, VenueCalendar } from '@/lib/types';

/**
 * Hai bố cục lưới, một nguồn dữ liệu. Không phải một component co giãn —
 * điện thoại xếp giờ theo hàng dọc, desktop xếp sân theo hàng ngang.
 */
export function VenueSchedule({
  venueId,
  depositPct,
  calendar,
  defaultName,
  defaultPhone,
  isAuthenticated,
}: {
  venueId: string;
  depositPct: number;
  calendar: VenueCalendar;
  defaultName?: string | null;
  defaultPhone?: string | null;
  isAuthenticated: boolean;
}) {
  const date = calendar.date;
  const pathname = usePathname();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [confirming, setConfirming] = useState(false);
  const availability = useAvailability(venueId, date, !confirming);
  const confirm = () => {
    setSelection(availability.selection);
    setConfirming(true);
  };
  const [draftContact, setDraftContact] = useState<{ name?: string; phone?: string; note?: string } | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('san-ngon:booking-draft');
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        selection?: Selection; name?: string; phone?: string; note?: string; pathname?: string; savedAt?: number;
      };
      if (draft.pathname !== pathname) return;
      sessionStorage.removeItem('san-ngon:booking-draft');
      if (!draft.selection || !draft.savedAt || Date.now() - draft.savedAt > 15 * 60_000) return;
      setDraftContact({ name: draft.name, phone: draft.phone, note: draft.note });
      setSelection(draft.selection);
      setConfirming(true);
    } catch {
      sessionStorage.removeItem('san-ngon:booking-draft');
    }
  }, [pathname]);

  if (confirming && selection) {
    return (
      <div className="mx-auto max-w-md">
        <BookingForm
          selection={selection}
          depositPct={depositPct}
          defaultName={draftContact?.name ?? defaultName}
          defaultPhone={draftContact?.phone ?? defaultPhone}
          defaultNote={draftContact?.note}
          isAuthenticated={isAuthenticated}
          onCancel={() => setConfirming(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card border border-hairline bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-secondary">Bước 1 · Chọn ngày</p><h2 className="mt-2 font-display text-xl font-bold text-pitch">Bạn muốn chơi ngày nào?</h2></div><p className="text-xs text-ink-secondary">Giữ chỗ 15 phút để chuyển cọc</p></div>
        <form className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Ngày chơi
            <input key={date} name="ngay" type="date" required min={calendar.today} max={calendar.last_date} defaultValue={date}
              className="h-12 rounded-control border border-hairline bg-page px-3 text-sm" />
          </label>
          <button className="h-12 rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink">Xem lịch ngày này</button>
          <p className="text-xs leading-6 text-ink-secondary">Nhận đặt đến {calendar.last_date.split('-').reverse().join('/')} · Giờ Việt Nam</p>
        </form>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {calendar.days.map((day) => (
            <Link key={day.date} href={`?ngay=${day.date}`} scroll={false} aria-current={day.date === date ? 'date' : undefined}
              className={`flex h-[4.25rem] w-[4.25rem] flex-none flex-col items-center justify-center gap-0.5 rounded-control border ${day.date === date ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline bg-page hover:border-pitch'}`}>
              <span className="text-[11px] font-semibold uppercase opacity-75">{day.date === calendar.today ? 'Hôm nay' : ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][day.weekday - 1]}</span>
              <span className="text-lg font-semibold tabular-nums">{day.date.slice(8, 10)}</span>
              <span className="text-[10px] opacity-70">Tháng {Number(day.date.slice(5, 7))}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="md:hidden">
        <SlotPickerMobile
          availability={availability} depositPct={depositPct} onConfirm={confirm}
        />
      </div>
      <div className="hidden md:block">
        <SlotPickerDesktop
          availability={availability} depositPct={depositPct} onConfirm={confirm}
        />
      </div>
    </div>
  );
}
