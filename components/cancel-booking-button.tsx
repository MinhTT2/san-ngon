'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CANCEL_WINDOW_HOURS } from '@/lib/constants';
import { Modal } from './modal';
import { CircleAlert, LoaderCircle } from 'lucide-react';

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
    if (busy) return;
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

  const close = () => { if (!busy) setArmed(false); };
  return <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => { setError(null); setArmed(true); }}
        className={`pf-action inline-flex min-h-11 items-center text-sm font-medium text-ink-secondary underline underline-offset-4 ${className}`}
      >
        {pending ? 'Hủy giữ chỗ' : 'Hủy đơn'}
      </button>
      {armed && <Modal title={pending ? 'Hủy giữ chỗ?' : 'Hủy đơn đặt sân?'} subtitle={`Mã đơn ${code}`} size="max-w-lg" onClose={close}>
      <div className="flex items-start gap-3 rounded-control border border-hairline bg-page p-4">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-pitch" aria-hidden="true" />
        <p className="text-sm leading-7 text-ink-secondary">
        {pending
          ? 'Hủy giữ chỗ để người khác đặt được khung giờ này. Nếu đã chuyển tiền, hãy chờ xác nhận hoặc liên hệ hỗ trợ.'
          : refundable
          ? 'Hủy bây giờ, cọc được đánh dấu cần hoàn.'
          : `Còn dưới ${CANCEL_WINDOW_HOURS} tiếng — hủy bây giờ là mất cọc.`}
        </p>
      </div>
      {!pending && refundable && <p className="mt-3 text-xs leading-6 text-ink-secondary">Chủ sân sẽ xử lý hoàn cọc thủ công. Tiền chưa được hoàn ngay khi hủy.</p>}
      {error && <p role="alert" className="mt-4 rounded-control border border-danger/25 p-3 text-sm leading-6 text-danger">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2" aria-busy={busy}>
      <button type="button" onClick={close} disabled={busy}
        className="pf-action min-h-11 rounded-control border border-hairline px-4 text-sm font-semibold disabled:opacity-60">Giữ lại đơn</button>
      <button type="button" onClick={cancel} disabled={busy}
        className="pf-action inline-flex min-h-11 items-center gap-2 rounded-control bg-danger px-4 text-sm font-semibold text-white disabled:opacity-60">
        {busy && <LoaderCircle className="pf-spin size-4" aria-hidden="true" />}{busy ? 'Đang hủy…' : 'Xác nhận hủy'}
      </button>
      </div>
      </Modal>}
    </>;
}
