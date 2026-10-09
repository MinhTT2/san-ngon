'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { NavigationMarker } from './navigation-marker';
import {
  Building2,
  CalendarDays,
  ArrowUpRight,
  ClipboardList,
  LayoutDashboard,
  ShieldCheck,
  Users,
  WalletCards,
  Trophy,
  MessageSquare,
} from 'lucide-react';

type DashboardRole = 'owner' | 'admin';

const OWNER_LINKS = [
  { href: '/chu-san', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/chu-san/giai-dau', label: 'Giải đấu', icon: Trophy },
  { href: '/chu-san/lich', label: 'Lịch sân', icon: CalendarDays },
  { href: '/chu-san/don', label: 'Đơn đặt sân', icon: ClipboardList },
  { href: '/chu-san/hoan-coc', label: 'Hoàn cọc', icon: WalletCards },
  { href: '/chu-san/quan-ly', label: 'Quản lý sân', icon: Building2 },
  { href: '/chu-san/phi-dich-vu', label: 'Phí sử dụng website', icon: WalletCards },
  { href: '/chu-san/thanh-toan', label: 'Tài khoản nhận cọc', icon: WalletCards },
] as const;

const ADMIN_LINKS = [
  { href: '/admin', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/admin?view=owners', label: 'Hồ sơ chủ sân', icon: ShieldCheck },
  { href: '/admin?view=venues', label: 'Hồ sơ sân', icon: Building2 },
  { href: '/admin?view=bookings', label: 'Đơn đặt sân', icon: ClipboardList },
  { href: '/admin/phi-dich-vu', label: 'Phí chủ sân', icon: WalletCards },
  { href: '/admin/giai-dau', label: 'Giải đấu', icon: Trophy },
  { href: '/admin/users', label: 'Người dùng', icon: Users },
  { href: '/admin/gop-y', label: 'Góp ý người dùng', icon: MessageSquare },
] as const;

export function DashboardSidebar({ role }: { role: DashboardRole }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const links = role === 'admin' ? ADMIN_LINKS : OWNER_LINKS;
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    const selected = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && selected && window.matchMedia('(max-width: 1023px)').matches) {
      const item = selected.getBoundingClientRect(), frame = nav.getBoundingClientRect();
      nav.scrollLeft += item.left - frame.left - (frame.width - item.width) / 2;
    }
  }, [pathname, searchParams]);

  return (
    <aside className="shrink-0 border-b border-hairline bg-card lg:w-56 xl:w-60 lg:border-b-0 lg:border-r">
      <div className="lg:sticky lg:top-0 lg:flex lg:min-h-dvh lg:flex-col lg:p-4">
        <div className="hidden items-center gap-2 rounded-control border border-strong bg-free-fill px-3 py-3 lg:flex">
          <ShieldCheck className="size-4 text-pitch" aria-hidden="true" />
          <span className="text-xs font-semibold text-ink-secondary">
            {role === 'admin' ? 'Khu vực quản trị' : 'Khu vực chủ sân'}
          </span>
        </div>
        <nav ref={navRef} aria-label={role === 'admin' ? 'Điều hướng admin' : 'Điều hướng chủ sân'} className="pf-dashboard-nav relative isolate flex gap-1 overflow-x-auto p-3 lg:mt-4 lg:flex-col lg:p-0">
          <NavigationMarker activeKey={`${pathname}?${searchParams.toString()}`} />
          {links.map(({ href, label, icon: Icon }) => {
            const query = href.includes('?') ? new URLSearchParams(href.split('?')[1]).get('view') : null;
            const path = href.split('?')[0];
            const active = query ? pathname === path && searchParams.get('view') === query
              : path === '/admin' || path === '/chu-san' ? pathname === path && !searchParams.get('view')
              : pathname === path || pathname.startsWith(`${path}/`);
            const ownerDetail = role === 'admin' && query === 'owners' && pathname.startsWith('/admin/owners/');
            const selected = active || ownerDetail || (path === '/chu-san/quan-ly' && (pathname.startsWith('/chu-san/bang-gia/') || pathname === '/tao-cum-san'));
            return (
              <Link
                key={href}
                href={href}
                aria-current={selected ? 'page' : undefined}
                className={`pf-dashboard-link pf-action flex min-h-11 shrink-0 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors ${selected ? 'bg-pitch text-pitch-ink' : 'text-ink-secondary hover:bg-sunk hover:text-ink'}`}
              >
                <Icon className="size-[17px]" strokeWidth={selected ? 2.2 : 1.8} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden border-t border-hairline pt-4 lg:block"><Link href="/" className="pf-action flex min-h-11 items-center justify-between gap-2 rounded-control px-3 text-xs font-semibold text-ink-secondary hover:bg-free-fill hover:text-pitch">Trang đặt sân<ArrowUpRight size={15} aria-hidden="true" /></Link><p className="px-3 pt-2 text-[11px] leading-5 text-ink-secondary">{role === 'admin' ? 'Hồ sơ, người dùng và vận hành.' : 'Quản lý lịch, sân và tiền cọc.'}</p></div>
      </div>
    </aside>
  );
}
