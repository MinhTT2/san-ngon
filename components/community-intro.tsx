import Link from 'next/link';
import { ArrowDown, ArrowUpRight, ChevronDown, ShieldCheck, Trophy, Users } from 'lucide-react';
import { CourtFilm } from './court-film';

/** Keep discovery above the fold; the guide opens only when needed. */
export function CommunityIntro({ kind }: { kind: 'tournaments' | 'players' }) {
  const tournaments = kind === 'tournaments';
  const Icon = tournaments ? Trophy : Users;
  const steps = tournaments ? [
    ['Chọn giải phù hợp', 'Xem lịch, thể lệ và lệ phí.'],
    ['Gửi đăng ký', 'Chờ ban tổ chức duyệt.'],
    ['Đóng cọc sau duyệt', 'Xác nhận suất và hẹn ngày ra sân.'],
  ] : [
    ['Tìm bạn cùng môn', 'Chọn môn chơi và khu vực.'],
    ['Ghé xem hồ sơ', 'Xem trình độ và giờ thường chơi.'],
    ['Chào nhau, hẹn ra sân', 'Liên hệ qua kênh được công khai.'],
  ];
  return <header className="grid overflow-hidden rounded-[24px] border border-pitch bg-pitch lg:grid-cols-[1fr_340px]">
    <div className="relative flex flex-col justify-center p-6 sm:p-8">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-free-line"><Icon size={15} aria-hidden="true" />{tournaments ? 'Sân Ngon / Giải đấu' : 'Sân Ngon / Kết nối'}</p>
      <h1 className="mt-4 font-display text-3xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl">{tournaments ? <>Một giải đấu.<br /><span className="text-free-line">Thêm một thử thách.</span></> : <>Cùng môn chơi.<br /><span className="text-free-line">Thêm bạn ra sân.</span></>}</h1>
      <p className="mt-4 max-w-lg text-sm leading-7 text-free-fill">{tournaments ? 'Tìm giải phù hợp, xem thể lệ và lịch thi đấu. Gửi đăng ký, đóng cọc sau khi được duyệt.' : 'Tìm người cùng môn và cùng khu vực. Một lời chào, một lịch hẹn, thêm một người bạn ở sân.'}</p>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <a href="#danh-sach" className="pf-action inline-flex min-h-11 items-center gap-3 rounded-control bg-card px-4 text-sm font-semibold text-pitch hover:bg-free-fill">{tournaments ? 'Khám phá giải đấu' : 'Tìm người chơi'}<ArrowDown size={15} aria-hidden="true" /></a>
        <Link href={tournaments ? '/giai-dau/tao' : '/ket-noi/ho-so'} className="pf-action inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-white underline underline-offset-4">{tournaments ? 'Tổ chức giải đấu' : 'Hồ sơ kết nối của tôi'}<ArrowUpRight size={15} className="pf-arrow" aria-hidden="true" /></Link>
      </div>
      <details className="group mt-5 border-t border-free-line/20">
        <summary className="flex min-h-11 list-none items-center justify-between gap-3 text-xs font-semibold text-free-fill [&::-webkit-details-marker]:hidden"><span>{tournaments ? 'Lần đầu tham gia? Xem 3 bước' : 'Từ lời chào đến buổi chơi'}</span><ChevronDown size={15} aria-hidden="true" className="group-open:rotate-180" /></summary>
        <ol className="grid gap-4 pb-4 pt-2 sm:grid-cols-3">{steps.map(([title, description], index) => <li key={title}><span className="font-display text-lg font-bold text-free-line">0{index + 1}</span><p className="mt-1 text-xs font-semibold text-white">{title}</p><p className="mt-1 text-[11px] leading-5 text-free-fill">{description}</p></li>)}</ol>
      </details>
    </div>
    <div className="hidden flex-col justify-center gap-5 border-l border-free-line/20 p-6 lg:flex">
      <CourtFilm />
      <p className="flex items-start gap-2 text-[11px] leading-6 text-free-fill"><ShieldCheck size={15} aria-hidden="true" className="mt-1 shrink-0 text-free-line" />{tournaments ? 'Xem rõ lệ phí và chính sách trước khi đăng ký.' : 'Bạn quyết định hồ sơ và kênh liên hệ nào được công khai.'}</p>
    </div>
  </header>;
}
