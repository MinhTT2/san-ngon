'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, X } from 'lucide-react';

/** Explicit play only: no video request, autoplay or sound before a user's click. */
export function TournamentGuideVideo() {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const opener = trigger.current;
    element?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const pause = () => { if (document.hidden) video.current?.pause(); };
    document.addEventListener('visibilitychange', pause);
    return () => {
      element?.querySelector('video')?.pause(); element?.close();
      document.body.style.overflow = previous;
      document.removeEventListener('visibilitychange', pause);
      opener?.focus();
    };
  }, [open]);
  return <>
    <button ref={trigger} type="button" onClick={() => { setFailed(false); setOpen(true); }} aria-haspopup="dialog" aria-label="Xem video hướng dẫn tham gia giải" className="group relative mt-5 block aspect-video w-full overflow-hidden rounded-control border border-free-line/35 bg-pitch text-left">
      <Image src="/media/tournament-guide.webp" alt="" fill sizes="(min-width: 1024px) 256px, 100vw" className="object-cover" />
      <span className="absolute inset-0 bg-pitch/15" />
      <span className="absolute inset-0 grid place-items-center"><span className="pf-action grid size-12 place-items-center rounded-full border border-white/40 bg-card text-pitch group-hover:bg-free-fill"><Play size={20} aria-hidden="true" className="ml-0.5" /></span></span>
      <span className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-3 bg-pitch/95 px-3 py-2.5 text-[11px] font-semibold text-pitch-ink"><span>Xem cách tham gia giải</span><span className="shrink-0 text-free-line">18 giây</span></span>
    </button>
    <noscript><a href="/videos/tournament-guide.webm" className="inline-flex min-h-11 items-center text-xs font-semibold text-pitch-ink underline">Mở video hướng dẫn</a></noscript>
    {open && <dialog ref={dialog} aria-labelledby="tournament-video-title" onCancel={event => { event.preventDefault(); setOpen(false); }} onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) setOpen(false); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_32px)] max-w-4xl overflow-y-auto rounded-card border border-strong bg-card p-0 text-ink backdrop:bg-pitch/80">
      <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-3"><h2 id="tournament-video-title" className="font-display text-xl font-bold text-pitch">Từ đăng ký đến ra sân</h2><button type="button" aria-label="Đóng video" onClick={() => setOpen(false)} className="grid size-11 shrink-0 place-items-center rounded-control border border-hairline text-pitch"><X size={20} aria-hidden="true" /></button></div>
      {failed ? <div className="space-y-4 bg-free-fill p-6"><p role="status" className="text-sm leading-7">Video chưa tải được. Bạn vẫn có thể xem ba bước bên dưới hoặc thử lại.</p><button type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1); }} className="inline-flex min-h-11 items-center gap-2 rounded-control border border-strong bg-card px-4 text-sm font-semibold text-pitch"><RotateCcw size={16} aria-hidden="true" />Thử lại video</button></div> : <video key={attempt} ref={video} controls autoPlay muted playsInline preload="none" poster="/media/tournament-guide.webp" aria-label="Video hướng dẫn tham gia giải đấu Sân Ngon" aria-describedby="tournament-video-transcript" className="aspect-video w-full bg-pitch" onError={() => setFailed(true)}><source src="/videos/tournament-guide.webm" type="video/webm" onError={() => setFailed(true)} /></video>}
      <div id="tournament-video-transcript" className="p-5"><p className="text-xs font-semibold text-ink-secondary">Video hướng dẫn bằng đồ họa · Không có âm thanh</p><ol className="mt-4 grid gap-4 text-sm leading-7 sm:grid-cols-3">{[['Chọn giải phù hợp', 'Xem lịch, môn thi đấu, thể lệ và lệ phí.'], ['Gửi đăng ký', 'Chờ ban tổ chức duyệt người hoặc đội.'], ['Đóng cọc sau duyệt', 'Chuyển đủ cọc trước hạn để xác nhận suất.']].map(([title, description], index) => <li key={title}><p className="font-semibold text-pitch">0{index + 1} · {title}</p><p className="mt-1 text-xs leading-6 text-ink-secondary">{description}</p></li>)}</ol></div>
    </dialog>}
  </>;
}