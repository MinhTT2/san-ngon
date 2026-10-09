'use client';

import { useEffect, useRef, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

/** GET still works without JS; enhanced submissions keep the header and history. */
export function VenueSearchForm({ children, queryKey }: { children: ReactNode; queryKey: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const submitted = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  // Updated URL defaults replace the old draft; background reads keep the same key.
  useEffect(() => { form.current?.reset(); }, [queryKey]);
  useEffect(() => {
    if (pending || !submitted.current) return;
    submitted.current = false;
    const results = document.getElementById('ket-qua');
    results?.focus({ preventScroll: true });
    results?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [pending, queryKey]);
  return <form ref={form} action="/tim-san#ket-qua" aria-label="Tìm và lọc sân" aria-busy={pending} data-unsaved-busy={pending}
    className="relative grid grid-cols-2 gap-3 rounded-[20px] border border-hairline bg-card p-4 sm:p-5 lg:grid-cols-1 lg:gap-4"
    onSubmit={event => {
      event.preventDefault();
      if (pending) return;
      const data = new FormData(event.currentTarget);
      const query = new URLSearchParams();
      for (const [key, value] of data) if (typeof value === 'string' && value.trim()) query.set(key, value.trim());
      query.delete('page');
      submitted.current = true;
      startTransition(() => router.push(`/tim-san?${query}#ket-qua`, { scroll: false }));
    }}>
    <fieldset key={queryKey} disabled={pending} className="contents">{children}</fieldset>
    <button disabled={pending} className="pf-action col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink hover:bg-ink disabled:opacity-60 lg:col-span-1">
      {pending && <span aria-hidden="true" className="pf-spin size-3.5 rounded-full border-2 border-white/40 border-t-white" />}
      {pending ? 'Đang tìm sân…' : 'Tìm sân'}{!pending && <span aria-hidden="true" className="pf-arrow">→</span>}
    </button>
    <p role="status" className="sr-only">{pending ? 'Đang tải sân phù hợp với bộ lọc đã chọn.' : ''}</p>
  </form>;
}
