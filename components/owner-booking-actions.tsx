'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';
import { Modal } from '@/components/modal';
import { vnd } from '@/lib/format';

type BookingContext = {
  code: string;
  customerName: string | null;
  customerPhone: string;
  courtName: string;
  depositAmount: number;
};

export function ConfirmPaymentButton(props: BookingContext) {
  return <OwnerAction {...props} endpoint="confirm" />;
}

export function RefundDoneButton(props: BookingContext) {
  return <OwnerAction {...props} endpoint="refund" />;
}

function OwnerAction({ code, customerName, customerPhone, courtName, depositAmount, endpoint }: BookingContext & { endpoint: 'confirm' | 'refund' }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const feedback = useRef<HTMLParagraphElement>(null);
  const action = useRef<HTMLSpanElement>(null);
  const confirming = endpoint === 'confirm';
  const idleLabel = confirming ? 'Đã nhận cọc — xác nhận tay' : 'Đã hoàn — đánh dấu xong';
  const busyLabel = confirming ? 'Đang xác nhận…' : 'Đang cập nhật…';
  const successLabel = confirming ? 'Đã xác nhận nhận cọc' : 'Đã đánh dấu hoàn cọc';

  useEffect(() => { if (error) feedback.current?.focus(); }, [error]);
  useEffect(() => { if (completed) action.current?.focus(); }, [completed]);

  function close() {
    if (submitting.current) return;
    setArmed(false);
    if (needsReview) router.refresh();
  }

  async function submit() {
    if (submitting.current || completed || needsReview) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${code}/${endpoint}`, { method: 'POST' });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? 'Chưa cập nhật được đơn. Vui lòng thử lại.');
        return;
      }
      setCompleted(true);
      setArmed(false);
      router.refresh();
    } catch {
      setNeedsReview(true);
      setError('Mất kết nối, chưa nhận được kết quả. Đơn có thể đã được cập nhật. Đóng cửa sổ và kiểm tra lại danh sách trước khi thử lại.');
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return <>
    <span ref={action} tabIndex={-1} className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
      <button type="button" aria-haspopup="dialog" onClick={() => { setError(null); setNeedsReview(false); setArmed(true); }} disabled={pending || completed}
        className="pf-action inline-flex min-h-11 items-center justify-center rounded-control border border-hairline px-3 py-2 text-left text-sm font-semibold leading-5 text-pitch hover:border-strong disabled:opacity-60">
        {completed ? successLabel : idleLabel}
      </button>
      {completed && <span role="status" className="sr-only">{successLabel} cho đơn {code}.</span>}
    </span>
    {armed && <Modal title={confirming ? 'Xác nhận đã nhận cọc?' : 'Đánh dấu đã hoàn cọc?'} subtitle={`Mã đơn ${code}`} size="max-w-lg" onClose={close}>
      <div data-unsaved-busy={pending} aria-busy={pending}>
        <dl className="space-y-3 rounded-control border border-hairline bg-page p-4 text-sm">
          <div><dt className="text-ink-secondary">Khách đặt sân</dt><dd className="mt-1 break-words font-semibold">{customerName ?? 'Khách đặt sân'} · {customerPhone}</dd></div>
          <div><dt className="text-ink-secondary">Sân</dt><dd className="mt-1 break-words font-semibold">{courtName}</dd></div>
          <div className="border-t border-hairline pt-3"><dt className="text-ink-secondary">{confirming ? 'Số tiền cần đối chiếu' : 'Số tiền cần hoàn'}</dt><dd className="mt-1 font-display text-2xl font-bold tabular-nums text-pitch">{vnd(depositAmount)}</dd></div>
        </dl>
        <p className="mt-4 text-sm leading-7 text-ink-secondary">{confirming
          ? 'Chỉ xác nhận sau khi đã kiểm tra tài khoản ngân hàng, đúng mã đơn và đủ số tiền cọc. Đơn sẽ được chuyển sang đã xác nhận.'
          : 'Chỉ đánh dấu sau khi đã chuyển đủ tiền hoàn cọc cho khách. Thao tác này ghi nhận đã hoàn, không tự chuyển tiền.'}</p>
        {error && <p ref={feedback} tabIndex={-1} role="alert" className="mt-4 rounded-control border border-danger/25 p-3 text-sm leading-6 text-danger">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={close} disabled={pending} className="pf-action min-h-11 rounded-control border border-hairline px-4 py-3 text-sm font-semibold disabled:opacity-60">{needsReview ? 'Đóng và kiểm tra lại' : 'Quay lại'}</button>
          {!needsReview && <button type="button" onClick={submit} disabled={pending} className="pf-action inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-pitch px-4 py-3 text-sm font-semibold text-pitch-ink disabled:opacity-60">
            {pending && <LoaderCircle className="pf-spin size-4 shrink-0" aria-hidden="true" />}{pending ? busyLabel : confirming ? 'Xác nhận đã nhận đủ cọc' : 'Xác nhận đã hoàn đủ cọc'}
          </button>}
        </div>
      </div>
    </Modal>}
  </>;
}
