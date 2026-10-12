'use client';

import { useEffect, useRef, useState } from 'react';
import { enterMotion } from '@/lib/motion';
import Image from 'next/image';
import Link from 'next/link';
import { SceneFootball, SceneBadminton, ScenePickleball } from './pitch-scenes';
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react';

const SLIDES = [
  {
    key: 'football', label: 'Bóng đá',
    eyebrow: 'Hà Nội', title: 'Sân bóng cho cả đội',
    description: 'Tìm sân bóng còn chỗ, xem giá rõ ràng và giữ khung giờ cả đội cùng rảnh.',
    href: '/tim-san?sport=football5', cta: 'Tìm sân bóng',
  },
  {
    key: 'badminton', label: 'Cầu lông',
    eyebrow: 'Hà Nội', title: 'Đặt sân cầu lông',
    description: 'Tìm sân trong nhà hoặc ngoài trời. Chọn ngày để xem lịch trống và giá theo giờ.',
    href: '/tim-san?sport=badminton', cta: 'Chọn sân cầu lông',
  },
  {
    key: 'pickleball', label: 'Pickleball',
    eyebrow: 'Hà Nội', title: 'Tìm sân pickleball',
    description: 'Xem vị trí, ảnh sân và giờ còn trống. Chọn thời lượng phù hợp với buổi chơi của bạn.',
    href: '/tim-san?sport=pickleball', cta: 'Tìm sân pickleball',
  },
] as const;
const INTERVAL = 6500;
const SCENES = { football: SceneFootball, badminton: SceneBadminton, pickleball: ScenePickleball };

/** Prefer published venue photos; original illustrations cover missing/failed images. */
export type FeaturedVenuePhoto = { name: string; slug: string; district: string; image: string };

