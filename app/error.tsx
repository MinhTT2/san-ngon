'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export default function PageError({ reset }: { reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
      <div role="alert" className="rounded-card border border-hairline bg-card p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-pitch">Chưa tải được trang</h1>
        <p className="mt-3 text-sm leading-7 text-ink-secondary">
          Kết nối có thể đang gián đoạn. Thử lại để xem thông tin mới nhất.
          Nếu vừa đặt sân hoặc chuyển tiền, hãy kiểm tra trạng thái đơn trước khi tạo đơn mới hoặc chuyển thêm tiền.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => { router.refresh(); reset(); })}
            className="min-h-11 rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink disabled:opacity-60"
          >
            {pending ? 'Đang tải…' : 'Thử lại'}
          </button>
          <Link href="/don-cua-toi" className="inline-flex min-h-11 items-center rounded-control border border-hairline px-5 py-3 text-sm font-semibold text-pitch">Kiểm tra đơn của tôi</Link>
          <Link href="/tim-san" className="inline-flex min-h-11 items-center px-3 py-3 text-sm font-semibold text-pitch underline">Về tìm sân</Link>
        </div>
      </div>
    </main>
  );
}
