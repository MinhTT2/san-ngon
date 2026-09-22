'use client';

import { useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { vnd } from '@/lib/format';
import {
  DAY_FULL, DAY_LABELS, WEEKDAYS,
  hhmm, presetRules, ruleAt, toMinutes, validateDrafts,
  type PriceRule, type PriceRuleDraft,
} from '@/lib/price-rules';

/**
 * Bảng giá theo khung giờ của một sân con.
 *
 * 'Giá chung' là nền phủ toàn bộ giờ mở cửa và sửa ở phần thông tin sân; ở đây
 * chỉ thêm các khung đè lên nó. Dải xem trước bên dưới tính lại bằng đúng luật
 * của get_venue_availability(), nên cái chủ sân thấy là cái khách sẽ trả.
 */
export function PriceRulesEditor({
  courtId, courtName, basePrice, openTime, closeTime, initialRules, onClose,
}: {
  courtId: string;
  courtName: string;
  /** Giá của dòng 'Giá chung', chỉ dùng để gợi ý số khi thêm khung mới. */
  basePrice: number;
  openTime: string;
  closeTime: string;
  initialRules: PriceRule[];
  onClose: () => void;
}) {
  const router = useRouter();
  const uid = useId();
  const [drafts, setDrafts] = useState<PriceRuleDraft[]>(() =>
    initialRules
      .filter((r) => (r.priority ?? 0) > 0)
      .map((r) => ({
        label: r.label ?? '',
        days: [...r.days].sort(),
        start_time: hhmm(r.start_time),
        end_time: hhmm(r.end_time),
        price_per_hour: r.price_per_hour,
      })));
  const [day, setDay] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const problems = useMemo(() => validateDrafts(drafts, openTime, closeTime), [drafts, openTime, closeTime]);

  // Nền là các dòng priority 0 đang có trong CSDL; bảng giá này chỉ thêm khung
  // đè lên chúng. Trộn cả hai rồi giải đúng luật của get_venue_availability().
  const baseRules = useMemo(
    () => initialRules.filter((r) => (r.priority ?? 0) === 0),
    [initialRules]);

  const preview = useMemo(() => {
    const rules: PriceRule[] = [...baseRules, ...drafts.map((d) => ({ ...d, priority: 10 }))];
    const from = Math.floor(toMinutes(openTime) / 60);
    const to = Math.ceil(toMinutes(closeTime) / 60);
    return Array.from({ length: Math.max(0, to - from) }, (_, i) => {
      const hour = from + i;
      const hit = ruleAt(rules, day, hour * 60);
      return {
        hour,
        price: hit?.price_per_hour ?? 0,
        label: hit?.label ?? null,
        special: (hit?.priority ?? 0) > 0,
      };
    });
  }, [baseRules, drafts, openTime, closeTime, day]);

  // Giờ nào không khung nào phủ thì get_venue_availability() trả 0đ — khách đặt
  // được mà không mất tiền. Phải kêu to, đây là lỗ tiền chứ không phải lỗi nhập.
  const freeHours = useMemo(() => preview.filter((s) => s.price === 0), [preview]);

  function patch(index: number, next: Partial<PriceRuleDraft>) {
    setSaved(false);
    setDrafts((rows) => rows.map((r, i) => (i === index ? { ...r, ...next } : r)));
  }

  function toggleDay(index: number, d: number) {
    const row = drafts[index];
    patch(index, { days: row.days.includes(d) ? row.days.filter((x) => x !== d) : [...row.days, d].sort() });
  }

  function add(rows: PriceRuleDraft[]) {
    setSaved(false);
    setDrafts((current) => [...current, ...rows].slice(0, 12));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/courts/${courtId}/price-rules`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rules: drafts.map((d) => ({ ...d, label: d.label.trim(), price_per_hour: Number(d.price_per_hour) })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? 'Không lưu được bảng giá.'); return; }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Không kết nối được. Thử lại sau vài giây.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="my-4 rounded-control border border-hairline bg-sunk p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-pitch">Bảng giá — {courtName}</h4>
          <p className="mt-1 text-sm leading-relaxed text-ink-secondary">
            Giờ mở cửa {hhmm(openTime)}–{hhmm(closeTime)}. Thêm khung bên dưới để thu khác đi
            vào giờ đông; giờ nào không có khung nào phủ thì lấy giá chung đang có.
          </p>
        </div>
        <button type="button" onClick={onClose}
          className="inline-flex min-h-12 flex-none items-center rounded-control border border-hairline bg-card px-4 text-sm font-semibold">
          Đóng
        </button>
      </div>

      {drafts.length === 0 ? (
        <div className="mt-5 rounded-control border border-dashed border-strong bg-card p-6 text-center">
          <p className="text-sm leading-relaxed text-ink-secondary">
            Sân này đang thu một giá cho mọi khung giờ. Phần lớn sân ở Hà Nội thu cao hơn 16h–21h.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => add(presetRules(basePrice, openTime, closeTime))}
              className="inline-flex min-h-12 items-center rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink">
              Tách giờ vàng giúp tôi
            </button>
            <button type="button" onClick={() => add([blank(openTime, closeTime, basePrice)])}
              className="inline-flex min-h-12 items-center rounded-control border border-hairline bg-card px-4 text-sm font-semibold">
              Tự thêm khung
            </button>
          </div>
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {drafts.map((d, i) => (
            <li key={i} className="rounded-control border border-hairline bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_auto_auto_minmax(0,1fr)_auto] sm:items-end">
                <Field label="Tên khung" htmlFor={`${uid}-label-${i}`}>
                  <input id={`${uid}-label-${i}`} value={d.label} maxLength={60}
                    onChange={(e) => patch(i, { label: e.target.value })}
                    placeholder="Giờ vàng" className={INPUT} />
                </Field>
                <Field label="Từ" htmlFor={`${uid}-from-${i}`}>
                  <input id={`${uid}-from-${i}`} type="time" value={d.start_time}
                    onChange={(e) => patch(i, { start_time: e.target.value })} className={INPUT} />
                </Field>
                <Field label="Đến" htmlFor={`${uid}-to-${i}`}>
                  <input id={`${uid}-to-${i}`} type="time" value={d.end_time}
                    onChange={(e) => patch(i, { end_time: e.target.value })} className={INPUT} />
                </Field>
                <Field label="Giá / giờ" htmlFor={`${uid}-price-${i}`}>
                  <input id={`${uid}-price-${i}`} type="number" min={1000} step={1000} value={d.price_per_hour}
                    onChange={(e) => patch(i, { price_per_hour: Number(e.target.value) })} className={INPUT} />
                </Field>
                <button type="button" onClick={() => { setSaved(false); setDrafts((rows) => rows.filter((_, x) => x !== i)); }}
                  aria-label={`Xoá khung ${i + 1}`}
                  className="inline-flex min-h-12 items-center justify-center rounded-control border border-hairline px-3 text-danger">
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>

              <fieldset className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
                <legend className="sr-only">Ngày áp dụng cho khung {i + 1}</legend>
                <span className="text-xs font-semibold text-ink-secondary">Áp dụng</span>
                {DAY_LABELS.map((label, dayIndex) => {
                  const on = d.days.includes(dayIndex);
                  return (
                    <button key={dayIndex} type="button" onClick={() => toggleDay(i, dayIndex)}
                      aria-pressed={on} title={DAY_FULL[dayIndex]}
                      className={`h-8 w-10 rounded-control border text-xs font-semibold transition-colors ${
                        on ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline hover:border-strong'
                      }`}>
                      {label}
                    </button>
                  );
                })}
              </fieldset>
            </li>
          ))}
        </ul>
      )}

      {drafts.length > 0 && drafts.length < 12 && (
        <button type="button" onClick={() => add([blank(openTime, closeTime, basePrice)])}
          className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-control border border-hairline bg-card px-4 text-sm font-semibold">
          <Plus className="size-4" aria-hidden="true" /> Thêm khung
        </button>
      )}

      <div className="mt-6 border-t border-hairline pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h5 className="text-sm font-semibold">Khách sẽ thấy giá này</h5>
          <div className="flex flex-wrap gap-1">
            {DAY_LABELS.map((label, dayIndex) => (
              <button key={dayIndex} type="button" onClick={() => setDay(dayIndex)}
                aria-pressed={day === dayIndex} title={DAY_FULL[dayIndex]}
                className={`h-8 w-10 rounded-control border text-xs font-semibold transition-colors ${
                  day === dayIndex ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline bg-card hover:border-strong'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <ul className="mt-3 flex flex-wrap gap-1.5">
          {preview.map((slot) => (
            <li key={slot.hour}
              title={slot.price === 0
                ? 'Không khung giá nào phủ giờ này — khách đặt sẽ không mất tiền'
                : `${slot.label} · ${vnd(slot.price)}/giờ`}
              className={`flex min-w-16 flex-col items-center rounded-slot border px-2 py-1.5 text-center ${
                slot.price === 0 ? 'border-danger/40 bg-danger/5 text-danger'
                  : slot.special ? 'border-peak-line bg-peak-fill text-peak-ink'
                  : 'border-hairline bg-card text-ink-secondary'
              }`}>
              <span className="text-xs tabular-nums">{String(slot.hour).padStart(2, '0')}h</span>
              <span className="text-xs font-semibold tabular-nums">
                {slot.price === 0 ? '0đ' : `${Math.round(slot.price / 1000)}k`}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-secondary">
          Ô vàng là khung giá riêng, ô trắng là giá chung. Bấm thứ bên trên để xem ngày khác.
        </p>

        {freeHours.length > 0 && (
          <p role="alert" className="mt-3 rounded-control border border-danger/30 bg-danger/5 p-3.5 text-sm leading-relaxed text-danger">
            <strong className="font-semibold">
              {DAY_FULL[day]} đang có {freeHours.length} giờ không khung giá nào phủ
            </strong>{' '}
            ({freeHours.map((s) => `${String(s.hour).padStart(2, '0')}h`).join(', ')}).
            Khách đặt những giờ đó sẽ không phải trả đồng nào. Thêm khung phủ kín hoặc
            nới giờ của khung đang có.
          </p>
        )}
      </div>

      {problems.length > 0 && (
        <ul role="alert" className="mt-5 flex flex-col gap-1 rounded-control border border-danger/30 bg-danger/5 p-3.5 text-sm leading-relaxed text-danger">
          {problems.map((p) => <li key={p}>· {p}</li>)}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-5 rounded-control border border-danger/30 bg-danger/5 p-3.5 text-sm leading-relaxed text-danger">{error}</p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
        <button type="button" onClick={save} disabled={busy || problems.length > 0}
          className="inline-flex min-h-12 items-center rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink disabled:opacity-50">
          {busy ? 'Đang lưu…' : 'Lưu bảng giá'}
        </button>
        {saved && <span className="text-sm font-medium text-success">Đã lưu. Khách đặt sân sẽ thấy giá mới ngay.</span>}
      </div>
    </section>
  );
}

const INPUT = 'h-12 w-full rounded-control border border-hairline bg-page px-3 text-[15px] focus:border-pitch focus:outline-none';

function blank(open: string, close: string, base: number): PriceRuleDraft {
  return {
    label: '',
    days: WEEKDAYS,
    start_time: hhmm(open),
    end_time: hhmm(close),
    price_per_hour: base,
  };
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-ink-secondary">{label}</label>
      {children}
    </div>
  );
}
