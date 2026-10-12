import Link from 'next/link';
export function PolicyPage({ title, introduction, children }: { title: string; introduction: string; children: React.ReactNode }) {
  return <main className="mx-auto max-w-3xl px-5 py-12 lg:px-10">
    <h1 className="font-display text-3xl font-extrabold tracking-tight text-pitch lg:text-4xl">{title}</h1>
    <p className="mt-3 text-sm text-ink-secondary">Cập nhật ngày 12/10/2026</p>
    <p className="mt-5 text-[15px] leading-7 text-ink-secondary">{introduction}</p>
    <div className="mt-8 space-y-8 text-[15px] leading-7 text-ink-secondary">{children}</div>
    <nav aria-label="Chính sách liên quan" className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-hairline pt-5 text-sm font-semibold text-pitch">
      <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/quyen-rieng-tu">Quyền riêng tư</Link>
      <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/dieu-khoan-su-dung">Điều khoản sử dụng</Link>
      <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/chinh-sach-huy">Chính sách hủy</Link>
      <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/lien-he">Liên hệ</Link>
    </nav>
  </main>;
}
export function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="mb-3 font-display text-xl font-bold text-pitch">{title}</h2>{children}</section>;
}
