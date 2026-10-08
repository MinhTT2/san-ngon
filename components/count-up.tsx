'use client';

import { useEffect, useRef, useState } from 'react';
import { vnd } from '@/lib/format';

/**
 * Số đếm tăng dần khi cuộn tới. Không thêm thư viện — requestAnimationFrame
 * là đủ cho một con số.
 *
 * Giá trị cuối được render ngay trong HTML đầu tiên, JS chỉ hạ xuống 0 rồi
 * đếm lên. Bot đọc trang hay JS hỏng thì vẫn thấy số thật, không thấy số 0.
 */
export function CountUp({
  to,
  suffix = '',
  format,
  duration = 900,
  className = '',
}: {
  to: number;
  suffix?: string;
  format?: 'money';
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (typeof IntersectionObserver === 'undefined') return;
    let frame = 0;
    let finished = false;
    const quiet = () => {
      if (!media.matches) return;
      cancelAnimationFrame(frame); finished = true; setValue(to); io.disconnect();
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || finished || media.matches) return;
        io.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          // easeOutCubic: chạy nhanh lúc đầu rồi dừng êm, không giật ở cuối.
          setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
          if (t < 1) frame = requestAnimationFrame(tick);
          else finished = true;
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    if (!media.matches) io.observe(el);
    media.addEventListener('change', quiet);
    return () => { io.disconnect(); cancelAnimationFrame(frame); media.removeEventListener('change', quiet); };
  }, [to, duration]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {format === 'money' ? vnd(value) : value}
      {suffix}
    </span>
  );
}
