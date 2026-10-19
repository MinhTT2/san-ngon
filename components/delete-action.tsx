'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from './modal';

/** Confirmation and feedback only; the server decides whether deletion is allowed. */
export function DeleteAction({ endpoint, method = 'POST', payload, name, label, ariaLabel, description, successMessage, successHref }: {
  endpoint: string; method?: 'POST' | 'DELETE'; payload?: Record<string, unknown>;
  name: string; label: string; ariaLabel?: string; description: string; successMessage: string; successHref?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const sending = useRef(false);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) feedback.current?.focus(); }, [error]);

  function close() { if (!sending.current) setOpen(false); }
  async function remove() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, {
        method,
        ...(payload ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}),
      });
      const result = response.status === 204 ? null : await response.json();
      if (!response.ok) { setError(result?.error ?? 'Không xóa được. Hãy thử lại.'); return; }
      setOpen(false); setDone(true);
      if (successHref) router.replace(successHref);
      router.refresh();
    } catch {
      setError('Chưa xác nhận được kết quả xóa. Đóng cửa sổ và tải lại danh sách để kiểm tra trước khi thử lại.');
    } finally { sending.current = false; setBusy(false); }
  }

  return <>
    {done ? <p role="status" className="text-sm leading-6 text-pitch">{successMessage}</p> : <button type="button" aria-haspopup="dialog" aria-label={ariaLabel} onClick={() => { setError(''); setOpen(true); }} className="pf-action min-h-11 rounded-control border border-danger/30 px-3 text-xs font-semibold text-danger hover:bg-danger/5">{label}</button>}
    {open && <Modal title={label} size="max-w-lg" onClose={close}>
      <form onSubmit={event => { event.preventDefault(); void remove(); }} aria-busy={busy} data-unsaved-busy={busy} className="space-y-4">
        <p className="break-words rounded-control border border-hairline bg-page p-4 font-semibold text-pitch [overflow-wrap:anywhere]">{name}</p>
        <p className="text-sm leading-7 text-ink-secondary">{description}</p>
        <p className="text-sm font-semibold text-danger">Thao tác này không thể hoàn tác.</p>
        {error && <p ref={feedback} tabIndex={-1} role="alert" className="rounded-control border border-danger/30 bg-danger/5 p-3 text-sm leading-6 text-danger">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" data-modal-initial-focus disabled={busy} onClick={close} className="pf-action min-h-11 rounded-control border border-hairline px-4 text-sm font-semibold disabled:opacity-60">Quay lại</button>
          <button type="submit" disabled={busy} className="pf-action min-h-11 rounded-control bg-danger px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Đang xóa…' : 'Xác nhận xóa'}</button>
        </div>
      </form>
    </Modal>}
  </>;
}
