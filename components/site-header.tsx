import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { dayLabel, hhmm } from '@/lib/format';
import { NotificationPopover } from './notification-popover';
import { NavLink } from './site-nav-link';
import { UserMenu } from './user-menu';
import { BrandMark } from './brand-mark';

/**
 * Header dùng chung cho mọi trang công khai. Dashboard chủ sân dùng cùng dữ
 * liệu tài khoản nhưng có thanh điều hướng riêng, không dùng footer công khai.
 */
export async function SiteHeader({ variant = 'site' }: { variant?: 'site' | 'dashboard' }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ count: unreadCount }, { data: profile }, { data: notifications, error: notificationsError }] = user
    ? await Promise.all([
      supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
      supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      supabase.from('notifications').select('id, title, body, read_at, created_at, booking_id')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(8),
    ])
    : [{ count: 0 }, { data: null }, { data: null, error: null }];
  const isOwner = profile?.role === 'owner';
  const dashboard = variant === 'dashboard';

  return (
    <header className="border-b border-hairline bg-card">
      <div className="mx-auto flex min-h-19 max-w-7xl items-center justify-between gap-5 px-5 lg:px-16">
        <div className="flex min-w-0 items-center gap-6 lg:gap-11">
          <Link href={dashboard ? '/chu-san' : '/'} className="flex flex-none items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-xl font-extrabold tracking-tight text-pitch lg:text-[22px]">
              Sân Ngon
            </span>
          </Link>

          {dashboard ? (
            <span className="hidden border-l border-hairline pl-6 text-sm font-semibold text-ink-secondary md:inline lg:pl-8">
              Dashboard chủ sân
            </span>
          ) : (
            <nav className="hidden gap-8 md:flex">
              <NavLink href="/tim-san" label="Tìm sân" />
              <NavLink href="/don-cua-toi" label="Đơn của tôi" />
            </nav>
          )}
        </div>

        <div className="flex flex-none items-center gap-3">
          {dashboard ? (
            <Link href="/" className="hidden h-11 items-center rounded-control border border-hairline px-4 text-sm font-medium text-ink-secondary lg:flex">
              Trang đặt sân <span aria-hidden="true" className="ml-2">↗</span>
            </Link>
          ) : isOwner ? (
            <Link href="/chu-san" className="hidden h-11 items-center rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink lg:flex">
              Dashboard <span aria-hidden="true" className="ml-2">↗</span>
            </Link>
          ) : (
            <Link href="/dang-ky-san" className="hidden h-11 items-center rounded-control border border-hairline px-4 text-[15px] font-medium lg:flex">
              Đăng sân của bạn
            </Link>
          )}

          {user && (
            <NotificationPopover
              unreadCount={unreadCount ?? 0}
              loadError={!!notificationsError}
              dashboard={dashboard}
              notifications={(notifications ?? []).map((notification) => ({
                ...notification,
                timeLabel: `${dayLabel(new Date(notification.created_at))} · ${hhmm(notification.created_at)}`,
              }))}
            />
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

      {dashboard && (
        <div className="border-t border-hairline bg-sunk">
          <nav aria-label="Điều hướng dashboard" className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 lg:px-16">
            <NavLink href="/chu-san" label="Tổng quan" compact />
            <NavLink href="/dang-ky-san" label="Hồ sơ sân" compact />
            <NavLink href="/tim-san" label="Xem trang đặt sân" compact />
          </nav>
        </div>
      )}
    </header>
  );
}
