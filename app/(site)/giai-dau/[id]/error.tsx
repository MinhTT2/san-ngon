'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function TournamentError({ reset }: { reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <main className="mx-auto max-w-3xl px-5 py-12">
    <div role="alert" className="rounded-card border border-hairline bg-card p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold text-pitch">Chưa tải được thông tin giải</h1>
      <p className="mt-3 text-sm leading-7 text-ink-secondary">Kết nối có thể đang gián đoạn. Thử tải lại để kiểm tra trạng thái mới nhất trước khi tiếp tục thao tác hoặc chuyển tiền.</p>
      <button disabled={pending} onClick={() => startTransition(() => { router.refresh(); reset(); })} className="mt-5 min-h-11 rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink disabled:opacity-60">{pending ? 'Đang tải…' : 'Thử lại'}</button>
      <Link href="/giai-dau" className="ml-5 inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline">Về danh sách giải</Link>
    </div>
  </main>;
}
