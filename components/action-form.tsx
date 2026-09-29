'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Small JSON form for tournament and public-profile RPC routes. */
export function ActionForm({ children, payload = {}, nested = false, endpoint = '/api/tournaments', label, successHref, confirmMessage, variant = 'primary', successMessage = 'Đã lưu.' }: {
  children?: React.ReactNode; payload?: Record<string, unknown>; nested?: boolean; endpoint?: string;
  label: string; successHref?: string; confirmMessage?: string; variant?: 'primary' | 'danger'; successMessage?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (failed && message) feedback.current?.focus(); }, [failed, message]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const form = event.currentTarget;
    const fields: Record<string, unknown> = Object.fromEntries(new FormData(form));
    form.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach(input => { fields[input.name] = input.checked; });
    setBusy(true); setMessage(''); setFailed(false);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, ...(nested ? { data: fields } : fields) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Chưa lưu được.');
      setMessage(successMessage);
      if (successHref) router.push(successHref === 'tournament' ? `/giai-dau/${result.data}` : successHref);
      router.refresh();
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Không kết nối được. Thử lại nhé.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} aria-busy={busy} className="space-y-4">
    {message && <p ref={feedback} tabIndex={-1} role={failed ? 'alert' : 'status'} className={`rounded-control border p-4 text-sm leading-6 ${failed ? 'border-danger/30 bg-danger/5 text-danger' : 'border-strong bg-free-fill text-pitch'}`}>{message}</p>}
    <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">{children}
      <button className={`min-h-11 rounded-control border px-5 py-2.5 text-sm font-semibold transition-colors ${variant === 'danger' ? 'border-danger/30 text-danger hover:bg-danger/5' : 'border-pitch bg-pitch text-pitch-ink hover:bg-pitch/90'}`} type="submit">{busy ? 'Đang xử lý…' : label}</button>
    </fieldset>
  </form>;
}
