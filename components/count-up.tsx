'use client';

import { useEffect, useRef, useState } from 'react';

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
  duration = 900,
  className = '',
}: {
  to: number;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') return;

    setValue(0);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();

        const start = performance.now();
        let frame = 0;
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          // easeOutCubic: chạy nhanh lúc đầu rồi dừng êm, không giật ở cuối.
          setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {value}
      {suffix}
    </span>
  );
}
