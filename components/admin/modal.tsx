'use client';

import { useEffect, useRef } from 'react';

/**
 * Hộp thoại dùng chung cho trang quản trị.
 *
 * Dùng <dialog> của trình duyệt thay vì tự dựng: nó lo sẵn focus trap, phím Esc
 * và lớp phủ — ba thứ mà modal tự viết hay quên, và quên thì người dùng bàn
 * phím bị kẹt bên trong trang.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // m-auto là bắt buộc: <dialog> mặc định tự căn giữa bằng `margin: auto`,
  // nhưng preflight của Tailwind đặt `margin: 0` cho mọi thẻ, nên nếu không đặt
  // lại thì hộp thoại rơi về góc trên bên trái màn hình.
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className="m-auto max-h-[90dvh] w-[min(92vw,30rem)] overflow-y-auto rounded-card border border-hairline bg-card p-0 text-ink backdrop:bg-ink/35 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-pitch">{title}</h2>
          {description && <p className="text-sm leading-relaxed text-ink-secondary">{description}</p>}
        </div>
        {children}
      </div>
    </dialog>
  );
}
