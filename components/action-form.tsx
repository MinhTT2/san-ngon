'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Small JSON form for tournament and public-profile RPC routes. */
export function ActionForm({ children, payload = {}, nested = false, endpoint = '/api/tournaments', label, successHref, confirmMessage, variant = 'primary', successMessage = 'Đã lưu.', className = '' }: {
  children?: React.ReactNode; payload?: Record<string, unknown>; nested?: boolean; endpoint?: string;
  label: string; successHref?: string; confirmMessage?: string; variant?: 'primary' | 'danger'; successMessage?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const errorId = useId();
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    formRef.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input[name],select[name],textarea[name]').forEach(input => {
      if (fieldErrors[input.name]) {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', `${errorId}-${input.name}`);
      } else if (input.getAttribute('aria-describedby') === `${errorId}-${input.name}`) {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
      }
    });
  }, [fieldErrors, errorId]);
  useEffect(() => { if (failed && message) feedback.current?.focus(); }, [failed, message]);
  function focusField(name: string) {
    const input = formRef.current?.elements.namedItem(name);
    if (input instanceof HTMLElement) { input.focus(); input.scrollIntoView({ block: 'center' }); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const form = event.currentTarget;
    const fields: Record<string, unknown> = Object.fromEntries(new FormData(form));
    form.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach(input => { fields[input.name] = input.checked; });
    setBusy(true); setMessage(''); setFailed(false); setFieldErrors({});
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, ...(nested ? { data: fields } : fields) }) });
      const result = await response.json();
      if (!response.ok) {
        const errors: Record<string, string> = Object.fromEntries(Object.entries(result.fieldErrors ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
        setFieldErrors(errors);
        throw new Error(Object.keys(errors).length ? 'Chưa lưu được. Sửa các mục dưới đây rồi gửi lại; thông tin đã nhập vẫn được giữ trên form.' : result.error || 'Chưa lưu được.');
      }
      setMessage(successMessage);
      if (successHref) window.location.assign(successHref === 'tournament' ? `/giai-dau/${result.data}` : successHref);
      else router.refresh();
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Không kết nối được. Thử lại nhé.'); }
    finally { setBusy(false); }
  }
  return <form ref={formRef} onSubmit={submit} onChange={event => {
    const input = event.target;
    if ((input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement) && fieldErrors[input.name]) {
      const remaining = Object.fromEntries(Object.entries(fieldErrors).filter(([name]) => name !== input.name));
      setFieldErrors(remaining);
      if (!Object.keys(remaining).length) { setMessage(''); setFailed(false); }
    }
  }} aria-busy={busy} className={`space-y-4 [&_input[aria-invalid=true]]:border-danger [&_select[aria-invalid=true]]:border-danger [&_textarea[aria-invalid=true]]:border-danger ${className}`}>
    {message && <p ref={feedback} tabIndex={-1} role={failed ? 'alert' : 'status'} className={`rounded-control border p-4 text-sm leading-6 ${failed ? 'border-danger/30 bg-danger/5 text-danger' : 'border-strong bg-free-fill text-pitch'}`}>{message}</p>}
    {!!Object.keys(fieldErrors).length && <ul aria-label="Thông tin cần sửa" className="space-y-2 rounded-control border border-danger/30 bg-danger/5 p-4 text-sm text-danger">{Object.entries(fieldErrors).map(([name, error]) => <li key={name} id={`${errorId}-${name}`}><button type="button" onClick={() => focusField(name)} className="min-h-11 text-left leading-6 underline underline-offset-4">{error}</button></li>)}</ul>}
    <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">{children}
      <button className={`min-h-11 rounded-control border px-5 py-2.5 text-sm font-semibold transition-colors ${variant === 'danger' ? 'border-danger/30 text-danger hover:bg-danger/5' : 'border-pitch bg-pitch text-pitch-ink hover:bg-pitch/90'}`} type="submit">{busy ? 'Đang xử lý…' : label}</button>
    </fieldset>
  </form>;
}
