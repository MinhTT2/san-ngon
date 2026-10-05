'use client';
import { Share2 } from 'lucide-react';
import { useState } from 'react';

export function ShareButton({ title, url }: { title: string; url: string }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [fallback, setFallback] = useState(false);
  return <div><button type="button" disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-control border border-hairline bg-card px-4 py-3 text-sm font-semibold text-pitch hover:border-pitch disabled:opacity-60" onClick={async () => {
    setBusy(true); setStatus(''); setFallback(false);
    try {
      if (navigator.share) { await navigator.share({ title, url }); setStatus('Đã mở chia sẻ.'); }
      else { await navigator.clipboard.writeText(url); setStatus('Đã sao chép liên kết sân.'); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) { setStatus('Bạn có thể sao chép liên kết bên dưới.'); setFallback(true); }
    } finally { setBusy(false); }
  }}><Share2 size={17} aria-hidden="true" />Chia sẻ sân</button>{status && <p role="status" className="mt-2 text-xs text-ink-secondary">{status}</p>}{fallback && <input aria-label="Liên kết sân" value={url} readOnly onFocus={event => event.target.select()} className="mt-2 min-h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm" />}</div>;
}
