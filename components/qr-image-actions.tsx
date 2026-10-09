'use client';
import { useRef, useState } from 'react';
import { Download, Share2 } from 'lucide-react';

export function QrImageActions({ src, filename }: { src: string; filename: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const running = useRef(false);
  async function save(share: boolean) {
    if (running.current) return;
    running.current = true; setBusy(true); setMessage('');
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error('qr');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('qr');
      const file = new File([blob], filename + ({ 'image/png': '.png', 'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/jpeg': '.jpg' }[blob.type] ?? '.png'), { type: blob.type });
      if (share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Mã QR chuyển khoản ' + filename });
      else {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a'); link.href = url; link.download = file.name;
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        setMessage('Đã tải ảnh QR. Mở app ngân hàng và chọn ảnh trong mục quét mã.');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('Chưa lưu được ảnh. Nhấn giữ hoặc nhấp chuột phải vào ảnh QR để lưu; bạn cũng có thể chuyển khoản theo thông tin hiển thị.');
    } finally { running.current = false; setBusy(false); }
  }
  return <div className="mt-3"><div className="flex flex-wrap justify-center gap-2"><button type="button" disabled={busy} onClick={() => void save(false)} className="inline-flex min-h-11 items-center gap-2 rounded-control border border-hairline px-3 text-xs font-semibold text-pitch disabled:opacity-60"><Download size={15} aria-hidden="true" />{busy ? 'Đang chuẩn bị…' : 'Lưu ảnh QR'}</button><button type="button" disabled={busy} onClick={() => void save(true)} className="inline-flex min-h-11 items-center gap-2 rounded-control border border-hairline px-3 text-xs font-semibold text-pitch disabled:opacity-60"><Share2 size={15} aria-hidden="true" />Chia sẻ QR</button></div><p role="status" className="mt-2 text-xs leading-6 text-ink-secondary">{message}</p></div>;
}
