'use client';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return <span className="relative inline-flex"><button type="button" aria-label={`Sao chép mã ${value}`} className="grid size-11 place-items-center rounded-control border border-hairline text-pitch hover:bg-sunk" onClick={async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setFailed(false); }
    catch { setFailed(true); setCopied(false); }
  }}>{copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}</button><span role="status" className="sr-only">{copied ? `Đã sao chép ${value}` : ''}</span>{failed && <span role="alert" className="absolute left-0 top-full z-10 mt-2 w-52 rounded-control border border-hairline bg-card p-3 text-xs leading-5">Chưa sao chép được. Bạn có thể chọn mã đơn bên cạnh để sao chép.</span>}</span>;
}
