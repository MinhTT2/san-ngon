'use client';

import { useCallback, useEffect, useState } from 'react';
import { SceneFootball, SceneBadminton, ScenePickleball } from './pitch-scenes';

const SLIDES = [
  { key: 'football', label: 'Bóng đá', Scene: SceneFootball },
  { key: 'badminton', label: 'Cầu lông', Scene: SceneBadminton },
  { key: 'pickleball', label: 'Pickleball', Scene: ScenePickleball },
] as const;

const INTERVAL = 4500;

/**
 * Carousel ảnh hero. Ba môn thay nhau, đúng những môn ghi ở dòng chữ ngay
 * trên tiêu đề — trước đây chỉ có một ảnh sân bóng trong khi trang quảng cáo
 * cả bốn môn.
 *
 * Tự chạy nhưng dừng khi rê chuột vào hoặc khi focus bàn phím: lưới lịch nằm
 * đè lên ảnh, ảnh đổi lúc người ta đang đọc giá thì rất khó chịu.
 * prefers-reduced-motion thì không tự chạy, chỉ còn bấm chấm để đổi.
 */
export function HeroCarousel({ className = '' }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [autoplay, setAutoplay] = useState(false);

  useEffect(() => {
    setAutoplay(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    if (!autoplay || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL);
    return () => clearInterval(t);
  }, [autoplay, paused]);

  const go = useCallback((i: number) => setIndex(i), []);

  return (
    <div
      className={`relative overflow-hidden rounded-card ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {SLIDES.map(({ key, Scene }, i) => (
        <Scene
          key={key}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}

      {/* Giữ chiều cao: slide đều absolute nên cần một khối chiếm chỗ. */}
      <div className="invisible h-full w-full" aria-hidden="true" />

      <div className="absolute right-4 top-4 flex items-center gap-2 lg:right-5 lg:top-5">
        {SLIDES.map(({ key, label }, i) => (
          <button
            key={key}
            type="button"
            onClick={() => go(i)}
            aria-label={`Xem ảnh ${label}`}
            aria-current={i === index}
            className={`h-2 rounded-pill transition-all duration-300 ${
              i === index ? 'w-7 bg-[#EAF5EF]' : 'w-2 bg-[#EAF5EF]/45 hover:bg-[#EAF5EF]/70'
            }`}
          />
        ))}
      </div>

      <span className="absolute left-4 top-4 rounded-pill bg-[#0B2C21]/75 px-3 py-1 text-[11px] font-medium text-[#A9C9B8] backdrop-blur-sm lg:left-5 lg:top-5">
        {SLIDES[index].label}
      </span>
    </div>
  );
}
