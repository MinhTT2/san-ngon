'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from 'lucide-react';

type DashboardRole = 'owner' | 'admin';

const OWNER_LINKS = [
  { href: '/chu-san', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/chu-san/don', label: 'Đơn đặt sân', icon: ClipboardList },
  { href: '/chu-san/quan-ly', label: 'Quản lý sân', icon: Building2 },
] as const;

const ADMIN_LINKS = [
  { href: '/admin', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/admin?view=owners', label: 'Hồ sơ chủ sân', icon: ShieldCheck },
  { href: '/admin?view=venues', label: 'Hồ sơ sân', icon: Building2 },
  { href: '/admin?view=bookings', label: 'Đơn đặt sân', icon: ClipboardList },
  { href: '/admin/users', label: 'Người dùng', icon: Users },
] as const;

export function DashboardSidebar({ role }: { role: DashboardRole }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const links = role === 'admin' ? ADMIN_LINKS : OWNER_LINKS;

  return (
    <aside className="shrink-0 border-b border-hairline bg-card lg:w-64 lg:border-b-0 lg:border-r">
      <div className="lg:sticky lg:top-0 lg:flex lg:min-h-[calc(100dvh-76px)] lg:flex-col lg:p-4">
        <div className="hidden items-center gap-2 rounded-control bg-sunk px-3 py-3 lg:flex">
          <ShieldCheck className="size-4 text-pitch" aria-hidden="true" />
          <span className="text-xs font-semibold text-ink-secondary">
            {role === 'admin' ? 'Khu vực quản trị' : 'Khu vực chủ sân'}
          </span>
        </div>
        <nav aria-label={role === 'admin' ? 'Điều hướng admin' : 'Điều hướng chủ sân'} className="flex gap-1 overflow-x-auto p-3 lg:mt-4 lg:flex-col lg:p-0">
          {links.map(({ href, label, icon: Icon }) => {
            const query = href.includes('?') ? new URLSearchParams(href.split('?')[1]).get('view') : null;
            const active = pathname === href.split('?')[0]
              && (href.includes('#') ? false : query ? searchParams.get('view') === query : !searchParams.get('view'));
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-10 shrink-0 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors ${active ? 'bg-pitch text-pitch-ink' : 'text-ink-secondary hover:bg-sunk hover:text-ink'}`}
              >
                <Icon className="size-[17px]" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
