'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { UserAvatar } from './user-avatar';

/**
 * Menu tài khoản. Thông báo có nút chuông riêng trên header để không lặp lại
 * cùng một đường dẫn trong menu.
 *
 * Nút đăng xuất là <form method="post"> chứ không phải onClick: cookie phiên
 * do server xoá, nên vẫn chạy kể cả khi JavaScript chưa kịp tải.
 */
export function UserMenu({ name, avatar = null, isOwner, isAdmin = false }: { name: string; avatar?: string | null; isOwner: boolean; isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const initialFocus = useRef<'first' | 'last'>('first');
  const menuId = useId();

  function dismiss() { setOpen(false); triggerRef.current?.focus(); }
  function openMenu(position: 'first' | 'last' = 'first') { initialFocus.current = position; setOpen(true); }

  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    (initialFocus.current === 'last' ? items?.[items.length - 1] : items?.[0])?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { if (open) dismiss(); else openMenu(); }}
        onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); openMenu(event.key === 'ArrowUp' ? 'last' : 'first'); } }}
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-label={`Menu tài khoản: ${name}`}
        aria-haspopup="menu"
        className="pf-action flex h-11 items-center gap-2 rounded-pill border border-hairline pl-4 pr-2 text-sm hover:border-pitch"
      >
        <span className="hidden max-w-36 truncate sm:inline">{name}</span>
        <UserAvatar name={name} avatar={avatar} className="size-7 text-xs" />
      </button>

      {open && (
        <>
          {/* Bấm ra ngoài thì đóng. */}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Đóng menu"
            onClick={dismiss}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            id={menuId}
            ref={menuRef}
            role="menu"
            aria-label="Tài khoản"
            onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
            onKeyDown={event => {
              const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
              const index = items.indexOf(document.activeElement as HTMLElement);
              if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
                items[next]?.focus();
              } else if (event.key === 'Tab') {
                event.preventDefault();
                const controls = Array.from(document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')).filter(item => item.tabIndex >= 0 && item.getClientRects().length > 0 && !menuRef.current?.contains(item));
                const triggerIndex = controls.indexOf(triggerRef.current!);
                setOpen(false);
                (event.shiftKey ? triggerRef.current : controls[triggerIndex + 1] ?? triggerRef.current)?.focus();
              }
            }}
            className="pf-menu absolute right-0 top-13 z-20 flex w-56 flex-col rounded-control border border-hairline bg-card py-1.5"
          >
            <Item href="/tai-khoan" onNavigate={() => setOpen(false)}>Thông tin tài khoản</Item>
            <Item href="/don-cua-toi" onNavigate={() => setOpen(false)}>Đơn của tôi</Item>
            <Item href="/san-yeu-thich" onNavigate={() => setOpen(false)}>Sân yêu thích</Item>
            <Item href="/gop-y" onNavigate={() => setOpen(false)}>Góp ý & hỗ trợ</Item>
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
                tabIndex={-1}
                className="min-h-11 w-full px-4 py-2.5 text-left text-sm text-danger hover:bg-sunk focus:bg-sunk"
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
    <Link href={href} role="menuitem" tabIndex={-1} onClick={onNavigate} className="flex min-h-11 items-center px-4 py-2.5 text-sm hover:bg-sunk focus:bg-sunk">
      {children}
    </Link>
  );
}
