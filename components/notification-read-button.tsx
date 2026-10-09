'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, LoaderCircle } from 'lucide-react';

/** Also works as a regular submit button inside the inbox's server-rendered form. */
export function NotificationReadButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState('');
  const [loginHref, setLoginHref] = useState('');
  async function markRead(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (state !== 'idle') return;
    setState('busy'); setError(''); setLoginHref('');
    try {
      const response = await fetch(`/api/notifications/${id}/read`, { method: 'POST', headers: { Accept: 'application/json' } });
      if (response.status === 401) {
        setState('idle');
        setError('Phiên đăng nhập đã hết. Đăng nhập lại để lưu trạng thái đã đọc.');
        setLoginHref(`/dang-nhap?${new URLSearchParams({ next: window.location.pathname + window.location.search })}`);
        return;
      }
      if (!response.ok) throw new Error('read failed');
      setState('done');
      router.refresh();
    } catch {
      setState('idle');
      setError('Chưa lưu được. Kiểm tra mạng rồi thử lại.');
    }
  }
  return <span className="inline-flex max-w-full flex-col items-start gap-1" data-read-state={state}>
    <button type="submit" aria-disabled={state !== 'idle'} onClick={markRead}
      aria-label={state === 'done' ? `Đã đọc: ${title}` : `Đánh dấu đã đọc: ${title}`} aria-busy={state === 'busy'}
      className="pf-action inline-flex min-h-11 items-center gap-2 rounded-control px-2 text-xs font-semibold text-pitch aria-disabled:opacity-70">
      {state === 'busy' ? <LoaderCircle className="pf-spin size-4 shrink-0" aria-hidden="true" /> : <Check className="size-4 shrink-0" aria-hidden="true" />}
      {state === 'busy' ? 'Đang lưu…' : state === 'done' ? 'Đã đọc' : 'Đánh dấu đã đọc'}
    </button>
    {error && <span role="alert" className="max-w-64 text-xs leading-6 text-danger">{error}</span>}
    {loginHref && <Link href={loginHref} className="pf-action inline-flex min-h-11 items-center text-xs font-semibold text-pitch underline underline-offset-4">Đăng nhập lại</Link>}
  </span>;
}
