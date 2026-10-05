'use client';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function FavoriteButton({ venueId, saved, signedIn, returnPath, compact = false, venueName = 'sân' }: { venueId: string; saved: boolean | null; signedIn: boolean; returnPath: string; compact?: boolean; venueName?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, startTransition] = useTransition();
  const [status, setStatus] = useState('');
  const pending = busy || refreshing;
  const style = `inline-flex min-h-11 items-center justify-center gap-2 border border-hairline bg-card text-sm font-semibold text-pitch hover:border-pitch disabled:opacity-60 ${compact ? 'size-11 rounded-pill' : 'rounded-control px-4 py-3'}`;
  const label = `${saved ? 'Bỏ lưu' : 'Lưu'} ${venueName}`;
  if (!signedIn) return <Link aria-label={compact ? label : undefined} href={`/dang-nhap?next=${encodeURIComponent(returnPath)}`} className={style}><Heart size={17} aria-hidden="true" />{!compact && 'Lưu sân'}</Link>;
  if (saved === null) return <p role="status" className="max-w-xs text-sm text-ink-secondary">Chưa đọc được trạng thái đã lưu. Thử tải lại trang.</p>;
  return <div><button type="button" aria-label={compact ? label : undefined} title={compact ? label : undefined} aria-pressed={saved} disabled={pending} className={style} onClick={async () => {
    setBusy(true); setError(''); setStatus('');
    try {
      const response = await fetch('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venue_id: venueId, saved: !saved }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? 'Chưa lưu được sân.'); return; }
      setStatus(result.saved ? 'Đã lưu sân.' : 'Đã bỏ lưu sân.');
      startTransition(() => router.refresh());
    } catch { setError('Mất kết nối. Tải lại trang để kiểm tra trạng thái đã lưu.'); }
    finally { setBusy(false); }
  }}><Heart size={17} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />{!compact && (pending ? saved ? 'Đang bỏ lưu…' : 'Đang lưu…' : saved ? 'Bỏ lưu sân' : 'Lưu sân')}</button><span role="status" className="sr-only">{status}</span>{error && <p role="alert" className="mt-2 max-w-xs rounded-control bg-card p-2 text-sm text-danger">{error}</p>}</div>;
}
