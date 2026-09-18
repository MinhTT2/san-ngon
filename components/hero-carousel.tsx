'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SceneFootball, SceneBadminton, ScenePickleball } from './pitch-scenes';

const SLIDES = [
  {
    key: 'football', label: 'Bóng đá', Scene: SceneFootball,
    eyebrow: 'Tan làm. Lên sân.',
    title: 'Đủ đội rồi.', accent: 'Chốt sân thôi.',
    description: 'Kèo tối nay không cần thêm một cuộc gọi. Xem giờ trống, chọn sân và giữ chỗ cho cả đội ngay trên Sân Ngon.',
    href: '/tim-san?sport=football5', cta: 'Tìm sân bóng 5 người',
    layout: 'mr-auto max-w-2xl text-white',
    heading: 'text-[44px] sm:text-[60px] lg:text-[76px]',
    overlay: 'bg-gradient-to-r from-pitch/95 via-pitch/65 to-pitch/10',
  },
  {
    key: 'badminton', label: 'Cầu lông', Scene: SceneBadminton,
    eyebrow: 'Một giờ dành cho mình',
    title: 'Gác việc lại.', accent: 'Cầm vợt lên.',
    description: 'Đánh đơn hay đánh đôi, một buổi cầu lông là lý do vừa đủ để rời màn hình. Chọn giờ hợp lịch và hẹn nhau ở sân.',
    href: '/tim-san?sport=badminton', cta: 'Chọn sân cầu lông',
    layout: 'ml-auto max-w-lg rounded-card border border-strong bg-free-fill p-6 text-pitch sm:p-9',
    heading: 'text-[36px] sm:text-[44px] lg:text-[52px]',
    overlay: 'bg-gradient-to-l from-pitch/65 via-pitch/20 to-transparent',
  },
  {
    key: 'pickleball', label: 'Pickleball', Scene: ScenePickleball,
    eyebrow: 'Hẹn nhau một kèo mới',
    title: 'Ít lướt màn hình.', accent: 'Thêm một trận vui.',
    description: 'Rủ hội bạn ra sân, thử vài đường bóng mới. Lịch trống và giá sân có sẵn, chỉ còn chọn giờ cả nhóm cùng rảnh.',
    href: '/tim-san?sport=pickleball', cta: 'Khám phá sân pickleball',
    layout: 'mx-auto max-w-3xl text-center text-white',
    heading: 'text-[40px] sm:text-[56px] lg:text-[68px]',
    overlay: 'bg-pitch/45',
  },
] as const;

const INTERVAL = 5000;

/** Ảnh và nội dung đổi cùng nhau; form tìm sân nằm ngoài để giữ nguyên dữ liệu đang nhập. */
export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const playing = autoplay && !hovered && !focused;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setAutoplay(!media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL);
    return () => clearTimeout(timer);
  }, [playing, index]);

  function move(direction: number) {
    setIndex((i) => (i + direction + SLIDES.length) % SLIDES.length);
  }

  return (
    <div
      data-hero-carousel=""
      role="region"
      aria-roledescription="carousel"
      aria-label="Tìm cảm hứng ra sân"
      className="relative isolate overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          move(event.key === 'ArrowLeft' ? -1 : 1);
        }
      }}
    >
      <div className="grid" aria-live={playing ? 'off' : 'polite'}>
        {SLIDES.map(({ key, label, Scene, eyebrow, title, accent, description, href, cta, layout, heading, overlay }, i) => (
          <div
            key={key}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${SLIDES.length} · ${label}`}
            aria-hidden={i !== index}
            inert={i !== index}
            className={`relative col-start-1 row-start-1 flex transition-opacity duration-700 motion-reduce:transition-none ${i === index ? 'z-10 opacity-100' : 'pointer-events-none opacity-0'}`}
          >
            <div aria-hidden="true" className="absolute inset-0 -z-10">
              <Scene className="absolute inset-0 h-full w-full" />
              <div className={`absolute inset-0 ${overlay}`} />
            </div>
            <div className="mx-auto flex min-h-[480px] w-full max-w-7xl items-center px-5 py-10 sm:min-h-[500px] lg:min-h-[540px] lg:px-16 lg:py-12">
              <div className={`w-full ${layout}`}>
                <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] sm:text-sm">
                  {label} <span aria-hidden="true" className="mx-2 opacity-50">/</span> {eyebrow}
                </p>
                <h2 className={`font-display font-extrabold leading-[1.06] tracking-[-0.035em] ${heading}`}>
                  {title}<br />
                  <span className={key === 'badminton' ? 'text-ink-secondary' : 'text-free-line'}>{accent}</span>
                </h2>
                <p className={`mt-5 max-w-lg text-[15px] leading-7 sm:text-base ${key === 'pickleball' ? 'mx-auto' : ''}`}>
                  {description}
                </p>
                <Link
                  href={href}
                  className={`mt-7 inline-flex min-h-12 items-center justify-center gap-4 rounded-control border px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 ${
                    key === 'badminton'
                      ? 'border-pitch bg-pitch text-white hover:bg-ink'
                      : key === 'pickleball'
                        ? 'border-free-line text-white hover:bg-pitch'
                        : 'border-card bg-card text-pitch hover:bg-free-fill'
                  }`}
                >
                  {cta}<span aria-hidden="true">↗</span>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => move(-1)}
        aria-label="Ảnh trước"
        className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-free-line/40 bg-pitch/45 text-white backdrop-blur-sm hover:bg-pitch/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-free-line lg:left-6"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="rotate-180">
          <path d="M4 10h12m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => move(1)}
        aria-label="Ảnh tiếp theo"
        className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-free-line/40 bg-pitch/45 text-white backdrop-blur-sm hover:bg-pitch/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-free-line lg:right-6"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M4 10h12m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="relative z-20 mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 pb-6 pt-2 text-white lg:px-16">
        <div className="flex items-center gap-1" aria-label="Chọn môn thể thao">
          {SLIDES.map(({ key, label }, i) => (
            <button
              key={key}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Xem ảnh ${label}`}
              aria-current={i === index ? 'true' : undefined}
              className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-free-line"
            >
              <span className={`h-1.5 rounded-pill transition-all ${i === index ? 'w-8 bg-free-fill' : 'w-2 bg-free-line/50'}`} />
            </button>
          ))}
          <span aria-hidden="true" className="ml-3 hidden text-xs font-medium text-free-line sm:inline">
            0{index + 1} / 0{SLIDES.length} · {SLIDES[index].label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoplay((value) => !value)}
            aria-label={autoplay ? 'Tạm dừng tự chuyển ảnh' : 'Bật tự chuyển ảnh'}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-free-line/40 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              {autoplay ? <path d="M4 3h3v10H4zM9 3h3v10H9z" /> : <path d="m5 2 9 6-9 6z" />}
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
