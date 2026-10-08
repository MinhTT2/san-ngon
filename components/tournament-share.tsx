'use client';
import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';

export function TournamentShare({ id, title }: { id: string; title: string }) {
  const [message, setMessage] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const copy = async (url: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      setManualUrl(''); setMessage('Đã sao chép liên kết giải đấu.');
    } catch {
      setManualUrl(url); setMessage('Chọn và sao chép liên kết bên dưới.');
    }
  };
  const share = async (native: boolean) => {
    setBusy(true); setMessage('');
    // Do not share management tabs, payment state or registration fragments.
    const url = new URL(`/giai-dau/${id}`, window.location.origin).href;
    try {
      if (native && navigator.share) {
        await navigator.share({ title, text: `Cùng tham gia ${title} trên Sân Ngon`, url });
        setMessage('Đã mở chia sẻ giải đấu.');
      } else await copy(url);
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) await copy(url);
    } finally { setBusy(false); }
  };
  return <div className="min-w-0">
    <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => share(true)} className="pf-action inline-flex min-h-11 items-center gap-2 rounded-control border border-strong bg-card px-4 text-xs font-semibold text-pitch"><Share2 size={16} aria-hidden="true" />Chia sẻ giải</button><button type="button" disabled={busy} onClick={() => share(false)} className="pf-action inline-flex min-h-11 items-center gap-2 rounded-control border border-hairline bg-card px-4 text-xs font-semibold text-pitch">{message.startsWith('Đã sao chép') ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}Sao chép liên kết</button></div>
    <p role="status" className="mt-2 text-xs leading-6 text-ink-secondary">{message}</p>
    {manualUrl && <label className="mt-2 flex flex-col gap-2 text-xs font-semibold text-pitch">Liên kết giải đấu<input readOnly value={manualUrl} onFocus={event => event.currentTarget.select()} className="min-h-11 w-full min-w-0 rounded-control border border-strong bg-card px-3 text-sm font-normal" /></label>}
  </div>;
}