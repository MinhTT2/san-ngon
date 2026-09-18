import Link from 'next/link';
import { BrandMark } from './brand-mark';

export function SiteFooter() {
  return (
    <footer className="relative mt-24 overflow-hidden bg-pitch text-white">
      <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-full w-full opacity-20 lg:w-1/2">
        <svg viewBox="0 0 700 620" className="h-full w-full" preserveAspectRatio="none" fill="none">
          <path d="M700 60 520 560H40M700 170 580 500H180M700 280 640 450H330" stroke="#9FC6B2" strokeWidth="2" />
          <path d="M430 0 700 0v620H190" stroke="#F9DED6" strokeWidth="2" />
          <ellipse cx="510" cy="340" rx="72" ry="40" stroke="#E8E1F5" strokeWidth="2" />
        </svg>
      </div>

      <div className="relative mx-auto max-w-7xl px-5 lg:px-16">
        <div className="grid gap-10 border-b border-white/15 py-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-20 lg:py-20">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-free-fill p-2"><BrandMark size={32} /></span>
              <span className="font-display text-2xl font-extrabold tracking-tight">Sân Ngon</span>
            </div>
            <h2 className="mt-7 max-w-xl font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">Tối nay có kèo.<br /><span className="text-free-line">Chốt sân thôi.</span></h2>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-free-line">Lịch trống thật của các sân thể thao ở Hà Nội. Chọn giờ, đặt cọc và hẹn nhau ra sân.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/tim-san" className="inline-flex min-h-12 items-center gap-4 rounded-control bg-free-fill px-6 py-3 text-sm font-semibold text-pitch transition-colors hover:bg-white">Tìm sân ngay <span aria-hidden="true">↗</span></Link>
              <Link href="/dang-ky-san" className="inline-flex min-h-12 items-center gap-4 rounded-control border border-white/25 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10">Bạn có sân? <span aria-hidden="true">↗</span></Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-9 text-sm sm:grid-cols-3">
            <FooterGroup title="Người chơi" links={[["Tìm sân", '/tim-san'], ['Đơn của tôi', '/don-cua-toi'], ['Đăng nhập', '/dang-nhap']]} />
            <FooterGroup title="Chủ sân" links={[["Đăng sân", '/dang-ky-san'], ['Trang quản lý', '/chu-san'], ['Đăng nhập', '/dang-nhap']]} />
            <FooterGroup title="Hỗ trợ" links={[["Cách hoạt động", '/#cach-hoat-dong'], ['Chính sách hủy', '/chinh-sach-huy'], ['Liên hệ', '/lien-he']]} />
          </div>
        </div>

        <div className="flex flex-col gap-4 py-6 text-xs text-free-line sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Sân Ngon · Hà Nội</span>
          <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-story-coral" /> Lịch sân cập nhật theo thời gian thực</span>
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">{title}</p>
      {links.map(([label, href]) => <Link key={label} href={href} className="w-fit text-free-line transition-colors hover:text-white">{label}</Link>)}
    </div>
  );
}
