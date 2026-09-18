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

/**
 * "Thứ năm, 18/09". Phần ngày/tháng ghép tay từ ymd() thay vì để Intl định
 * dạng: bản ICU rút gọn của Node trả về "18-09", bản đầy đủ trả về "18/09",
 * nên cùng một trang hiện khác nhau giữa máy dev và Vercel.
 */
export function dayLabel(d: Date) {
  const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', timeZone: TZ }).format(d);
  const iso = ymd(d);
  return `${weekday}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/**
 * "T2".."T7", "CN" — nhãn nút chọn ngày.
 * Trước đây chỗ đó cắt cứng dayLabel() còn 6 ký tự, ra "Thứ Sá", "Thứ Bả":
 * tiếng Việt cắt giữa âm tiết thì dấu rơi lại một mình, đọc như lỗi font.
 */
const WEEKDAY_VI: Record<string, string> = {
  Mon: 'T2', Tue: 'T3', Wed: 'T4', Thu: 'T5', Fri: 'T6', Sat: 'T7', Sun: 'CN',
};

export function dayShort(d: Date) {
  const en = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: TZ }).format(d);
  return WEEKDAY_VI[en] ?? en;
}

/** Số giây còn lại → "11:04" */
export function countdown(seconds: number) {
  const s = Math.max(0, seconds);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss < 10 ? '0' : ''}${ss}`;
}
