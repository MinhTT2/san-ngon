import Link from 'next/link';
import { hhmm, hourOf, vndShort, dayLabel } from '@/lib/format';
import { PEAK_FROM_HOUR, PEAK_TO_HOUR } from '@/lib/constants';
import type { Slot } from '@/lib/types';

/**
 * Lát cắt lịch thật, đặt chồng lên minh họa hero.
 *
 * Trước đây khối này là dữ liệu tĩnh trong khi ngay cạnh nó viết "cập nhật
 * theo thời gian thực" — câu quảng cáo không khớp thứ người ta đang nhìn.
 * Giờ nó đọc get_venue_availability của một cụm sân thật. Chưa seed database
 * thì trang chủ rơi về bản tĩnh (HeroGridPlaceholder) chứ không hiện lưới rỗng.
 */
export function HeroGrid({
  venueName,
  venueSlug,
  date,
  slots,
  tomorrow,
}: {
  venueName: string;
  venueSlug: string;
  date: Date;
  slots: Slot[];
  /** Hôm nay hết giờ rồi nên đang hiện lịch ngày mai. */
  tomorrow?: boolean;
}) {
  const times = [...new Set(slots.map((s) => s.starts_at))].sort();
  const courts = [...new Map(slots.map((s) => [s.court_id, s.court_name])).entries()];
  const byKey = new Map(slots.map((s) => [`${s.court_id}|${s.starts_at}`, s]));

  return (
    <Link
      href={`/san/${venueSlug}`}
      aria-label={`Xem lịch đầy đủ của ${venueName}`}
      className="absolute inset-x-4 bottom-4 flex flex-col gap-2.5 rounded-card bg-card p-4 lg:inset-x-6 lg:bottom-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-semibold">
          {venueName} · {tomorrow ? 'mai' : 'hôm nay'} {dayLabel(date).split(', ')[1]}
        </span>
        <span className="hidden flex-none text-xs text-ink-secondary sm:inline">
          cập nhật theo thời gian thực
        </span>
      </div>

      <Row cols={times.length}>
        <span />
        {times.map((t) => (
          <span key={t} className="text-center text-[11px] tabular-nums text-ink-secondary">
            {hhmm(t).slice(0, 2)}
          </span>
        ))}
      </Row>

      {courts.map(([id, name]) => (
        <Row key={id} cols={times.length}>
          <span className="truncate text-xs font-semibold text-pitch">{name}</span>
          {times.map((t) => {
            const slot = byKey.get(`${id}|${t}`);
            if (!slot) return <span key={t} />;
            const hour = hourOf(slot.starts_at);
            const peak = hour >= PEAK_FROM_HOUR && hour < PEAK_TO_HOUR;
            const tone = !slot.is_available
              ? 'bg-sunk text-taken-ink'
              : peak
                ? 'bg-peak-fill text-peak-ink'
                : 'bg-free-fill text-free-ink';
            return (
              <span
                key={t}
                className={`flex h-8 items-center justify-center rounded-slot text-[11px] font-semibold tabular-nums ${tone}`}
              >
                {slot.is_available ? vndShort(slot.price) : '—'}
              </span>
            );
          })}
        </Row>
      ))}
    </Link>
  );
}

/** Bản tĩnh, chỉ dùng khi chưa có cụm sân nào trong database. */
export function HeroGridPlaceholder() {
  const hours = ['17', '18', '19', '20', '21', '22'];
  const rows = [
    { name: 'Sân 1', cells: ['peak', 'taken', 'taken', 'peak', 'free', 'free'] },
    { name: 'Sân 2', cells: ['taken', 'picked', 'picked', 'peak', 'free', 'free'] },
  ] as const;

  const price: Record<string, string> = { peak: '350k', free: '250k', picked: '350k', taken: '—' };
  const tone: Record<string, string> = {
    peak: 'bg-peak-fill text-peak-ink',
    free: 'bg-free-fill text-free-ink',
    picked: 'bg-pitch text-pitch-ink',
    taken: 'bg-sunk text-taken-ink',
  };

  return (
    <div className="absolute inset-x-4 bottom-4 flex flex-col gap-2.5 rounded-card bg-card p-4 lg:inset-x-6 lg:bottom-6">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">Sân Mỹ Đình · thứ năm 18/09</span>
        <span className="hidden text-xs text-ink-secondary sm:inline">ví dụ minh họa</span>
      </div>

      <Row cols={hours.length}>
        <span />
        {hours.map((h) => (
          <span key={h} className="text-center text-[11px] tabular-nums text-ink-secondary">{h}</span>
        ))}
      </Row>

      {rows.map((r) => (
        <Row key={r.name} cols={hours.length}>
          <span className="flex items-center text-xs font-semibold text-pitch">{r.name}</span>
          {r.cells.map((c, i) => (
            <span key={i} className={`flex h-8 items-center justify-center rounded-slot text-[11px] font-semibold tabular-nums ${tone[c]}`}>
              {price[c]}
            </span>
          ))}
        </Row>
      ))}
    </div>
  );
}

function Row({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <div
      className="grid items-center gap-1"
      style={{ gridTemplateColumns: `52px repeat(${cols}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}
