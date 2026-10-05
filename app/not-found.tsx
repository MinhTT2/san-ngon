import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
      <div className="rounded-card border border-hairline bg-card p-6 sm:p-8">
        <p className="text-sm font-semibold text-ink-secondary">404 · Không tìm thấy trang</p>
        <h1 className="mt-3 font-display text-2xl font-bold text-pitch">Đường dẫn này không còn khả dụng</h1>
        <p className="mt-3 text-sm leading-7 text-ink-secondary">Đường dẫn có thể chưa đúng hoặc nội dung đã được gỡ. Bạn có thể tìm sân khác hoặc quay về trang chủ.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/tim-san" className="inline-flex min-h-11 items-center rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink">Tìm sân</Link>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-control border border-hairline px-5 py-3 text-sm font-semibold text-pitch">Về trang chủ</Link>
        </div>
      </div>
    </main>
  );
}
