'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Small JSON form for tournament and public-profile RPC routes. */
export function ActionForm({ children, payload = {}, nested = false, endpoint = '/api/tournaments', label, successHref, confirmMessage }: {
  children?: React.ReactNode; payload?: Record<string, unknown>; nested?: boolean; endpoint?: string;
  label: string; successHref?: string; confirmMessage?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
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
      setMessage('Đã lưu.');
      if (successHref) router.push(successHref === 'tournament' ? `/giai-dau/${result.data}` : successHref);
      router.refresh();
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Không kết nối được. Thử lại nhé.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-4">
    <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">{children}
      <button className="min-h-11 rounded-control bg-pitch px-5 py-2 text-sm font-semibold text-pitch-ink" type="submit">{busy ? 'Đang xử lý…' : label}</button>
    </fieldset>
    {message && <p role={failed ? 'alert' : 'status'} className={`text-sm ${failed ? 'text-danger' : 'text-pitch'}`}>{message}</p>}
  </form>;
}
