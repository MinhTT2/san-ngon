'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';

export function ConfirmPaymentButton({ code }: { code: string }) {
  return <OwnerAction code={code} endpoint="confirm" idle="Đã nhận cọc — xác nhận tay" busy="Đang xác nhận…" />;
}

export function RefundDoneButton({ code }: { code: string }) {
  return <OwnerAction code={code} endpoint="refund" idle="Đã hoàn — đánh dấu xong" busy="Đang cập nhật…" />;
}

function OwnerAction({
  code, endpoint, idle, busy,
}: { code: string; endpoint: 'confirm' | 'refund'; idle: string; busy: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (pending) return;
    setPending(true);
    setError(null);
    let succeeded = false;
    try {
      const response = await fetch(`/api/bookings/${code}/${endpoint}`, { method: 'POST' });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? 'Chưa cập nhật được đơn. Vui lòng thử lại.');
        return;
      }
      succeeded = true;
      router.refresh();
    } catch {
      setError('Mất kết nối. Kiểm tra mạng rồi thử lại.');
    } finally {
      if (!succeeded) setPending(false);
    }
  }

  return (
    <span className="flex min-w-0 flex-col items-start gap-2 sm:items-end" aria-busy={pending}>
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="pf-action inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-hairline px-3 py-2 text-left text-xs font-semibold leading-5 text-pitch hover:border-strong disabled:opacity-60"
      >
        {pending && <LoaderCircle className="pf-spin size-4 shrink-0" aria-hidden="true" />}{pending ? busy : idle}
      </button>
      {error && <span role="alert" className="max-w-56 text-[11px] leading-5 text-danger sm:text-right">{error}</span>}
    </span>
  );
}
