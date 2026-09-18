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
      data-hero-carousel=""
      // KHÔNG hardcode `relative` ở đây: hero truyền vào `absolute inset-0`,
      // hai class cùng đặt thuộc tính position nên đè nhau — `relative` thắng,
      // inset-0 mất tác dụng, khối cao 0px và ảnh biến mất hoàn toàn.
      // Vị trí do nơi gọi quyết định; các chấm bên trong vẫn neo được vì root
      // luôn là một khối đã được định vị.
      className={`overflow-hidden ${className}`}
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

      {/* Slide đều absolute; khi carousel nằm trong luồng bình thường thì khối
          này giữ chiều cao, khi nó absolute inset-0 thì vô hại. */}
      <div className="invisible h-full w-full" aria-hidden="true" />

      {/* Nhãn và chấm nằm ở đáy phải, thẳng hàng với lề của khối nội dung hero. */}
      <div className="absolute bottom-5 right-5 z-10 flex items-center gap-3 lg:bottom-7 lg:right-16">
        <span className="rounded-pill bg-[#0B2C21]/75 px-3 py-1 text-[11px] font-medium text-[#A9C9B8] backdrop-blur-sm">
          {SLIDES[index].label}
        </span>
        <span className="flex items-center gap-2">
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
        </span>
      </div>
    </div>
  );
}
