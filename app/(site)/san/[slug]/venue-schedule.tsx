'use client';

import { useEffect, useState } from 'react';
import { SlotPickerMobile } from '@/components/slot-picker-mobile';
import { SlotPickerDesktop } from '@/components/slot-picker-desktop';
import { BookingForm } from '@/components/booking-form';
import { dayShort, ymd } from '@/lib/format';
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
  isAuthenticated,
  initialDate,
}: {
  venueId: string;
  depositPct: number;
  horizonDays: number;
  defaultName?: string | null;
  defaultPhone?: string | null;
  isAuthenticated: boolean;
  /** 'YYYY-MM-DD' mang sang từ ô ngày ở trang chủ. */
  initialDate?: string;
}) {
  const [date, setDate] = useState(() => parseDayParam(initialDate, horizonDays));
  const [selection, setSelection] = useState<Selection | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [draftContact, setDraftContact] = useState<{ name?: string; phone?: string; note?: string } | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('san-ngon:booking-draft');
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        selection?: Selection; name?: string; phone?: string; note?: string; savedAt?: number;
      };
      sessionStorage.removeItem('san-ngon:booking-draft');
      if (!draft.selection || !draft.savedAt || Date.now() - draft.savedAt > 15 * 60_000) return;
      setDraftContact({ name: draft.name, phone: draft.phone, note: draft.note });
      setSelection(draft.selection);
      setConfirming(true);
    } catch {
      sessionStorage.removeItem('san-ngon:booking-draft');
    }
  }, []);

  const days = Array.from({ length: Math.min(horizonDays, 14) }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  // Ngày mang sang có thể nằm ngoài dải nút bấm (ví dụ tuần sau) — chèn vào
  // đầu dải để nó vẫn bấm lại được sau khi người dùng đổi sang ngày khác.
  const extraDay = days.some((d) => ymd(d) === ymd(date)) ? null : date;

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
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(extraDay ? [extraDay, ...days] : days).map((d) => {
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
              <span className="text-[11px] opacity-80">{dayShort(d)}</span>
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

/**
 * 'YYYY-MM-DD' → Date. Neo vào giữa trưa giờ Hà Nội để chênh lệch múi giờ của
 * trình duyệt không kéo ngày lùi lại một hôm; mọi tính toán ngày giờ thật vẫn
 * nằm trong SQL. Ngày quá khứ hoặc ngoài chân trời đặt trước thì rơi về hôm nay.
 */
function parseDayParam(raw: string | undefined, horizonDays: number): Date {
  const today = new Date();
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return today;

  const picked = new Date(`${raw}T12:00:00+07:00`);
  if (Number.isNaN(picked.getTime())) return today;

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + horizonDays);
  if (ymd(picked) < ymd(today) || ymd(picked) > ymd(horizon)) return today;

  return picked;
}
