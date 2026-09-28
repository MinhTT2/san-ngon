'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight, Expand, Images, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const photoUrl = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/venue-photos/${path}`;
const initialView = { scale: 1, x: 0, y: 0 };
const viewerButton = 'grid size-11 shrink-0 place-items-center rounded-full border border-white/20 bg-ink text-white hover:bg-white/15 aria-disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

export function VenueGallery({ images, name }: { images: string[]; name: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  if (!images.length) return null;

  return <section aria-label={`Ảnh ${name}`} className="mb-6">
    <div className={`grid h-72 grid-rows-2 gap-2 overflow-hidden rounded-card sm:h-[460px] ${images.length >= 5 ? 'grid-cols-[2fr_1fr] lg:grid-cols-[2fr_1fr_1fr]' : images.length > 1 ? 'grid-cols-[2fr_1fr]' : 'grid-cols-1'}`}>
      {images.slice(0, images.length >= 5 ? 5 : 3).map((path, index) => (
        <button key={`${path}-${index}`} type="button" onClick={() => setSelected(index)}
          aria-label={`Mở ảnh ${index + 1} của ${name}`}
          className={`group relative min-h-0 overflow-hidden bg-sunk focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white ${index === 0 || images.length === 2 ? 'row-span-2' : ''} ${index >= 3 ? 'hidden lg:block' : ''}`}>
          <Image unoptimized fill priority={index === 0} src={photoUrl(path)} alt={`${name} · ảnh ${index + 1}`}
            className="object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.03]" />
          {index === 0 && <span className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-pill border border-white/25 bg-ink/80 px-3 py-2 text-xs font-medium text-white sm:bottom-5 sm:left-5"><Expand className="size-4" aria-hidden="true" /><span>Xem ảnh lớn</span></span>}
          {index === 2 && images.length > 3 && <span className={`absolute inset-0 grid place-items-center bg-ink/45 text-lg font-semibold text-white ${images.length >= 5 ? 'lg:hidden' : ''}`}>+{images.length - 3} ảnh</span>}
          {index === 4 && images.length > 5 && <span className="absolute inset-0 grid place-items-center bg-ink/45 text-lg font-semibold text-white">+{images.length - 5} ảnh</span>}
        </button>
      ))}
    </div>
    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink-secondary sm:text-sm">
      <span>Ảnh do chủ sân cung cấp · Bấm để xem đầy đủ</span>
      <button type="button" onClick={() => setSelected(0)} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control border border-hairline bg-card px-3 font-semibold text-pitch hover:border-pitch focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"><Images className="size-4" aria-hidden="true" />Tất cả {images.length} ảnh</button>
    </div>
    {selected !== null && <PhotoViewer images={images} name={name} start={selected} onClose={() => setSelected(null)} />}
  </section>;
}

function PhotoViewer({ images, name, start, onClose }: { images: string[]; name: string; start: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLImageElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; view: typeof initialView } | null>(null);
  const [selected, setSelected] = useState(start);
  const [view, setView] = useState(initialView);
  const [dragging, setDragging] = useState(false);
  const [swipe, setSwipe] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 1600, height: 1200 });
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const source = photoUrl(images[selected]);
  const ready = loaded === source && failed !== source;

  // Giới hạn kéo theo kích thước ảnh thật, kể cả ảnh dọc và màn hình nhỏ.
  const bounded = useCallback((next: typeof initialView) => {
    const width = stage.current?.clientWidth ?? 0;
    const height = stage.current?.clientHeight ?? 0;
    const maxX = Math.max(0, ((photo.current?.offsetWidth ?? 0) * next.scale - width) / 2);
    const maxY = Math.max(0, ((photo.current?.offsetHeight ?? 0) * next.scale - height) / 2);
    return { scale: next.scale, x: Math.max(-maxX, Math.min(maxX, next.x)), y: Math.max(-maxY, Math.min(maxY, next.y)) };
  }, []);

  const endDrag = useCallback(() => {
    const pointer = drag.current;
    drag.current = null;
    if (pointer && stage.current?.hasPointerCapture(pointer.id)) stage.current.releasePointerCapture(pointer.id);
    setDragging(false);
    setSwipe(0);
  }, []);

  const zoom = useCallback((delta: number, clientX?: number, clientY?: number) => {
    endDrag();
    const rect = stage.current?.getBoundingClientRect();
    const x = rect && clientX !== undefined ? clientX - rect.left - rect.width / 2 : 0;
    const y = rect && clientY !== undefined ? clientY - rect.top - rect.height / 2 : 0;
    setView(previous => {
      const scale = Math.max(1, Math.min(4, previous.scale + delta));
      const ratio = scale / previous.scale;
      return bounded({ scale, x: x - (x - previous.x) * ratio, y: y - (y - previous.y) * ratio });
    });
  }, [bounded, endDrag]);

  function reset() {
    endDrag();
    setView(initialView);
  }

  function select(index: number) {
    setSelected((index + images.length) % images.length);
    reset();
  }

  useEffect(() => {
    const element = dialog.current!;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    const reset = () => { endDrag(); setView(initialView); };
    window.addEventListener('resize', reset);
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('resize', reset);
      if (trigger instanceof HTMLElement) trigger.focus({ preventScroll: true });
    };
  }, [endDrag]);

  useEffect(() => {
    const element = stage.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (ready && event.deltaY !== 0) zoom(event.deltaY < 0 ? 0.25 : -0.25, event.clientX, event.clientY);
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [ready, zoom]);

  useEffect(() => {
    dialog.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected]);

  return <dialog ref={dialog} aria-label={`Ảnh ${name}`} onCancel={onClose}
    onKeyDown={event => {
      if (event.key === 'Tab') {
        const buttons = event.currentTarget.querySelectorAll('button');
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      if (['ArrowRight', 'ArrowLeft', '+', '=', '-', '0'].includes(event.key)) {
        event.preventDefault();
        if (event.key === 'ArrowRight') select(selected + 1);
        else if (event.key === 'ArrowLeft') select(selected - 1);
        else if (event.key === '0') reset();
        else if (ready) zoom(event.key === '-' ? -0.5 : 0.5);
      }
    }}
    className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none touch-manipulation overflow-hidden border-0 bg-ink p-0 text-white backdrop:bg-ink">
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/15 px-4 py-3 sm:px-8 sm:py-4">
        <div className="min-w-0"><p className="truncate font-display text-lg font-bold sm:text-xl">{name}</p><p aria-live="polite" className="mt-1 text-xs text-white/65">Ảnh {selected + 1} / {images.length}{selected === 0 ? ' · Ảnh bìa' : ''}<span className="hidden sm:inline">{ready ? ` · ${dimensions.width} × ${dimensions.height} px` : ''}</span></p></div>
        <button type="button" onClick={onClose} aria-label="Đóng ảnh" className={viewerButton}><X className="size-5" aria-hidden="true" /></button>
      </header>
      <div className="relative min-h-0 flex-1">
        <div ref={stage} data-gallery-stage className={`absolute inset-0 flex touch-none select-none items-center justify-center overflow-hidden [container-type:size] ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onDoubleClick={event => {
            if (!ready) return;
            if (view.scale > 1) reset();
            else zoom(1, event.clientX, event.clientY);
          }}
          onPointerDown={event => {
            if (!event.isPrimary) { endDrag(); return; }
            if (event.button !== 0 || drag.current || (view.scale > 1 && !ready)) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view };
            setDragging(true);
          }}
          onPointerMove={event => {
            const previous = drag.current;
            if (!previous || previous.id !== event.pointerId) return;
            const dx = event.clientX - previous.x;
            const dy = event.clientY - previous.y;
            if (previous.view.scale === 1) {
              if (images.length > 1) setSwipe(Math.max(-100, Math.min(100, dx * 0.35)));
            } else setView(bounded({ ...previous.view, x: previous.view.x + dx, y: previous.view.y + dy }));
          }}
          onPointerUp={event => {
            const previous = drag.current;
            if (!previous || previous.id !== event.pointerId) return;
            const dx = event.clientX - previous.x;
            const dy = event.clientY - previous.y;
            endDrag();
            if (previous.view.scale === 1 && images.length > 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) select(selected + (dx < 0 ? 1 : -1));
          }}
          onLostPointerCapture={endDrag}
          onPointerCancel={endDrag}>
          {!ready && <p role="status" className="absolute px-16 text-center text-sm text-white/75">{failed === source ? 'Chưa tải được ảnh này. Bạn thử chọn ảnh khác nhé.' : 'Đang tải ảnh…'}</p>}
          <Image key={source} ref={photo} unoptimized src={source} alt={`${name} · ảnh ${selected + 1}`}
            width={dimensions.width} height={dimensions.height} draggable={false}
            onLoad={event => { setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); setLoaded(source); setFailed(null); }} onError={() => setFailed(source)}
            className={`h-auto max-h-full w-auto max-w-full shrink-0 object-contain ${ready ? '' : 'invisible'}`}
            style={{ width: `min(100%, ${100 * dimensions.width / dimensions.height}cqh)`, transform: `translate(${view.x + swipe}px, ${view.y}px) scale(${view.scale})` }} />
        </div>
        {images.length > 1 && <>
          <button type="button" aria-label="Ảnh trước" onClick={() => select(selected - 1)} className={`${viewerButton} absolute left-3 top-1/2 -translate-y-1/2 sm:left-6`}><ChevronLeft className="size-5" aria-hidden="true" /></button>
          <button type="button" aria-label="Ảnh tiếp theo" onClick={() => select(selected + 1)} className={`${viewerButton} absolute right-3 top-1/2 -translate-y-1/2 sm:right-6`}><ChevronRight className="size-5" aria-hidden="true" /></button>
        </>}
      </div>
      <footer className="shrink-0 border-t border-white/15 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8">
        <div className="flex items-center justify-center gap-2">
          <button type="button" aria-label="Thu nhỏ" aria-disabled={!ready || view.scale <= 1} onClick={() => { if (ready) zoom(-0.5); }} className={viewerButton}><ZoomOut className="size-5" aria-hidden="true" /></button>
          <output aria-label="Mức phóng to" className="w-14 text-center text-sm tabular-nums">{Math.round(view.scale * 100)}%</output>
          <button type="button" aria-label="Phóng to" aria-disabled={!ready || view.scale >= 4} onClick={() => { if (ready) zoom(0.5); }} className={viewerButton}><ZoomIn className="size-5" aria-hidden="true" /></button>
          <button type="button" aria-label="Vừa khung ảnh" aria-disabled={view.scale === 1} onClick={reset} className={`${viewerButton} w-auto grid-flow-col gap-2 px-3`}><RotateCcw className="size-4" aria-hidden="true" /><span className="text-xs">Vừa khung</span></button>
        </div>
        <p className="mt-2 text-center text-[11px] text-white/60">{view.scale > 1 ? 'Kéo ảnh để xem chi tiết · Bấm Vừa khung để xem toàn bộ' : images.length > 1 ? 'Kéo trái / phải để chuyển ảnh · Bấm + để xem chi tiết' : 'Bấm + để xem chi tiết'}<span className="hidden sm:inline"> · Lăn chuột hoặc nhấp đúp để phóng to · Esc để đóng</span></p>
        {images.length > 1 && <div className="mx-auto mt-3 flex w-fit max-w-full gap-2 overflow-x-auto p-1">
          {images.map((path, index) => <button key={`${path}-${index}`} type="button" aria-label={`Xem ảnh ${index + 1}`} aria-pressed={selected === index} onClick={() => select(index)}
            className={`pf-gallery-thumb relative h-12 w-16 shrink-0 overflow-hidden rounded-control border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:h-14 sm:w-20 ${selected === index ? 'border-white' : 'border-transparent opacity-55 hover:opacity-100'}`}>
            <Image unoptimized fill src={photoUrl(path)} alt="" className="object-cover" />
            <span aria-hidden="true" className="absolute bottom-0 left-0 rounded-tr-control bg-ink/80 px-1.5 py-0.5 text-[10px] text-white">{index + 1}</span>
          </button>)}
        </div>}
      </footer>
    </div>
  </dialog>;
}
