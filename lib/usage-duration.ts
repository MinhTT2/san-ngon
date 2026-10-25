/** Format a measured duration; no date or timezone arithmetic. */
export function usageDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return 'Chưa ghi nhận';
  const total = Math.max(0, Math.floor(seconds));
  if (total < 60) return `${total} giây`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes} phút`;
  return `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
}
