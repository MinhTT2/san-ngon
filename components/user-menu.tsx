'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Menu tài khoản. Thông báo có nút chuông riêng trên header để không lặp lại
 * cùng một đường dẫn trong menu.
 *
 * Nút đăng xuất là <form method="post"> chứ không phải onClick: cookie phiên
 * do server xoá, nên vẫn chạy kể cả khi JavaScript chưa kịp tải.
 */
export function UserMenu({ name, isOwner, isAdmin = false }: { name: string; isOwner: boolean; isAdmin?: boolean }) {
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
            {isOwner ? (
              <Item href="/chu-san" onNavigate={() => setOpen(false)}>Trang quản lý</Item>
            ) : isAdmin ? (
              <Item href="/admin" onNavigate={() => setOpen(false)}>Quản trị</Item>
            ) : (
              <Item href="/dang-ky-san" onNavigate={() => setOpen(false)}>Đăng sân của bạn</Item>
            )}
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
