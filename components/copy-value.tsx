'use client';
import { useState } from 'react';
export function CopyValue({ value, label }: { value: string; label: string }) {
  const [message, setMessage] = useState('');
  return <span className="inline-flex max-w-full flex-wrap items-center gap-2"><strong className="select-all break-all">{value}</strong><button type="button" aria-label={`Sao chép ${label}`} onClick={async () => {
    try { await navigator.clipboard.writeText(value); setMessage('Đã sao chép'); }
    catch { setMessage('Chưa sao chép được. Chọn nội dung để sao chép thủ công.'); }
  }} className="min-h-11 rounded-control border border-hairline px-3 text-xs font-semibold text-pitch hover:bg-free-fill">Sao chép</button><span role="status" className="text-xs text-ink-secondary">{message}</span></span>;
}
