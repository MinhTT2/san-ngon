'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react';

const SLIDES = [
  {
    key: 'football', label: 'Bóng đá', image: '/media/football-editorial.webp',
    eyebrow: 'Kèo tối nay', title: 'Đủ đội rồi.', accent: 'Ra sân thôi.',
    description: 'Tìm sân bóng còn chỗ, xem giá rõ ràng và giữ khung giờ cả đội cùng rảnh.',
    href: '/tim-san?sport=football5', cta: 'Tìm sân bóng',
  },
  {
    key: 'badminton', label: 'Cầu lông', image: '/media/badminton-editorial.webp',
    eyebrow: 'Một giờ cho mình', title: 'Gác việc lại.', accent: 'Cầm vợt lên.',
    description: 'Sân gần nhà, giờ đẹp, giá rõ ràng. Chọn một khung giờ và hẹn nhau ở sân.',
    href: '/tim-san?sport=badminton', cta: 'Chọn sân cầu lông',
  },
  {
    key: 'pickleball', label: 'Pickleball', image: '/media/pickleball-editorial.webp',
    eyebrow: 'Hẹn nhau cuối tuần', title: 'Rủ hội bạn.', accent: 'Ra sân vui hơn.',
    description: 'Thử một môn mới, chọn sân còn chỗ và chốt lịch thật nhanh.',
    href: '/tim-san?sport=pickleball', cta: 'Tìm sân pickleball',
  },
] as const;
const INTERVAL = 6500;

/** Ảnh minh họa giới thiệu môn; ảnh địa điểm thật vẫn do chủ sân cung cấp. */
export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [motion, setMotion] = useState(false);
  const playing = motion && !paused && !hovered && !focused && visible;

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

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL);
    return () => clearTimeout(timer);
  }, [playing, index]);

  function select(next: number) {
    setIndex((next + SLIDES.length) % SLIDES.length);
    setPaused(true);
  }

  return (
    <div data-hero-carousel="" data-motion={motion && !paused} data-playing={playing} role="region"
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
        {SLIDES.map(({ key, label, image, eyebrow, title, accent, description, href, cta }, i) => (
          <div key={key} role="group" aria-roledescription="slide" aria-label={`${i + 1} / ${SLIDES.length} · ${label}`}
            aria-hidden={i !== index} inert={i !== index}
            className={`relative col-start-1 row-start-1 flex transition-opacity duration-700 motion-reduce:transition-none ${i === index ? 'z-10 opacity-100' : 'pointer-events-none opacity-0'}`}>
            <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
              <Image src={image} alt="" fill priority={i === 0} sizes="100vw"
                className="pf-hero-image object-cover object-[65%_center]" />
              <div className="absolute inset-0 bg-gradient-to-r from-pitch/95 via-pitch/75 to-pitch/20" />
              <div className="absolute inset-0 bg-gradient-to-t from-pitch/65 via-transparent to-transparent" />
            </div>
            <div className="mx-auto flex min-h-[430px] w-full max-w-7xl items-center px-5 pb-28 pt-10 sm:min-h-[440px] lg:px-16">
              <div className="w-full max-w-lg text-white">
                <p className="mb-4 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-free-fill">
                  <span className="h-px w-6 bg-free-line" aria-hidden="true" />{label} · {eyebrow}
                </p>
                <h2 className="pf-hero-copy font-display text-[40px] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-[60px]">
                  {title}<br /><span className="text-free-line">{accent}</span>
                </h2>
                <p className="pf-hero-copy pf-hero-description mt-4 max-w-sm text-sm leading-6 text-free-fill sm:text-[15px] sm:leading-7">{description}</p>
                <div className="pf-hero-copy pf-hero-cta">
                  <Link href={href} className="pf-action mt-6 inline-flex min-h-11 items-center justify-center gap-3 rounded-control border border-card bg-card px-4 text-sm font-semibold text-pitch hover:bg-free-fill">
                    {cta}<ArrowRight size={16} className="pf-arrow" aria-hidden="true" />
                  </Link>
                  <p className="mt-3 text-[11px] text-free-fill/80">Xem lịch miễn phí · Đăng nhập khi đặt</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="absolute right-5 top-3 z-20 rounded-pill bg-pitch/70 px-2.5 py-1 text-[10px] text-free-fill">Ảnh minh họa</div>
      <div className="absolute inset-x-0 bottom-0 z-20 border-t border-white/15 bg-pitch/45">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 px-5 py-2.5 lg:px-16">
          <div className="flex items-center gap-1" aria-label="Chọn môn giới thiệu">
            {SLIDES.map((slide, i) => <button key={slide.key} type="button" aria-label={`Xem ${slide.label}`}
              aria-pressed={index === i} onClick={() => select(i)}
              className={`pf-action relative min-h-11 rounded-control px-3 text-xs font-semibold sm:px-4 sm:text-sm ${index === i ? 'bg-white/15 text-white' : 'text-free-line hover:bg-white/10 hover:text-white'}`}>
              {slide.label}<span aria-hidden="true" className={`absolute bottom-1 left-3 right-3 h-0.5 rounded-full ${index === i ? 'bg-free-line' : 'bg-transparent'}`} />
            </button>)}
          </div>
          <div className="flex items-center gap-1 text-white">
            <button type="button" onClick={() => select(index - 1)} aria-label="Ảnh trước" className="pf-action grid size-11 place-items-center rounded-control hover:bg-white/15"><ArrowLeft size={17} aria-hidden="true" /></button>
            <button type="button" onClick={() => setPaused((value) => !value)} disabled={!motion}
              aria-label={paused || !motion ? 'Tự chuyển ảnh' : 'Dừng tự chuyển ảnh'} aria-pressed={!paused && motion}
              className="pf-action grid size-11 place-items-center rounded-control hover:bg-white/15 disabled:opacity-45">
              {paused || !motion ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => select(index + 1)} aria-label="Ảnh tiếp theo" className="pf-action grid size-11 place-items-center rounded-control hover:bg-white/15"><ArrowRight size={17} aria-hidden="true" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}