'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { playMotion } from '@/lib/motion';

export function Modal({ title, subtitle, onClose, children, size = 'max-w-3xl' }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; size?: string }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const panel = panelRef.current, backdrop = backdropRef.current;
    const stopPanel = panel ? playMotion(panel, { opacity: [0, 1], transform: ['translateY(20px) scale(.97)', 'translateY(0) scale(1)'] }, { duration: 0.36 }) : () => {};
    const stopBackdrop = backdrop ? playMotion(backdrop, { opacity: [0, 1] }, { duration: 0.22 }) : () => {};
    return () => { stopPanel(); stopBackdrop(); };
  }, []);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const dialog = dialogRef.current;
    const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]') ?? []).filter(el => el.getClientRects().length > 0);
    (dialog?.querySelector<HTMLElement>('input, select, textarea') ?? controls()[0] ?? dialog)?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key === 'Tab') {
        const items = controls();
        const first = items[0], last = items.at(-1);
        if (!first) { event.preventDefault(); dialog?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handleKey); document.body.style.overflow = previousOverflow; if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);

  return <div className="fixed inset-0 z-50 isolate flex items-center justify-center p-3 sm:p-6" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}>
    <div ref={backdropRef} aria-hidden="true" className="fixed inset-0 bg-pitch/35" />
    <button type="button" tabIndex={-1} aria-label="Đóng cửa sổ" onClick={onClose} className="absolute inset-0 z-0 h-full w-full cursor-default" />
    <section ref={panelRef} data-modal-panel className={`relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full ${size} flex-col overflow-hidden rounded-[24px] border border-hairline bg-card sm:max-h-[calc(100dvh-3rem)]`}>
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline px-5 py-4 sm:px-7">
        <div><h2 id={titleId} className="font-display text-2xl font-bold text-pitch">{title}</h2>{subtitle && <p className="mt-1 text-sm text-ink-secondary">{subtitle}</p>}</div>
        <button type="button" onClick={onClose} className="pf-action grid size-11 shrink-0 place-items-center rounded-control border border-hairline text-ink-secondary hover:border-strong hover:text-pitch" aria-label="Đóng"><X className="size-5" aria-hidden="true" /></button>
      </header>
      <div className="overflow-y-auto p-4 sm:p-7">{children}</div>
    </section>
  </div>;
}
