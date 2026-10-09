'use client';
import Link from 'next/link';
import { Heart, LoaderCircle, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';

export function FavoriteButton({ venueId, saved, signedIn, returnPath, compact = false, venueName = 'sân', feedbackTargetId }: {
  venueId: string; saved: boolean | null; signedIn: boolean; returnPath: string; compact?: boolean; venueName?: string; feedbackTargetId?: string;
}) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [status, setStatus] = useState('');
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const locked = useRef(false);
  const failedChoice = useRef<boolean | null>(null);
  useEffect(() => {
    setConfirmed(saved);
    if (saved !== null && failedChoice.current === saved) {
      failedChoice.current = null;
      setError(''); setExpired(false);
      setStatus(saved ? 'Đã kiểm tra: sân đã được lưu.' : 'Đã kiểm tra: sân đã được bỏ lưu.');
    }
  }, [saved, venueId]);
  useEffect(() => { setTarget(feedbackTargetId ? document.getElementById(feedbackTargetId) : null); }, [feedbackTargetId]);
  const pending = busy || refreshing;
  const style = `pf-action inline-flex min-h-11 items-center justify-center gap-2 border border-hairline bg-card text-sm font-semibold text-pitch hover:border-pitch disabled:opacity-60 ${compact ? 'size-11 rounded-pill' : 'rounded-control px-4 py-3'}`;
  const label = `${confirmed ? 'Bỏ lưu' : 'Lưu'} ${venueName}`;
  const login = `/dang-nhap?next=${encodeURIComponent(returnPath)}`;
  const unknown = confirmed === null;

  async function toggle(desired = !confirmed) {
    if (locked.current || pending || unknown) return;
    locked.current = true; setBusy(true); setError(''); setStatus(''); setExpired(false);
    failedChoice.current = desired;
    try {
      const response = await fetch('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venue_id: venueId, saved: desired }) });
      const result = await response.json();
      if (!response.ok) { setExpired(response.status === 401); setError(result.error ?? 'Chưa cập nhật được sân yêu thích.'); return; }
      if (typeof result.saved !== 'boolean') throw new Error('Invalid favorite response');
      failedChoice.current = null;
      setConfirmed(result.saved);
      setStatus(result.saved ? 'Đã lưu sân vào danh sách yêu thích.' : 'Đã bỏ lưu sân.');
      // The removed row will unmount on refresh; move focus while it still exists.
      if (!result.saved && returnPath === '/san-yeu-thich') document.getElementById('saved-venues-heading')?.focus({ preventScroll: true });
      startTransition(() => router.refresh());
    } catch { setError('Mất kết nối. Bạn có thể thử lại; thao tác sẽ giữ đúng lựa chọn lưu hoặc bỏ lưu.'); }
    finally { locked.current = false; setBusy(false); }
  }

  if (!signedIn) return <Link aria-label={compact ? label : undefined} href={login} className={style}><Heart size={17} aria-hidden="true" />{!compact && 'Lưu sân'}</Link>;
  const feedback = <>
    {unknown && <p role="status" className="mt-3 text-xs leading-6 text-ink-secondary">Chưa đọc được trạng thái lưu. Bấm nút tải lại để kiểm tra.</p>}
    {error && <div className="mt-3 rounded-control border border-danger/30 bg-card p-3 text-xs leading-6"><p role="alert" className="text-danger">{error}</p>{expired
      ? <Link href={login} className="mt-1 inline-flex min-h-11 items-center font-semibold text-pitch underline">Đăng nhập và quay lại</Link>
      : <button type="button" disabled={pending} onClick={() => toggle(failedChoice.current ?? !confirmed)} className="mt-1 inline-flex min-h-11 items-center gap-1.5 font-semibold text-pitch underline disabled:opacity-50"><RotateCcw size={14} aria-hidden="true" />Thử lại</button>}</div>}
    <p role="status" className={status ? 'mt-3 text-xs leading-6 text-free-ink' : 'sr-only'}>{status}</p>
  </>;
  return <div>
    <button type="button" aria-label={unknown ? `Tải lại trạng thái lưu ${venueName}` : compact ? label : undefined} title={unknown ? 'Tải lại trạng thái lưu' : label}
      aria-pressed={unknown ? undefined : confirmed} aria-busy={pending} disabled={pending} className={style}
      onClick={unknown ? () => startTransition(() => router.refresh()) : () => toggle()}>
      {pending ? <LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : unknown ? <RotateCcw size={17} aria-hidden="true" /> : <Heart size={17} fill={confirmed ? 'currentColor' : 'none'} aria-hidden="true" />}
      {!compact && (unknown ? 'Tải lại trạng thái lưu' : pending ? confirmed ? 'Đang bỏ lưu…' : 'Đang lưu…' : confirmed ? 'Bỏ lưu sân' : 'Lưu sân')}
    </button>
    {feedbackTargetId ? target ? createPortal(feedback, target) : <span className="sr-only">{error || status}</span> : feedback}
  </div>;
}
