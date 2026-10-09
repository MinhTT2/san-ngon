import { Check, CircleAlert, LoaderCircle } from 'lucide-react';

export type PhotoPhase = 'waiting' | 'uploading' | 'uploaded' | 'error';
export function PhotoUploadStatus({ phase }: { phase: PhotoPhase }) {
  const Icon = phase === 'uploaded' ? Check : phase === 'error' ? CircleAlert : phase === 'uploading' ? LoaderCircle : null;
  const text = { waiting: 'Chờ tải', uploading: 'Đang tải…', uploaded: 'Đã tải', error: 'Tải lỗi · thử lại' }[phase];
  return <p className={`flex items-center gap-1.5 px-2 pb-3 text-xs ${phase === 'error' ? 'text-danger' : phase === 'uploaded' ? 'text-free-ink' : 'text-ink-secondary'}`}>
    {Icon && <Icon aria-hidden="true" className={`size-3.5 shrink-0 ${phase === 'uploading' ? 'animate-spin motion-reduce:animate-none' : ''}`} />}{text}
  </p>;
}
