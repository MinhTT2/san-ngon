'use client';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function FavoriteButton({ venueId, saved, signedIn, returnPath }: { venueId: string; saved: boolean | null; signedIn: boolean; returnPath: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const style = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-hairline bg-card px-4 py-3 text-sm font-semibold text-pitch hover:border-pitch disabled:opacity-60';
  if (!signedIn) return <Link href={`/dang-nhap?next=${encodeURIComponent(returnPath)}`} className={style}><Heart size={17} aria-hidden="true" />Lưu sân</Link>;
  if (saved === null) return <p role="status" className="max-w-xs text-sm text-ink-secondary">Chưa đọc được trạng thái đã lưu. Thử tải lại trang.</p>;
  return <div><button type="button" aria-pressed={saved} disabled={busy} className={style} onClick={async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venue_id: venueId, saved: !saved }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? 'Chưa lưu được sân.'); return; }
      router.refresh();
    } catch { setError('Mất kết nối. Tải lại trang để kiểm tra trạng thái đã lưu.'); }
    finally { setBusy(false); }
  }}><Heart size={17} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />{busy ? 'Đang lưu…' : saved ? 'Bỏ lưu sân' : 'Lưu sân'}</button>{error && <p role="alert" className="mt-2 max-w-xs text-sm text-danger">{error}</p>}</div>;
}
