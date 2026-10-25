import Link from 'next/link';

// Independent presentation fixture. Never use these values in GA4 or account activity.
const dailyViews = [164, 202, 238, 276, 310, 342, 410];
const number = (value: number) => new Intl.NumberFormat('vi-VN').format(value);

export function TrafficDemoReport() {
  return <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pitch">Quản trị / Bản trình bày</p>
    <h1 className="mt-2 font-display text-3xl font-bold text-pitch sm:text-4xl">Báo cáo truy cập minh họa</h1>
    <section aria-labelledby="demo-notice" className="mt-5 rounded-card border border-pitch bg-free-fill p-5">
      <h2 id="demo-notice" className="font-semibold text-pitch">Số liệu mô phỏng · Kịch bản 7 ngày</h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-secondary">Dữ liệu mẫu để trình bày giao diện báo cáo, không phải kết quả Google Analytics hay hành vi của người đặt sân thực tế.</p>
      <Link href="/admin/thong-ke-truy-cap?period=7" className="mt-3 inline-flex min-h-11 items-center font-semibold text-pitch underline underline-offset-4">Xem báo cáo GA4 thực tế</Link>
    </section>
    <section aria-label="Chỉ số minh họa" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ['Người dùng hoạt động', '128'],
        ['Phiên truy cập', '386'],
        ['Lượt xem trang', number(dailyViews.reduce((total, views) => total + views, 0))],
        ['Tương tác trung bình / người', '5 phút 4 giây'],
      ].map(([label, value]) => <article key={label} className="min-w-0 rounded-card border border-hairline bg-card p-5">
        <h2 className="text-xs text-ink-secondary">{label}</h2>
        <p className="mt-3 break-words font-display text-2xl font-bold tabular-nums text-pitch">{value}</p>
        <p className="mt-2 text-xs text-ink-secondary">Số liệu minh họa</p>
      </article>)}
    </section>
    <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
      <section className="min-w-0 rounded-card border border-hairline bg-card p-5 lg:p-6" aria-labelledby="demo-daily">
        <h2 id="demo-daily" className="font-display text-xl font-bold text-pitch">Lượt xem theo ngày · Minh họa</h2>
        <p className="mt-2 text-xs leading-6 text-ink-secondary">Bảy ngày trong kịch bản mẫu, không gắn với kỳ GA4 thực tế.</p>
        <ol className="mt-5 space-y-4">{dailyViews.map((views, index) => <li key={index} className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] items-center gap-3 text-xs">
          <span className="text-ink-secondary">Ngày {index + 1}</span>
          <div aria-hidden="true" className="h-3 overflow-hidden rounded-pill bg-sunk"><div className="h-full rounded-pill bg-pitch" style={{ width: `${views / 410 * 100}%` }} /></div>
          <span className="text-right tabular-nums">{number(views)}</span>
        </li>)}</ol>
      </section>
      <section className="min-w-0 rounded-card border border-hairline bg-card p-5 lg:p-6" aria-labelledby="demo-discovery">
        <h2 id="demo-discovery" className="font-display text-xl font-bold text-pitch">Khám phá sân · Minh họa</h2>
        <p className="mt-2 text-xs leading-6 text-ink-secondary">Số lần thao tác giả lập, có thể lặp; không phải số người hoặc số đơn đặt sân.</p>
        <dl className="mt-5 divide-y divide-hairline">{[
          ['Tìm sân', 256], ['Mở trang sân', 174], ['Tiếp tục sau khi chọn giờ', 96],
        ].map(([label, count]) => <div key={label} className="flex items-center justify-between gap-4 py-4 text-sm">
          <dt>{label}</dt><dd className="shrink-0 font-semibold tabular-nums text-pitch">{number(Number(count))} lần</dd>
        </div>)}</dl>
      </section>
    </div>
    <p className="mt-6 text-xs leading-6 text-ink-secondary">Bản minh họa · Các giá trị không được gửi đến GA4, lưu vào cơ sở dữ liệu hay cộng vào thời lượng tài khoản.</p>
  </main>;
}
