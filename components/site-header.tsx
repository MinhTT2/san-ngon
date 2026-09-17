import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

/**
 * Header dùng chung cho mọi trang TRỪ trang thanh toán.
 * Trang checkout cố ý không có nav: bớt đường thoát càng tốt.
 */
export async function SiteHeader({ active }: { active?: 'tim-san' | 'don-cua-toi' | 'chu-san' }) {
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
            <NavLink href="/tim-san" label="Tìm sân" on={active === 'tim-san'} />
            <NavLink href="/don-cua-toi" label="Đơn của tôi" on={active === 'don-cua-toi'} />
            <NavLink href="/chu-san" label="Chủ sân" on={active === 'chu-san'} />
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
            <Link href="/don-cua-toi" className="flex h-11 items-center gap-2 rounded-pill border border-hairline pl-4 pr-2 text-sm">
              <span className="hidden sm:inline">{user.user_metadata?.full_name ?? 'Tài khoản'}</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-pitch text-xs font-semibold text-pitch-ink">
                {(user.user_metadata?.full_name ?? 'B').slice(0, 1).toUpperCase()}
              </span>
            </Link>
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

function NavLink({ href, label, on }: { href: string; label: string; on?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex h-19 items-center text-[15px] ${
        on ? 'font-semibold text-ink shadow-[inset_0_-2px_0_var(--color-pitch)]' : 'font-medium text-ink-secondary'
      }`}
    >
      {label}
    </Link>
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
