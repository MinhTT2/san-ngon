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
export async function SiteHeader({ variant = 'site' }: { variant?: 'site' | 'dashboard' | 'admin' }) {
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
  const isAdmin = profile?.role === 'admin';
  const dashboard = variant !== 'site';
  const admin = variant === 'admin';

  return (
    <header className="border-b border-hairline bg-card">
      <div className="mx-auto flex min-h-19 max-w-7xl items-center justify-between gap-5 px-5 lg:px-16">
        <div className="flex min-w-0 items-center gap-6 lg:gap-11">
          <Link href={admin ? '/admin' : dashboard ? '/chu-san' : '/'} className="flex flex-none items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-xl font-extrabold tracking-tight text-pitch lg:text-[22px]">
              Sân Ngon
            </span>
          </Link>

          {dashboard ? (
            <span className="hidden border-l border-hairline pl-6 text-sm font-semibold text-ink-secondary md:inline lg:pl-8">
              {admin ? 'Quản trị Sân Ngon' : 'Dashboard chủ sân'}
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
            <Link href="/" className="pf-action hidden h-11 items-center rounded-control border border-hairline px-4 text-sm font-medium text-ink-secondary lg:flex">
              Trang đặt sân <span aria-hidden="true" className="pf-arrow ml-2">↗</span>
            </Link>
          ) : isAdmin ? (
            <Link href="/admin" className="pf-action hidden h-11 items-center rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink md:flex">
              Quản trị <span aria-hidden="true" className="pf-arrow ml-2">↗</span>
            </Link>
          ) : isOwner ? (
            <Link href="/chu-san" className="pf-action hidden h-11 items-center rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink lg:flex">
              Dashboard <span aria-hidden="true" className="pf-arrow ml-2">↗</span>
            </Link>
          ) : (
            <Link href="/dang-ky-san" className="pf-action hidden h-11 items-center rounded-control border border-hairline px-4 text-[15px] font-medium lg:flex">
              Đăng ký chủ sân
            </Link>
          )}

          {user && (
            <NotificationPopover
              unreadCount={unreadCount ?? 0}
              loadError={!!notificationsError}
              notifications={(notifications ?? []).map((notification) => ({
                ...notification,
                timeLabel: `${dayLabel(new Date(notification.created_at))} · ${hhmm(notification.created_at)}`,
              }))}
            />
          )}

          {user ? (
            <UserMenu name={user.user_metadata?.full_name ?? user.email ?? 'Tài khoản'} isOwner={isOwner} isAdmin={isAdmin} />
          ) : (
            <Link href="/dang-nhap" className="pf-action flex h-11 items-center rounded-control bg-pitch px-5 text-[15px] font-semibold text-pitch-ink">
              Đăng nhập
            </Link>
          )}
        </div>
      </div>
      {!dashboard && (
        <nav aria-label="Điều hướng chính trên điện thoại" className="flex gap-4 overflow-x-auto border-t border-hairline px-5 text-sm md:hidden">
          <NavLink compact href="/tim-san" label="Tìm sân" />
          <NavLink compact href="/don-cua-toi" label="Đơn của tôi" />
          <NavLink compact href={isAdmin ? '/admin' : isOwner ? '/chu-san' : '/dang-ky-san'} label={isAdmin ? 'Quản trị' : isOwner ? 'Quản lý sân' : 'Chủ sân'} />
        </nav>
      )}
    </header>
  );
}
