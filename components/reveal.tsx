'use client';

import { useEffect, useRef, useState } from 'react';
import { enterMotion } from '@/lib/motion';

/**
 * Scroll entrance through Motion Mini. Server HTML stays visible; an effect
 * starts only when a block enters the viewport and cleans up its inline styles.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  /** Trễ theo mili giây, để các khối trong cùng một hàng hiện so le nhau. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Trình duyệt quá cũ không có IntersectionObserver: để nguyên, khỏi giấu.
    if (typeof IntersectionObserver === 'undefined') return;
    let dispose = () => {};

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        dispose = enterMotion(el, delay / 1000, 20);
        io.disconnect();
      },
      // Kích hoạt sớm một chút để khối đã hiện xong trước khi vào hẳn khung nhìn.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.1 }
    );
    io.observe(el);
    return () => { io.disconnect(); dispose(); };
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`pf-reveal ${shown ? 'pf-armed is-in' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
