'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Menu tài khoản. Trước đây góc phải chỉ là một link sang "Đơn của tôi" và
 * KHÔNG CÓ ĐƯỜNG ĐĂNG XUẤT NÀO trong cả trang web — đăng nhập nhầm tài khoản
 * là phải xoá cookie bằng tay.
 *
 * Nút đăng xuất là <form method="post"> chứ không phải onClick: cookie phiên
 * do server xoá, nên vẫn chạy kể cả khi JavaScript chưa kịp tải.
 */
export function UserMenu({ name, unreadCount = 0 }: { name: string; unreadCount?: number }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-11 items-center gap-2 rounded-pill border border-hairline pl-4 pr-2 text-sm"
      >
        <span className="hidden max-w-36 truncate sm:inline">{name}</span>
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-pitch text-xs font-semibold text-pitch-ink">
          {name.slice(0, 1).toUpperCase()}
        </span>
      </button>

      {open && (
        <>
          {/* Bấm ra ngoài thì đóng. */}
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 top-13 z-20 flex w-56 flex-col rounded-control border border-hairline bg-card py-1.5"
          >
            <Item href="/don-cua-toi" onNavigate={() => setOpen(false)}>Đơn của tôi</Item>
            <Item href="/thong-bao" onNavigate={() => setOpen(false)}>
              <span className="flex items-center justify-between gap-3">
                Thông báo
                {!!unreadCount && <span className="rounded-pill bg-pitch px-1.5 py-0.5 text-[10px] font-semibold leading-none text-pitch-ink">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </span>
            </Item>
            <Item href="/dang-ky-san" onNavigate={() => setOpen(false)}>Sân của tôi</Item>
            <span className="my-1.5 h-px bg-hairline" />
            <form action="/auth/dang-xuat" method="post">
              <button
                type="submit"
                role="menuitem"
                className="w-full px-4 py-2.5 text-left text-sm text-danger hover:bg-sunk"
              >
                Đăng xuất
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function Item({ href, onNavigate, children }: { href: string; onNavigate: () => void; children: React.ReactNode }) {
  return (
    <Link href={href} role="menuitem" onClick={onNavigate} className="px-4 py-2.5 text-sm hover:bg-sunk">
      {children}
    </Link>
  );
}
