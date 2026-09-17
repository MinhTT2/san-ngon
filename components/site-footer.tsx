import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-hairline bg-card">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-9 text-sm sm:flex-row sm:items-center sm:justify-between lg:px-16">
        <span className="font-display text-lg font-extrabold tracking-tight text-pitch">Sân Ngon</span>
        <div className="flex flex-wrap gap-6 text-ink-secondary">
          <Link href="/tim-san" className="text-ink-secondary">Tìm sân</Link>
          <Link href="/dang-ky-san" className="text-ink-secondary">Đăng sân</Link>
          <Link href="/chinh-sach-huy" className="text-ink-secondary">Chính sách hủy</Link>
          <Link href="/lien-he" className="text-ink-secondary">Liên hệ</Link>
        </div>
        <span className="text-xs text-taken-ink">Hà Nội, 2026</span>
      </div>
    </footer>
  );
}
