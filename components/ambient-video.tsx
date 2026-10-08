'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Pause, Play } from 'lucide-react';

/** Chỉ tải/chạy video khi vào màn hình, không chạy khi giảm chuyển động/tiết kiệm dữ liệu. */
export function AmbientVideo() {
  const host = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; addEventListener?: (event: string, fn: () => void) => void; removeEventListener?: (event: string, fn: () => void) => void } }).connection;
    const sync = () => setAllowed(!media.matches && !connection?.saveData);
    const visibility = () => setVisible(!document.hidden);
    sync(); visibility();
    media.addEventListener('change', sync);
    connection?.addEventListener?.('change', sync);
    document.addEventListener('visibilitychange', visibility);
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.15 });
    if (host.current) observer?.observe(host.current);
    return () => {
      observer?.disconnect(); media.removeEventListener('change', sync);
      connection?.removeEventListener?.('change', sync);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  const shouldPlay = allowed && inView && visible && !paused && !failed;
  useEffect(() => {
    if (shouldPlay) setLoaded(true);
    const element = video.current;
    if (!element) return;
    let cancelled = false;
    if (shouldPlay) {
      void element.play().then(() => {
        if (cancelled) return;
        setPlaying(true);
      }).catch(() => { if (!cancelled) setPlaying(false); });
    } else { element.pause(); setPlaying(false); }
    return () => { cancelled = true; element.pause(); };
  }, [shouldPlay, loaded]);

  return <div ref={host} className="absolute inset-0">
    <Image src="/media/soccer-poster.webp" alt="" fill sizes="(min-width: 1280px) 1152px, 100vw" className="object-cover" aria-hidden="true" />
    {loaded && !failed && <video ref={video} className={`pf-ambient-video absolute inset-0 h-full w-full object-cover ${playing ? 'opacity-100' : 'opacity-0'}`}
      muted loop playsInline preload="none" poster="/media/soccer-poster.webp" aria-hidden="true" onError={() => { setFailed(true); setPlaying(false); }}>
      <source src="/videos/soccer-one-on-one.mp4" type="video/mp4" onError={() => { setFailed(true); setPlaying(false); }} />
    </video>}
    {allowed && !failed && <button type="button" onClick={() => {
      if (playing) { setPaused(true); return; }
      setPaused(false);
      void video.current?.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }}
      aria-label={playing ? 'Dừng video nền' : 'Phát video nền'}
      className="pf-action absolute bottom-4 right-4 z-20 flex min-h-11 items-center gap-2 rounded-control border border-white/30 bg-pitch/90 px-3 text-xs font-semibold text-white hover:bg-pitch">
      {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}{playing ? 'Dừng video' : 'Phát video'}
    </button>}
  </div>;
}