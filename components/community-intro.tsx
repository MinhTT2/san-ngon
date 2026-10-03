import Link from 'next/link';

/** Shared introduction for the two ways to meet other players. */
export function CommunityIntro({ kind }: { kind: 'tournaments' | 'players' }) {
  const tournaments = kind === 'tournaments';
  const steps = <ol className="mt-6 space-y-5">{(tournaments ? [
    ['Chọn giải phù hợp', 'Xem lịch thi đấu, thể lệ và lệ phí.'],
    ['Gửi đăng ký', 'Ban tổ chức duyệt từng người hoặc đội.'],
    ['Đóng cọc, hẹn ngày ra sân', 'Chuyển cọc sau khi được duyệt; tự động xác nhận.'],
  ] : [
    ['Tìm bạn cùng môn', 'Lọc theo môn chơi và khu vực thuận tiện.'],
    ['Làm quen trực tiếp', 'Xem hồ sơ, liên hệ qua điện thoại hoặc mạng xã hội.'],
    ['Bạn chọn điều muốn chia sẻ', 'Chỉ hồ sơ đồng ý công khai mới xuất hiện.'],
  ]).map(([title, description], i) => <li key={title} className="flex gap-4"><span className="grid size-9 shrink-0 place-items-center rounded-full border border-strong text-xs font-bold text-pitch">0{i + 1}</span><div><p className="text-sm font-semibold text-pitch">{title}</p><p className="mt-1 text-xs leading-6 text-ink-secondary">{description}</p></div></li>)}</ol>;
  const guide = tournaments ? 'Từ đăng ký đến ra sân' : 'Bắt đầu một kết nối';
  if (tournaments) return <header className="rounded-card border border-strong bg-free-fill p-5 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-widest text-ink-secondary">Sân Ngon / Giải đấu</p><h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-pitch sm:text-4xl">Tìm giải để cùng ra sân</h1><p className="mt-2 text-sm leading-6 text-ink-secondary">Chọn môn, xem lịch và lệ phí. Gửi đăng ký, đóng cọc sau khi được duyệt.</p></div><Link href="/giai-dau/tao" className="inline-flex min-h-11 items-center rounded-control border border-strong bg-card px-5 text-sm font-semibold text-pitch">Tổ chức giải đấu ↗</Link></div>
    <details className="mt-4 border-t border-strong pt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-pitch">Lần đầu tham gia? Xem 3 bước</summary>{steps}</details>
  </header>;
  return <header className="grid overflow-hidden rounded-[24px] border border-strong bg-free-fill lg:grid-cols-[1.4fr_1fr]">
    <div className="p-6 sm:p-9 lg:p-10">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-pitch">Sân Ngon / {tournaments ? 'Giải đấu' : 'Cộng đồng'}</p>
      <h1 className="mt-5 max-w-xl font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-pitch sm:text-5xl">{tournaments ? <>Ra sân.<br />Thêm một thử thách.</> : <>Cùng môn chơi.<br />Thêm bạn ra sân.</>}</h1>
      <p className="mt-5 max-w-lg text-sm leading-7 text-ink-secondary">{tournaments ? 'Tìm giải vừa sức, gặp những đối thủ mới. Chọn môn yêu thích và bắt đầu từ một đăng ký.' : 'Tìm người chơi cùng khu vực, cùng trình độ. Một lời chào hôm nay, một buổi chơi cùng nhau ngày mai.'}</p>
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2"><a href="#danh-sach" className="inline-flex min-h-11 items-center gap-5 rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink hover:bg-pitch/90">{tournaments ? 'Khám phá giải đấu' : 'Tìm người chơi'} <span aria-hidden="true">↓</span></a><Link href={tournaments ? '/giai-dau/tao' : '/ket-noi/ho-so'} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-pitch underline underline-offset-4">{tournaments ? 'Tổ chức giải đấu' : 'Hồ sơ kết nối của tôi'} <span aria-hidden="true">↗</span></Link></div>
    </div>
    <div className="flex flex-col justify-center border-t border-strong bg-card/60 px-6 py-4 sm:p-9 lg:border-l lg:border-t-0 lg:p-10">
      <details className="lg:hidden"><summary className="min-h-6 text-sm font-semibold text-pitch">{guide}</summary>{steps}</details><div className="hidden lg:block"><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-secondary">{guide}</p>{steps}</div>
    </div>
  </header>;
}
