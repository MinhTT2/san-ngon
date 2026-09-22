/**
 * Bảng giá theo khung giờ.
 *
 * Cách chồng giá ở đây phải khớp đúng get_venue_availability(): trong các khung
 * phủ một giờ, lấy khung có priority cao nhất, cùng priority thì lấy giá cao
 * hơn. Lệch một chút là phần xem trước nói một đằng, khách trả một nẻo.
 */

export type PriceRule = {
  id?: string;
  label: string | null;
  days: number[];
  start_time: string;
  end_time: string;
  price_per_hour: number;
  priority?: number;
};

export type PriceRuleDraft = {
  label: string;
  days: number[];
  start_time: string;
  end_time: string;
  price_per_hour: number;
};

/** 0 = Chủ nhật, khớp extract(dow) của Postgres. */
export const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;
export const DAY_FULL = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'] as const;

export const WEEKDAYS = [1, 2, 3, 4, 5];
export const WEEKEND = [0, 6];

export const BASE_LABEL = 'Giá chung';

export const PRICE_RULE_ERRORS: Record<string, string> = {
  COURT_NOT_FOUND: 'Không tìm thấy sân này, hoặc sân không thuộc về bạn.',
  RULES_INVALID: 'Dữ liệu bảng giá không hợp lệ.',
  TOO_MANY_RULES: 'Tối đa 12 khung giá cho một sân.',
  LABEL_REQUIRED: 'Mỗi khung giá cần một cái tên, ví dụ “Giờ vàng”.',
  DAYS_INVALID: 'Mỗi khung giá phải chọn ít nhất một ngày trong tuần.',
  TIME_INVALID: 'Giờ kết thúc phải sau giờ bắt đầu.',
  OUTSIDE_HOURS: 'Khung giá nằm ngoài giờ mở cửa của sân nên sẽ không bao giờ áp dụng.',
  PRICE_RANGE: 'Giá mỗi giờ phải từ 1.000đ đến 10.000.000đ.',
  RULES_OVERLAP: 'Hai khung giá đang đè lên nhau trong cùng một ngày. Tách giờ ra cho rõ.',
};

export function priceRuleErrorMessage(raw?: string) {
  const key = raw ? Object.keys(PRICE_RULE_ERRORS).find((k) => raw.includes(k)) : undefined;
  return key ? PRICE_RULE_ERRORS[key] : 'Không lưu được bảng giá. Thử lại sau vài giây.';
}

/** "16:00:00" hoặc "16:00" → phút kể từ nửa đêm. */
export function toMinutes(time: string) {
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  return h * 60 + (m || 0);
}

export function hhmm(time: string) {
  return time.slice(0, 5);
}

/**
 * Khung đang áp cho một giờ, theo đúng thứ tự get_venue_availability() dùng:
 * priority cao nhất trước, cùng priority thì giá cao hơn.
 *
 * Không có khung nào phủ giờ đó thì trả undefined — KHÔNG bù bằng một giá mặc
 * định nào cả. SQL coalesce về 0, tức là giờ đó khách đặt không mất tiền; phần
 * xem trước phải nói đúng như vậy thì chủ sân mới thấy mà vá.
 */
export function ruleAt(rules: PriceRule[], day: number, minutes: number) {
  return rules
    .filter((r) => r.days.includes(day)
      && minutes >= toMinutes(r.start_time)
      && minutes < toMinutes(r.end_time))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || b.price_per_hour - a.price_per_hour)[0];
}

/** Giá thật của một giờ. 0 nghĩa là bảng giá đang thủng ở đó. */
export function resolvePrice(rules: PriceRule[], day: number, minutes: number) {
  return ruleAt(rules, day, minutes)?.price_per_hour ?? 0;
}

export function resolveLabel(rules: PriceRule[], day: number, minutes: number) {
  return ruleAt(rules, day, minutes)?.label ?? null;
}

/**
 * Kiểm tại chỗ trước khi gửi lên. Cùng bộ luật với set_court_price_rules(),
 * chỉ khác là ở đây để báo sớm chứ không phải để tin.
 */
export function validateDrafts(drafts: PriceRuleDraft[], open: string, close: string) {
  const errors: string[] = [];
  const o = toMinutes(open);
  const c = toMinutes(close);

  drafts.forEach((d, i) => {
    const at = `Khung ${i + 1}${d.label.trim() ? ` (${d.label.trim()})` : ''}`;
    if (!d.label.trim()) errors.push(`${at}: ${PRICE_RULE_ERRORS.LABEL_REQUIRED}`);
    if (d.days.length === 0) errors.push(`${at}: ${PRICE_RULE_ERRORS.DAYS_INVALID}`);
    if (toMinutes(d.end_time) <= toMinutes(d.start_time)) errors.push(`${at}: ${PRICE_RULE_ERRORS.TIME_INVALID}`);
    else if (toMinutes(d.start_time) < o || toMinutes(d.end_time) > c) {
      errors.push(`${at}: ngoài giờ mở cửa ${hhmm(open)}–${hhmm(close)} nên sẽ không bao giờ áp dụng.`);
    }
    if (!Number.isFinite(d.price_per_hour) || d.price_per_hour < 1000 || d.price_per_hour > 10_000_000) {
      errors.push(`${at}: ${PRICE_RULE_ERRORS.PRICE_RANGE}`);
    }
  });

  for (let i = 0; i < drafts.length; i++) {
    for (let j = i + 1; j < drafts.length; j++) {
      const a = drafts[i];
      const b = drafts[j];
      const sameDay = a.days.some((d) => b.days.includes(d));
      const overlap = toMinutes(a.start_time) < toMinutes(b.end_time)
        && toMinutes(b.start_time) < toMinutes(a.end_time);
      if (sameDay && overlap) {
        errors.push(`Khung ${i + 1} và khung ${j + 1} đè lên nhau trong cùng một ngày. Tách giờ ra cho rõ.`);
      }
    }
  }

  if (drafts.length > 12) errors.push(PRICE_RULE_ERRORS.TOO_MANY_RULES);
  return errors;
}

/** Hai khung hay dùng nhất, bấm một phát ra luôn. */
export function presetRules(base: number, open: string, close: string): PriceRuleDraft[] {
  const peakStart = Math.max(toMinutes(open), 16 * 60);
  const peakEnd = Math.min(toMinutes(close), 21 * 60);
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  if (peakEnd <= peakStart) return [];
  return [
    { label: 'Giờ vàng', days: WEEKDAYS, start_time: fmt(peakStart), end_time: fmt(peakEnd), price_per_hour: Math.round(base * 1.4 / 1000) * 1000 },
    { label: 'Giờ vàng cuối tuần', days: WEEKEND, start_time: fmt(peakStart), end_time: fmt(peakEnd), price_per_hour: Math.round(base * 1.6 / 1000) * 1000 },
  ];
}
