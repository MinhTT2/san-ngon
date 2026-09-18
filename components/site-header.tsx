import Link from 'next/link';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { NavLink } from './site-nav-link';
import { UserMenu } from './user-menu';
import { BrandMark } from './brand-mark';

/**
 * Header dùng chung cho mọi trang TRỪ trang thanh toán.
 * Trang checkout cố ý không có nav: bớt đường thoát càng tốt.
 */
export async function SiteHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ count: unreadCount }, { data: profile }] = user
    ? await Promise.all([
      supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
      supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    ])
    : [{ count: 0 }, { data: null }];
  const isOwner = profile?.role === 'owner';

  return (
    <header className="border-b border-hairline bg-card">
      <div className="mx-auto flex h-19 max-w-7xl items-center justify-between px-5 lg:px-16">
        <div className="flex items-center gap-6 lg:gap-11">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-xl font-extrabold tracking-tight text-pitch lg:text-[22px]">
              Sân Ngon
            </span>
          </Link>

          <nav className="hidden gap-8 md:flex">
            <NavLink href="/tim-san" label="Tìm sân" />
            <NavLink href="/don-cua-toi" label="Đơn của tôi" />
            <NavLink href="/chu-san" label="Chủ sân" />
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {!isOwner && (
            <Link
              href="/dang-ky-san"
              className="hidden h-11 items-center rounded-control border border-hairline px-4 text-[15px] font-medium lg:flex"
            >
              Đăng sân của bạn
            </Link>
          )}

          {user && (
            <Link
              href="/thong-bao"
              aria-label={unreadCount ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
              className="relative flex size-11 items-center justify-center rounded-control border border-hairline text-ink transition-colors hover:bg-sunk"
            >
              <Bell size={20} strokeWidth={1.8} aria-hidden="true" />
              {!!unreadCount && (
                <span className="absolute right-1 top-1 flex min-w-4 translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-pill bg-pitch px-1 text-[10px] font-semibold leading-4 text-pitch-ink">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          )}

          {user ? (
            <UserMenu name={user.user_metadata?.full_name ?? user.email ?? 'Tài khoản'} isOwner={isOwner} />
          ) : (
            <Link href="/dang-nhap" className="flex h-11 items-center rounded-control bg-pitch px-5 text-[15px] font-semibold text-pitch-ink">
              Đăng nhập
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
