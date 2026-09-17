'use client';

import { useState } from 'react';
import { SlotPickerMobile } from '@/components/slot-picker-mobile';
import { SlotPickerDesktop } from '@/components/slot-picker-desktop';
import { BookingForm } from '@/components/booking-form';
import { dayLabel, ymd } from '@/lib/format';
import type { Selection } from '@/lib/types';

/**
 * Hai bố cục lưới, một nguồn dữ liệu. Không phải một component co giãn —
 * điện thoại xếp giờ theo hàng dọc, desktop xếp sân theo hàng ngang.
 */
export function VenueSchedule({
  venueId,
  depositPct,
  horizonDays,
  defaultName,
  defaultPhone,
}: {
  venueId: string;
  depositPct: number;
  horizonDays: number;
  defaultName?: string | null;
  defaultPhone?: string | null;
}) {
  const [date, setDate] = useState(() => new Date());
  const [selection, setSelection] = useState<Selection | null>(null);
  const [confirming, setConfirming] = useState(false);

  const days = Array.from({ length: Math.min(horizonDays, 14) }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  if (confirming && selection) {
    return (
      <div className="mx-auto max-w-md">
        <BookingForm
          selection={selection}
          depositPct={depositPct}
          defaultName={defaultName}
          defaultPhone={defaultPhone}
          onCancel={() => setConfirming(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => {
          const active = ymd(d) === ymd(date);
          return (
            <button
              key={ymd(d)}
              onClick={() => setDate(d)}
              aria-pressed={active}
              className={`flex h-15 w-14 flex-none flex-col items-center justify-center gap-0.5 rounded-control border ${
                active ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline bg-card'
              }`}
            >
              <span className="text-[11px] opacity-80">{dayLabel(d).split(',')[0].slice(0, 6)}</span>
              <span className="text-base font-semibold tabular-nums">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="md:hidden">
        <SlotPickerMobile
          venueId={venueId} date={date} depositPct={depositPct}
          onSelectionChange={setSelection} onConfirm={() => setConfirming(true)}
        />
      </div>
      <div className="hidden md:block">
        <SlotPickerDesktop
          venueId={venueId} date={date} depositPct={depositPct}
          onSelectionChange={setSelection} onConfirm={() => setConfirming(true)}
        />
      </div>
    </div>
  );
}
