"use client";

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

/** A failed read must never look like a successful empty result. */
export function QueryError({ title, className = '' }: { title: string; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div role="alert" className={`rounded-card border border-hairline bg-card p-4 ${className}`}>
      <p className="text-sm font-semibold text-pitch">{title}</p>
      <p className="mt-1 text-xs leading-6 text-ink-secondary">Thông tin chưa được cập nhật. Thử tải lại để kiểm tra.</p>
      <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())}
        className="pf-action mt-2 inline-flex min-h-11 items-center rounded-control border border-strong px-4 text-sm font-semibold text-pitch disabled:opacity-60">
        {pending ? 'Đang tải…' : 'Thử lại'}
      </button>
    </div>
  );
}
