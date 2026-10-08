import Link from 'next/link';
import { ArrowDown, ArrowUpRight, ChevronDown, ShieldCheck, Trophy, Users } from 'lucide-react';
import { CourtFilm } from './court-film';

/** Mở đầu gọn cho hai luồng khám phá, kèm hướng dẫn có thể mở trên điện thoại. */
export function CommunityIntro({ kind }: { kind: 'tournaments' | 'players' }) {
  const tournaments = kind === 'tournaments';
  const Icon = tournaments ? Trophy : Users;
  const steps = (tournaments ? [
    ['Chọn giải phù hợp', 'Xem ngày thi đấu, thể lệ và lệ phí.'],
    ['Gửi đăng ký', 'Ban tổ chức duyệt từng người hoặc đội.'],
    ['Đóng cọc, hẹn ngày ra sân', 'Chuyển cọc sau duyệt để xác nhận suất.'],
  ] : [
    ['Tìm bạn cùng môn', 'Chọn môn chơi và khu vực thuận tiện.'],
    ['Ghé xem hồ sơ', 'Xem trình độ, giới thiệu và giờ thường chơi.'],
    ['Chào nhau, hẹn ra sân', 'Liên hệ qua kênh người chơi đã công khai.'],
  ]);
  const guide = <ol className="mt-5 space-y-4">{steps.map(([title, description], i) => <li key={title} className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full border border-strong text-[11px] font-bold text-pitch">{i + 1}</span><div><p className="text-xs font-semibold leading-5 text-pitch">{title}</p><p className="mt-0.5 text-xs leading-5 text-ink-secondary">{description}</p></div></li>)}</ol>;
  return <header className="grid overflow-hidden rounded-[24px] border border-pitch bg-pitch lg:grid-cols-[1.6fr_1fr]">
    <div className="relative flex flex-col justify-center p-6 sm:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute right-6 top-6 text-free-line/15"><Icon size={96} strokeWidth={1} /></div>
      <p className="relative flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-free-line"><Icon size={15} aria-hidden="true" />{tournaments ? 'Sân Ngon / Giải đấu' : 'Sân Ngon / Kết nối'}</p>
      <h1 className="relative mt-4 max-w-lg font-display text-3xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-[40px]">{tournaments ? <>Một giải đấu.<br /><span className="text-free-line">Thêm một thử thách.</span></> : <>Cùng môn chơi.<br /><span className="text-free-line">Thêm bạn ra sân.</span></>}</h1>
      <p className="relative mt-4 max-w-lg text-sm leading-7 text-free-fill">{tournaments ? 'Tìm giải phù hợp, xem thể lệ và lịch thi đấu. Bắt đầu bằng một đăng ký, đóng cọc sau khi được duyệt.' : 'Gặp người chơi cùng khu vực và trình độ. Xem hồ sơ, chào nhau và tự hẹn một buổi chơi.'}</p>
      <div className="relative mt-5 flex flex-wrap items-center gap-x-5 gap-y-2"><a href="#danh-sach" className="pf-action inline-flex min-h-11 items-center gap-3 rounded-control bg-card px-4 text-xs font-semibold text-pitch hover:bg-free-fill sm:text-sm">{tournaments ? 'Khám phá giải đấu' : 'Tìm người chơi'}<ArrowDown size={15} aria-hidden="true" /></a><Link href={tournaments ? '/giai-dau/tao' : '/ket-noi/ho-so'} className="pf-action inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-white underline underline-offset-4 sm:text-sm">{tournaments ? 'Tổ chức giải đấu' : 'Hồ sơ kết nối của tôi'}<ArrowUpRight size={15} className="pf-arrow" aria-hidden="true" /></Link></div>
    </div>
    <div className="flex flex-col justify-center bg-free-fill px-6 py-3 sm:px-8 lg:py-7">
      <CourtFilm className="mb-5 hidden max-w-sm lg:block" />
      <details className="group lg:hidden"><summary className="flex min-h-11 list-none items-center justify-between gap-3 text-xs font-semibold text-pitch [&::-webkit-details-marker]:hidden"><span>{tournaments ? 'Lần đầu tham gia? Xem 3 bước' : 'Bắt đầu một kết nối'}</span><ChevronDown size={16} aria-hidden="true" className="group-open:rotate-180" /></summary><div className="pb-3">{guide}</div></details>
      <div className="hidden lg:block"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-secondary">{tournaments ? 'Từ đăng ký đến ra sân' : 'Từ lời chào đến buổi chơi'}</p>{guide}</div>
      <p className="hidden items-start gap-2 border-t border-strong pt-4 text-[11px] leading-5 text-ink-secondary lg:mt-5 lg:flex"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-pitch" aria-hidden="true" />{tournaments ? 'Xem rõ lệ phí và chính sách trước khi đăng ký.' : 'Bạn quyết định hồ sơ và kênh liên hệ nào được công khai.'}</p>
    </div>
  </header>;
}
