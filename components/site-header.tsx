import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { NavLink } from './site-nav-link';
import { UserMenu } from './user-menu';

/**
 * Header dùng chung cho mọi trang TRỪ trang thanh toán.
 * Trang checkout cố ý không có nav: bớt đường thoát càng tốt.
 */
export async function SiteHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="border-b border-hairline bg-card">
      <div className="mx-auto flex h-19 max-w-7xl items-center justify-between px-5 lg:px-16">
        <div className="flex items-center gap-6 lg:gap-11">
          <Link href="/" className="flex items-center gap-2.5">
            <Mark />
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
          <Link
            href="/dang-ky-san"
            className="hidden h-11 items-center rounded-control border border-hairline px-4 text-[15px] font-medium lg:flex"
          >
            Đăng sân của bạn
          </Link>

          {user ? (
            <UserMenu name={user.user_metadata?.full_name ?? user.email ?? 'Tài khoản'} />
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

/** Mark hình mặt sân. Trang web cần một dấu neo ở góc trái, app thì không. */
function Mark() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
      <rect width="30" height="30" rx="8" fill="#0F3D2E" />
      <g stroke="#9FC6B2" strokeWidth="1.2" fill="none">
        <rect x="5.5" y="7.5" width="19" height="15" rx="2" />
        <line x1="15" y1="7.5" x2="15" y2="22.5" />
        <circle cx="15" cy="15" r="3.4" />
      </g>
    </svg>
  );
}
