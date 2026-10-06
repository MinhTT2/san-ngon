'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, Crop, Move, RotateCcw, X, ZoomIn } from 'lucide-react';

type Position = { zoom: number; x: number; y: number };
const initial: Position = { zoom: 1, x: 50, y: 50 };

/** Same crop geometry for the visible frame and exported file. No external editor. */
export function ImageCropDialog({ file, kind, onCancel, onApply }: {
  file: File; kind: 'avatar' | 'cover'; onCancel: () => void; onApply: (file: File) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ id: number; x: number; y: number; position: Position } | null>(null);
  const id = useId();
  const [src, setSrc] = useState('');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState(initial);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [contain, setContain] = useState(false);
  const avatar = kind === 'avatar';
  const ratio = avatar ? 1 : 16 / 9;
  const fittedWidth = (contain ? Math.min(1, size.width / size.height / ratio) : Math.max(1, size.width / size.height / ratio) * view.zoom) * 100;
  const fittedHeight = (contain ? Math.min(1, ratio / (size.width / size.height)) : Math.max(1, ratio / (size.width / size.height)) * view.zoom) * 100;
  const overflowX = (fittedWidth - 100) / 100;
  const overflowY = (fittedHeight - 100) / 100;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    const previousFocus = document.activeElement;
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element?.showModal();
    return () => {
      element?.close(); URL.revokeObjectURL(url); document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [file]);

  async function apply() {
    if (!image.current || !size.width || exporting) return;
    setExporting(true); setError('');
    try {
      const baseWidth = Math.max(size.height * ratio, size.width);
      const cropWidth = size.width / (baseWidth / (size.height * ratio) * view.zoom);
      const cropHeight = cropWidth / ratio;
      const canvas = document.createElement('canvas');
      canvas.width = contain ? Math.min(1600, Math.max(size.width, size.height * ratio)) : Math.max(1, Math.round(Math.min(avatar ? 640 : 1600, cropWidth)));
      canvas.height = Math.max(1, Math.round(canvas.width / ratio));
      const context = canvas.getContext('2d');
      if (!context) throw new Error();
      if (contain) {
        context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-pitch').trim();
        context.fillRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / size.width, canvas.height / size.height);
        context.drawImage(image.current, (canvas.width - size.width * scale) / 2, (canvas.height - size.height * scale) / 2, size.width * scale, size.height * scale);
      } else context.drawImage(image.current, (size.width - cropWidth) * view.x / 100, (size.height - cropHeight) * view.y / 100, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error()), 'image/webp', 0.9));
      onApply(new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' }));
    } catch { setError('Chưa xử lý được ảnh. Thử lại hoặc chọn ảnh khác.'); setExporting(false); }
  }

  return <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event => { event.preventDefault(); if (!exporting) onCancel(); }} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(element => element.offsetParent !== null);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} className="image-editor m-auto max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-xl overflow-y-auto rounded-card border border-hairline bg-card p-0 text-ink backdrop:bg-ink/60">
    <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 sm:px-6">
      <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-control bg-free-fill text-pitch"><Crop className="size-5" aria-hidden="true" /></span><h2 id={`${id}-title`} className="font-display text-xl font-bold text-pitch">{avatar ? 'Chỉnh ảnh đại diện' : 'Chỉnh ảnh bìa'}</h2></div>
      <button type="button" autoFocus disabled={exporting} aria-label="Đóng chỉnh ảnh" onClick={onCancel} className="grid size-11 shrink-0 place-items-center rounded-control hover:bg-sunk disabled:opacity-50"><X className="size-5" aria-hidden="true" /></button>
    </div>
    <div className="space-y-5 p-5 sm:p-6">
      <p id={`${id}-description`} className="text-sm leading-6 text-ink-secondary">{avatar ? 'Đặt khuôn mặt trong vòng tròn để mọi người dễ nhận ra bạn.' : 'Chọn phần ảnh sẽ xuất hiện trên thẻ và trang giải đấu.'}</p>
      {!avatar && <div className="grid grid-cols-2 gap-1 rounded-control border border-hairline bg-sunk p-1" aria-label="Cách hiển thị ảnh bìa">{[[false, 'Cắt theo khung'], [true, 'Giữ toàn bộ ảnh']].map(([value, label]) => <button type="button" key={String(value)} disabled={exporting} aria-pressed={contain === value} onClick={() => setContain(value === true)} className={`min-h-11 rounded-slot px-2 text-xs font-semibold ${contain === value ? 'border border-strong bg-card text-pitch' : 'text-ink-secondary'}`}>{label}</button>)}</div>}
      <div ref={stage} aria-label="Khung cắt ảnh" className={`relative mx-auto touch-none overflow-hidden ${contain ? 'bg-pitch' : 'bg-sunk'} ${avatar ? 'aspect-square w-full max-w-72 rounded-full' : 'aspect-video w-full rounded-control'} ${size.width && !contain ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onPointerDown={event => { if (!size.width || exporting || contain) return; stage.current?.setPointerCapture(event.pointerId); pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, position: view }; }}
        onPointerMove={event => { const drag = pointer.current; const bounds = stage.current?.getBoundingClientRect(); if (!drag || drag.id !== event.pointerId || !bounds) return; setView(current => ({ ...current, x: overflowX > 0.001 ? Math.max(0, Math.min(100, drag.position.x - (event.clientX - drag.x) / (bounds.width * overflowX) * 100)) : 50, y: overflowY > 0.001 ? Math.max(0, Math.min(100, drag.position.y - (event.clientY - drag.y) / (bounds.height * overflowY) * 100)) : 50 })); }}
        onPointerUp={() => { pointer.current = null; }} onPointerCancel={() => { pointer.current = null; }}>
        {/* Plain image preserves exact natural dimensions for the canvas crop. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src && <img ref={image} src={src} alt="Ảnh đang chỉnh" draggable={false} onLoad={event => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={() => setError('Không đọc được ảnh này. Chọn ảnh khác nhé.')} className="pointer-events-none absolute max-w-none select-none" style={size.width ? { width: `${fittedWidth}%`, height: `${fittedHeight}%`, left: `${-(fittedWidth - 100) * (contain ? 50 : view.x) / 100}%`, top: `${-(fittedHeight - 100) * (contain ? 50 : view.y) / 100}%` } : { visibility: 'hidden' }} />}
        {!avatar && !contain && <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 border border-white/50">{Array.from({ length: 9 }, (_, i) => <span key={i} className="border border-white/20" />)}</div>}
      </div>
      <p className="flex items-center justify-center gap-2 text-xs leading-6 text-ink-secondary">{contain ? 'Giữ đủ nội dung poster, phần trống được thêm nền xanh.' : <><Move className="size-4 shrink-0" aria-hidden="true" />Kéo ảnh để chọn vị trí, hoặc dùng thanh bên dưới.</>}</p>
      {!contain && <fieldset disabled={exporting || !size.width} className="space-y-2">
        <label className="flex min-h-11 items-center gap-3 text-xs font-medium"><ZoomIn className="size-4 shrink-0 text-pitch" aria-hidden="true" /><span className="w-20 shrink-0">Phóng to</span><input aria-label="Phóng to ảnh" type="range" min="1" max="3" step="0.05" value={view.zoom} onChange={event => setView(current => ({ ...current, zoom: Number(event.target.value) }))} className="min-w-0 flex-1 accent-pitch" /><span className="w-10 text-right text-ink-secondary">{Math.round(view.zoom * 100)}%</span></label>
        {[['x', 'Trái / phải', overflowX], ['y', 'Trên / dưới', overflowY]].map(([axis, label, overflow]) => <label key={axis} className="flex min-h-11 items-center gap-3 text-xs font-medium"><span className="size-4 shrink-0" /><span className="w-20 shrink-0">{label}</span><input aria-label={String(label)} type="range" min="0" max="100" value={view[axis as 'x' | 'y']} disabled={Number(overflow) < 0.001 || exporting} onChange={event => setView(current => ({ ...current, [axis]: Number(event.target.value) }))} className="min-w-0 flex-1 accent-pitch disabled:opacity-40" /><span className="w-10" /></label>)}
      </fieldset>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-4">
        <button type="button" disabled={exporting} onClick={() => setView(initial)} className="inline-flex min-h-11 items-center gap-2 px-2 text-xs font-semibold text-ink-secondary"><RotateCcw className="size-4" aria-hidden="true" />Đặt lại</button>
        <div className="flex gap-2"><button type="button" disabled={exporting} onClick={onCancel} className="min-h-11 rounded-control border border-hairline px-4 text-sm font-semibold text-pitch">Hủy</button><button type="button" disabled={exporting || !size.width} onClick={() => void apply()} className="inline-flex min-h-11 items-center gap-2 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink disabled:opacity-50"><Check className="size-4" aria-hidden="true" />{exporting ? 'Đang xử lý…' : 'Dùng ảnh này'}</button></div>
      </div>
    </div>
  </dialog>;
}
