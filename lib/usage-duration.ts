/** Format a measured duration; no date or timezone arithmetic. */
export function usageDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return 'Chưa ghi nhận';
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const total = Math.floor(milliseconds / 1000);
  const remainder = milliseconds % 1000;
  const preciseSeconds = `${total % 60}${remainder ? `,${String(remainder).padStart(3, '0')}` : ''}`;
  if (total < 60) return `${preciseSeconds} giây`;
  const minutes = Math.floor(total / 60);
  const tail = total % 60 || remainder ? ` ${preciseSeconds} giây` : '';
  if (minutes < 60) return `${minutes} phút${tail}`;
  return `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút${tail}`;
}
