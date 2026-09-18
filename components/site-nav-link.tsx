'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Mục nav tự biết mình có đang mở hay không. Header là server component nên
 * không đọc được đường dẫn — trước đây prop `active` không ai truyền và gạch
 * chân dưới mục đang mở không bao giờ hiện.
 */
export function NavLink({ href, label, compact = false }: { href: string; label: string; compact?: boolean }) {
  const pathname = usePathname();
  const on = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={on ? 'page' : undefined}
      className={`flex flex-none items-center px-2 text-sm ${compact ? 'h-12' : 'h-19 text-[15px]'} ${
        on ? 'font-semibold text-ink shadow-[inset_0_-2px_0_var(--color-pitch)]' : 'font-medium text-ink-secondary'
      }`}
    >
      {label}
    </Link>
  );
}
