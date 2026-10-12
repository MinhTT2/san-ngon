'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

/** Chỉ tải/chạy video khi vào màn hình, không chạy khi giảm chuyển động/tiết kiệm dữ liệu. */
export function AmbientVideo({ scene = 'soccer' }: { scene?: 'soccer' | 'court' }) {
  const poster = scene === 'court' ? '/media/court-flow.webp' : '/media/soccer-poster.webp';
  const source = scene === 'court' ? '/videos/court-flow.webm' : '/videos/soccer-one-on-one.mp4';
  const host = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
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

  const shouldPlay = allowed && inView && visible && !failed;
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

  return <div ref={host} data-ambient-scene={scene} className="absolute inset-0">
    <Image src={poster} alt="" fill sizes={scene === 'court' ? '(min-width: 1024px) 480px, 100vw' : '(min-width: 1280px) 1152px, 100vw'} className="object-cover" aria-hidden="true" />
    {loaded && !failed && <video ref={video} className={`pf-ambient-video absolute inset-0 h-full w-full object-cover ${playing ? 'opacity-100' : 'opacity-0'}`}
      muted loop playsInline preload="none" poster={poster} aria-hidden="true" onError={() => { setFailed(true); setPlaying(false); }}>
      <source src={source} type={scene === 'court' ? 'video/webm' : 'video/mp4'} onError={() => { setFailed(true); setPlaying(false); }} />
    </video>}
  </div>;
}
