'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Hiện dần khi cuộn tới. Dùng IntersectionObserver của trình duyệt, không
 * thêm thư viện animation nào — hiệu ứng chỉ có bấy nhiêu mà framer-motion
 * nặng gần 50kb, đắt cho một trang landing.
 *
 * Quan trọng: CSS để mặc định là ĐÃ HIỆN. Chỉ khi component này chạy được
 * mới gắn .pf-armed để giấu đi rồi mới cho hiện. JS hỏng hay bot đọc trang
 * thì nội dung vẫn còn nguyên, không tàng hình.
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
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Trình duyệt quá cũ không có IntersectionObserver: để nguyên, khỏi giấu.
    if (typeof IntersectionObserver === 'undefined') return;
    setArmed(true);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      // Kích hoạt sớm một chút để khối đã hiện xong trước khi vào hẳn khung nhìn.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={shown && delay ? { animationDelay: `${delay}ms` } : undefined}
      className={`pf-reveal ${armed ? 'pf-armed' : ''} ${shown ? 'is-in' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
