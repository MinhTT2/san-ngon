'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CANCEL_WINDOW_HOURS } from '@/lib/constants';

/**
 * Hủy đơn. Hai nhịp: bấm lần đầu hiện cảnh báo, bấm lần hai mới gọi API —
 * không dùng confirm() của trình duyệt vì nó không nói được điều kiện hoàn cọc.
 */
export function CancelBookingButton({
  code,
  refundable,
  pending = false,
  onCancelled,
  className = '',
}: {
  code: string;
  /** Hủy bây giờ thì còn kịp mốc hoàn cọc không. */
  refundable: boolean;
  pending?: boolean;
  onCancelled?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${code}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pending_only: pending }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'Không hủy được đơn.');
        router.refresh();
        return;
      }
      setArmed(false);
      onCancelled?.();
      router.refresh();
    } catch {
      setError('Mất kết nối. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className={`text-sm font-medium text-ink-secondary underline underline-offset-2 ${className}`}
      >
        {pending ? 'Hủy giữ chỗ' : 'Hủy đơn'}
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-xs leading-snug text-ink-secondary">
        {pending
          ? 'Hủy giữ chỗ để người khác đặt được khung giờ này. Nếu đã chuyển tiền, hãy chờ xác nhận hoặc liên hệ hỗ trợ.'
          : refundable
          ? 'Hủy bây giờ, cọc được đánh dấu cần hoàn.'
          : `Còn dưới ${CANCEL_WINDOW_HOURS} tiếng — hủy bây giờ là mất cọc.`}
      </span>
      <button type="button" onClick={cancel} disabled={busy}
        className="h-9 rounded-control bg-danger px-3.5 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? 'Đang hủy…' : 'Hủy thật'}
      </button>
      <button type="button" onClick={() => setArmed(false)} disabled={busy}
        className="h-9 rounded-control border border-hairline px-3.5 text-sm font-medium">
        Thôi
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
