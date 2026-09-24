'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, subtitle, onClose, children, size = 'max-w-3xl' }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; size?: string }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = previousOverflow; };
  }, [onClose]);

  return <div className="fixed inset-0 z-50 isolate flex h-dvh w-screen items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div aria-hidden="true" className="fixed inset-0 bg-pitch/35" />
    <button type="button" aria-label="Đóng cửa sổ" onClick={onClose} className="absolute inset-0 z-0 h-full w-full cursor-default" />
    <section className={`relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full ${size} flex-col overflow-hidden rounded-card border border-hairline bg-card sm:max-h-[calc(100dvh-3rem)]`}>
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline px-5 py-4 sm:px-7">
        <div><h2 id="modal-title" className="font-display text-2xl font-bold text-pitch">{title}</h2>{subtitle && <p className="mt-1 text-sm text-ink-secondary">{subtitle}</p>}</div>
        <button type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-control border border-hairline text-ink-secondary hover:border-strong hover:text-pitch" aria-label="Đóng"><X className="size-5" aria-hidden="true" /></button>
      </header>
      <div className="overflow-y-auto p-4 sm:p-7">{children}</div>
    </section>
  </div>;
}
