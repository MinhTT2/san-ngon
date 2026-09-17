import { BOOKING_STATUS_LABELS } from '@/lib/constants';
import { countdown } from '@/lib/format';
import type { BookingStatus } from '@/lib/types';

const TONE: Record<BookingStatus, string> = {
  pending: 'bg-peak-fill text-peak-ink',
  confirmed: 'bg-free-fill text-success',
  completed: 'bg-sunk text-ink-secondary',
  cancelled: 'bg-sunk text-ink-secondary',
  no_show: 'bg-sunk text-danger',
};

/** Đơn chờ thanh toán là trạng thái duy nhất có thêm số: đồng hồ giữ chỗ. */
export function StatusBadge({ status, secondsLeft }: { status: BookingStatus; secondsLeft?: number }) {
  const label =
    status === 'pending' && secondsLeft !== undefined
      ? `${BOOKING_STATUS_LABELS[status]} · ${countdown(secondsLeft)}`
      : BOOKING_STATUS_LABELS[status];

  return (
    <span className={`rounded-pill px-2.5 py-1 text-xs font-medium tabular-nums ${TONE[status]}`}>
      {label}
    </span>
  );
}
