import Link from 'next/link';
import { BrandMark } from './brand-mark';

export function SiteFooter() {
  return <footer className="mt-14 border-t border-hairline bg-card">
    <div className="mx-auto max-w-7xl px-5 lg:px-16">
      <div className="grid gap-8 py-9 md:grid-cols-[1fr_2fr] lg:gap-16">
        <div>
          <Link href="/" className="inline-flex min-h-11 items-center gap-2.5 text-pitch"><BrandMark size={30} /><span className="font-display text-xl font-bold">Sân Ngon</span></Link>
          <p className="mt-3 max-w-xs text-xs leading-6 text-ink-secondary">Đặt sân bóng đá, cầu lông và pickleball ở Hà Nội. Xem lịch trống và giá trước khi đặt.</p>
        </div>
        <nav aria-label="Liên kết cuối trang" className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3">
          <FooterGroup title="Người chơi" links={[["Tìm sân", '/tim-san'], ['Giải đấu', '/giai-dau'], ['Kết nối', '/ket-noi'], ['Đơn của tôi', '/don-cua-toi'], ['Sân yêu thích', '/san-yeu-thich']]} />
          <FooterGroup title="Chủ sân" links={[["Đăng ký chủ sân", '/dang-ky-san'], ['Trang quản lý', '/chu-san'], ['Tài khoản', '/tai-khoan']]} />
          <FooterGroup title="Hỗ trợ" links={[["Cách đặt sân", '/#cach-hoat-dong'], ['Trung tâm trợ giúp', '/tro-giup'], ['Góp ý / báo lỗi', '/gop-y'], ['Chính sách hủy', '/chinh-sach-huy'], ['Liên hệ', '/lien-he'], ['Nguồn hình ảnh', '/nguon-hinh-anh']]} />
        </nav>
      </div>
      <p className="border-t border-hairline py-5 text-[11px] text-ink-secondary">© 2026 Sân Ngon · Hà Nội</p>
    </div>
  </footer>;
}

function FooterGroup({ title, links }: { title: string; links: [string, string][] }) {
  return <div><p className="mb-2 text-xs font-semibold text-ink">{title}</p>{links.map(([label, href]) => <Link key={label} href={href} className="flex min-h-9 w-fit items-center py-1 text-xs leading-5 text-ink-secondary hover:text-pitch hover:underline">{label}</Link>)}</div>;
}