export function HeroCarousel({ photos = {} }: { photos?: Partial<Record<string, FeaturedVenuePhoto>> }) {
  const ref = useRef<HTMLDivElement>(null);
  const remaining = useRef(INTERVAL);
  const [index, setIndex] = useState(0);
  const [failedPhotos, setFailedPhotos] = useState<string[]>([]);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [motion, setMotion] = useState(false);
  const playing = motion && !paused && !hovered && !focused && visible;

  useEffect(() => {
    if (!motion) return;
    const effects = Array.from(ref.current?.querySelectorAll<HTMLElement>('[aria-hidden="false"] .pf-hero-copy') ?? []).map((element, i) => enterMotion(element, i * 0.065, 18));
    return () => effects.forEach(dispose => dispose());
  }, [index, motion]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setMotion(!media.matches);
    const syncVisibility = () => setVisible(!document.hidden);
    syncMotion(); syncVisibility();
    media.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      media.removeEventListener('change', syncMotion);
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, []);

  useEffect(() => { remaining.current = INTERVAL; }, [index, motion]);

  useEffect(() => {
    if (!playing) return;
    const started = performance.now();
    const timer = setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (performance.now() - started));
    };
  }, [playing, index]);

  function select(next: number) {
    setIndex((next + SLIDES.length) % SLIDES.length);
    setPaused(true);
  }

  return (
    <div ref={ref} data-hero-carousel="" data-motion={motion && !paused} data-playing={playing} style={{ '--pf-slide-duration': `${INTERVAL}ms` } as React.CSSProperties} role="region"
      aria-roledescription="carousel" aria-label="Tìm cảm hứng ra sân"
      className="relative isolate overflow-hidden bg-pitch"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault(); select(index + (event.key === 'ArrowLeft' ? -1 : 1));
        }
      }}>
      <div className="grid" aria-live={playing ? 'off' : 'polite'}>
        {SLIDES.map(({ key, label, eyebrow, title, description, href, cta }, i) => {
          const venue = photos[key];
          const source = venue?.image ?? '';
          const Scene = SCENES[key];
          const showPhoto = source && !failedPhotos.includes(source);
          return (
          <div key={key} role="group" aria-roledescription="slide" aria-label={`${i + 1} / ${SLIDES.length} · ${label}`}
            aria-hidden={i !== index} inert={i !== index}
            className={`relative col-start-1 row-start-1 flex min-w-0 transition-opacity duration-700 motion-reduce:transition-none ${i === index ? 'z-10 opacity-100' : 'pointer-events-none opacity-0'}`}>
            <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
              {showPhoto ? <Image src={source} alt="" fill priority={i === 0} sizes="100vw"
                data-venue-photo={venue ? venue.slug : undefined} onError={() => setFailedPhotos(current => [...current, source])}
                className="pf-hero-image object-cover object-[65%_center]" /> : <Scene className="pf-hero-image h-full w-full" />}
              <div className="absolute inset-0 bg-gradient-to-r from-pitch/95 via-pitch/75 to-pitch/20" />
              <div className="absolute inset-0 bg-gradient-to-t from-pitch/65 via-transparent to-transparent" />
            </div>
            <div className="mx-auto flex min-h-[480px] min-w-0 w-full max-w-7xl items-center px-[56px] pb-28 pt-12 sm:min-h-[460px] sm:px-16 lg:px-20">
              <div className="w-full min-w-0 max-w-lg text-white">
                <p className="mb-4 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-free-fill">
                  <span className="h-px w-6 bg-free-line" aria-hidden="true" />{label} · {venue?.district ?? eyebrow}
                </p>
                <h2 className="pf-hero-copy break-words font-display text-[36px] font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[56px]">
                  {venue?.name ?? title}
                </h2>
                <p className="pf-hero-copy pf-hero-description mt-4 max-w-sm text-sm leading-6 text-free-fill sm:text-[15px] sm:leading-7">{venue ? `Xem ảnh, lịch trống và giá tại ${venue.name}. Chọn giờ phù hợp trước khi giữ chỗ.` : description}</p>
                <div className="pf-hero-copy pf-hero-cta">
                  <Link href={venue ? `/san/${encodeURIComponent(venue.slug)}#lich-san` : href} className="pf-action mt-6 inline-flex min-h-11 max-w-full items-center justify-center gap-3 rounded-control border border-card bg-card px-4 text-sm font-semibold text-pitch hover:bg-free-fill">
                    <span className="min-w-0 break-words">{venue ? 'Xem lịch sân này' : cta}</span><ArrowRight size={16} className="pf-arrow shrink-0" aria-hidden="true" />
                  </Link>
                  <p className="mt-3 text-xs leading-5 text-free-fill/90">{showPhoto && venue ? `Ảnh cụm sân do chủ sân cung cấp · ${venue.name}` : venue ? 'Minh họa môn thể thao · Chưa tải được ảnh cụm sân' : 'Minh họa môn thể thao'}</p>
                </div>
              </div>
            </div>
          </div>
        ); })}
      </div>
      <button type="button" onClick={() => select(index - 1)} aria-label="Ảnh trước"
        className="pf-action absolute left-1.5 top-1/2 z-20 grid size-[44px] -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-pitch/70 text-white hover:bg-pitch focus-visible:outline-free-line sm:left-3 lg:left-6">
        <ArrowLeft size={19} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => select(index + 1)} aria-label="Ảnh tiếp theo"
        className="pf-action absolute right-1.5 top-1/2 z-20 grid size-[44px] -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-pitch/70 text-white hover:bg-pitch focus-visible:outline-free-line sm:right-3 lg:right-6">
        <ArrowRight size={19} aria-hidden="true" />
      </button>
      <div className="absolute inset-x-0 bottom-4 z-20 mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-5 sm:px-16 lg:px-20">
        <div role="group" aria-label="Chọn môn giới thiệu" className="flex gap-1">
          {SLIDES.map((slide, i) => <button key={slide.key} type="button" onClick={() => select(i)} aria-label={`Xem ${slide.label}`} aria-pressed={i === index}
            className={`pf-hero-tab relative min-h-11 overflow-hidden rounded-control px-2.5 text-[11px] font-semibold sm:px-4 sm:text-xs ${i === index ? 'bg-card text-pitch' : 'bg-pitch/70 text-free-fill hover:bg-pitch'}`}>
            {slide.label}
            {i === index && <span key={`${index}-${paused}`} aria-hidden="true" className="pf-hero-progress absolute inset-x-0 bottom-0 h-0.5 origin-left bg-free-line" />}
          </button>)}
        </div>
        <button type="button" onClick={() => { remaining.current = INTERVAL; setPaused(value => !value); }} aria-label={paused ? 'Tiếp tục chuyển ảnh' : 'Dừng chuyển ảnh'} aria-pressed={paused}
          className="inline-flex min-h-11 items-center gap-2 rounded-control border border-white/30 bg-pitch px-3 text-xs font-semibold text-white">
          {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}<span className="hidden sm:inline">{paused ? 'Tiếp tục' : 'Dừng chuyển ảnh'}</span>
        </button>
      </div>
    </div>
  );
}
