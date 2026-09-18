'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
    setPending(true);
    setError(null);
    const response = await fetch(`/api/bookings/${code}/${endpoint}`, { method: 'POST' });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) {
      setError(body?.error ?? 'Có lỗi xảy ra.');
      setPending(false);
      return;
    }
    router.refresh();
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="rounded-control border border-hairline px-3 py-2 text-xs font-semibold text-pitch hover:border-strong"
      >
        {pending ? busy : idle}
      </button>
      {error && <span className="max-w-56 text-right text-[11px] text-danger">{error}</span>}
    </span>
  );
}
