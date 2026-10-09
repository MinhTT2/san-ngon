'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUnsavedChanges } from '@/lib/use-unsaved-changes';

/** Small JSON form for tournament and public-profile RPC routes. */
export function ActionForm({ children, payload = {}, nested = false, endpoint = '/api/tournaments', label, successHref, confirmMessage, variant = 'primary', successMessage = 'Đã lưu.', className = '', guardUnsaved = nested || endpoint === '/api/community' }: {
  children?: React.ReactNode; payload?: Record<string, unknown>; nested?: boolean; endpoint?: string;
  label: string; successHref?: string; confirmMessage?: string; variant?: 'primary' | 'danger'; successMessage?: string;
  className?: string;
  guardUnsaved?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [imageWorking, setImageWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const errorId = useId();
  const feedback = useRef<HTMLParagraphElement>(null);
  const baseline = useRef('');
  const submitting = useRef(false);
  const [dirty, setDirty] = useState(false);
  const { markSaved } = useUnsavedChanges(guardUnsaved && dirty, guardUnsaved && (busy || imageWorking));
  function fingerprint(form: HTMLFormElement) {
    return JSON.stringify(Array.from(form.elements).filter((element): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement).filter(element => element.name).map(element => [element.name, element instanceof HTMLInputElement && element.type === 'checkbox' ? element.checked : element.value]));
  }
  useEffect(() => {
    const form = formRef.current;
    baseline.current = form ? fingerprint(form) : '';
    const sync = () => { setImageWorking(!!form?.querySelector('[data-image-uploading="true"]')); if (form) setDirty(fingerprint(form) !== baseline.current); };
    sync();
    form?.addEventListener('image-upload-state', sync);
    form?.addEventListener('input', sync);
    return () => { form?.removeEventListener('image-upload-state', sync); form?.removeEventListener('input', sync); };
  }, []);
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
    if (submitting.current) return;
    if (event.currentTarget.querySelector('[data-image-uploading="true"]')) {
      setFailed(true); setMessage('Ảnh đang được tải lên. Chờ tải xong rồi gửi giải đấu.');
      return;
    }
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const form = event.currentTarget;
    const fields: Record<string, unknown> = Object.fromEntries(new FormData(form));
    const unconfirmed = 'Chưa xác nhận được kết quả lưu từ máy chủ. Kiểm tra danh sách trước khi gửi lại; thông tin vẫn được giữ trên form.';
    form.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach(input => { fields[input.name] = input.checked; });
    submitting.current = true;
    setBusy(true); setMessage(''); setFailed(false); setFieldErrors({});
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, ...(nested ? { data: fields } : fields) }) });
      const result = await response.json().catch(() => null);
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(unconfirmed);
      if (!response.ok) {
        const errors: Record<string, string> = Object.fromEntries(Object.entries(result.fieldErrors ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
        setFieldErrors(errors);
        throw new Error(Object.keys(errors).length ? 'Chưa lưu được. Sửa các mục dưới đây rồi gửi lại; thông tin đã nhập vẫn được giữ trên form.' : result.error || 'Chưa lưu được.');
      }
      if (successHref === 'tournament' && (typeof result.data !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(result.data))) throw new Error(unconfirmed);
      markSaved(); baseline.current = fingerprint(form); setDirty(false);
      setMessage(successMessage);
      if (successHref) window.location.assign(successHref === 'tournament' ? `/giai-dau/${result.data}` : successHref);
      else router.refresh();
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof TypeError ? 'Kết nối bị gián đoạn, chưa xác nhận được kết quả lưu. Kiểm tra mạng và danh sách trước khi gửi lại; thông tin vẫn được giữ trên form.' : error instanceof Error ? error.message : 'Chưa xác nhận được kết quả lưu. Kiểm tra danh sách trước khi gửi lại.');
    }
    finally { submitting.current = false; setBusy(false); }
  }
  return <form ref={formRef} onSubmit={submit} onChange={event => {
    setDirty(fingerprint(event.currentTarget) !== baseline.current);
    const input = event.target;
    if ((input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement) && fieldErrors[input.name]) {
      const remaining = Object.fromEntries(Object.entries(fieldErrors).filter(([name]) => name !== input.name));
      setFieldErrors(remaining);
      if (!Object.keys(remaining).length) { setMessage(''); setFailed(false); }
    }
  }} data-unsaved-changes={guardUnsaved && dirty} data-unsaved-busy={guardUnsaved && (busy || imageWorking)} aria-busy={busy} className={`space-y-4 [&_input[aria-invalid=true]]:border-danger [&_select[aria-invalid=true]]:border-danger [&_textarea[aria-invalid=true]]:border-danger ${className}`}>
    {message && <p ref={feedback} tabIndex={-1} role={failed ? 'alert' : 'status'} className={`rounded-control border p-4 text-sm leading-6 ${failed ? 'border-danger/30 bg-danger/5 text-danger' : 'border-strong bg-free-fill text-pitch'}`}>{message}</p>}
    {!!Object.keys(fieldErrors).length && <ul aria-label="Thông tin cần sửa" className="space-y-2 rounded-control border border-danger/30 bg-danger/5 p-4 text-sm text-danger">{Object.entries(fieldErrors).map(([name, error]) => <li key={name} id={`${errorId}-${name}`}><button type="button" onClick={() => focusField(name)} className="min-h-11 text-left leading-6 underline underline-offset-4">{error}</button></li>)}</ul>}
    <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">{children}
      {imageWorking && <p role="status" className="text-xs leading-6 text-ink-secondary">Hoàn tất chỉnh và tải ảnh trước khi gửi giải đấu.</p>}
      <button disabled={busy || imageWorking} className={`min-h-11 rounded-control border px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${variant === 'danger' ? 'border-danger/30 text-danger hover:bg-danger/5' : 'border-pitch bg-pitch text-pitch-ink hover:bg-pitch/90'}`} type="submit">{busy ? 'Đang xử lý…' : imageWorking ? 'Đang chuẩn bị ảnh…' : label}</button>
    </fieldset>
  </form>;
}
