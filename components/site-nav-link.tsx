'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Mục nav tự biết mình có đang mở hay không. Header là server component nên
 * không đọc được đường dẫn — trước đây prop `active` không ai truyền và gạch
 * chân dưới mục đang mở không bao giờ hiện.
 */
export function NavLink({ href, label, badge }: { href: string; label: string; badge?: number }) {
  const pathname = usePathname();
  const on = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={on ? 'page' : undefined}
      className={`flex h-19 items-center text-[15px] ${
        on ? 'font-semibold text-ink shadow-[inset_0_-2px_0_var(--color-pitch)]' : 'font-medium text-ink-secondary'
      }`}
    >
      <span className="flex items-center gap-1.5">
        {label}
        {!!badge && <span className="rounded-pill bg-pitch px-1.5 py-0.5 text-[10px] font-semibold leading-none text-pitch-ink">{badge > 99 ? '99+' : badge}</span>}
      </span>
    </Link>
  );
}
