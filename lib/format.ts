import { TZ } from './constants';

/** 350000 → "350.000đ" */
export function vnd(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
}

/** 350000 → "350k" — dùng trong ô lưới lịch, chỗ chỉ rộng ~47px */
export function vndShort(amount: number) {
  return Math.round(amount / 1000) + 'k';
}

/** ISO UTC → "18:00" theo giờ Việt Nam */
export function hhmm(iso: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ,
  }).format(new Date(iso));
}

/** Giờ dạng số, để biết có phải giờ vàng không */
export function hourOf(iso: string) {
  return Number(hhmm(iso).slice(0, 2));
}

/** Date → "2026-09-18" theo giờ Việt Nam. Tham số cho RPC. */
export function ymd(d: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ,
  }).format(d);
}

/** "Thứ năm, 18/09" */
export function dayLabel(d: Date) {
  const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', timeZone: TZ }).format(d);
  const dm = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', timeZone: TZ }).format(d);
  return `${weekday}, ${dm}`;
}

/** Số giây còn lại → "11:04" */
export function countdown(seconds: number) {
  const s = Math.max(0, seconds);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss < 10 ? '0' : ''}${ss}`;
}
