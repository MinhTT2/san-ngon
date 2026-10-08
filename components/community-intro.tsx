import Link from 'next/link';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { CourtFilm } from './court-film';

export function CommunityIntro({ kind }: { kind: 'tournaments' | 'players' }) {
  const tournaments = kind === 'tournaments';
  const steps = tournaments ? ['Chọn giải và đọc thể lệ.', 'Gửi đăng ký để ban tổ chức duyệt.', 'Đóng cọc sau duyệt để xác nhận suất.'] : ['Lọc theo môn chơi và khu vực.', 'Xem trình độ và giờ thường chơi trong hồ sơ.', 'Liên hệ qua kênh người chơi chọn công khai.'];
  return <header className="grid items-center gap-6 border-b border-hairline pb-6 lg:grid-cols-[1fr_240px]">
    <div>
      <p className="text-xs text-ink-secondary">Hà Nội / {tournaments ? 'Giải đấu' : 'Kết nối người chơi'}</p>
      <h1 className="mt-3 max-w-xl font-display text-3xl font-bold leading-tight tracking-tight text-pitch sm:text-4xl">{tournaments ? 'Giải đấu thể thao' : 'Tìm người chơi cùng môn'}</h1>
      <p className="mt-3 max-w-lg text-sm leading-6 text-ink-secondary">{tournaments ? 'Xem lịch thi đấu, thể lệ và lệ phí trước khi đăng ký.' : 'Xem trình độ, khu vực và giờ thường chơi. Bạn tự liên hệ để hẹn buổi chơi phù hợp.'}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1">
        <Link href={tournaments ? '/giai-dau/tao' : '/ket-noi/ho-so'} className="pf-action inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-pitch underline underline-offset-4">{tournaments ? 'Tổ chức giải đấu' : 'Hồ sơ kết nối của tôi'}<ArrowUpRight size={15} className="pf-arrow" aria-hidden="true" /></Link>
        <details className="group relative">
          <summary className="flex min-h-11 list-none items-center gap-2 text-xs text-ink-secondary [&::-webkit-details-marker]:hidden">{tournaments ? 'Cách tham gia' : 'Cách liên hệ'}<ChevronDown size={14} aria-hidden="true" className="group-open:rotate-180" /></summary>
          <ol className="max-w-md space-y-2 pb-2 text-xs leading-6 text-ink-secondary">{steps.map((step, index) => <li key={step}>{index + 1}. {step}</li>)}</ol>
        </details>
      </div>
    </div>
    <div className="hidden lg:block"><CourtFilm /><p className="mt-3 text-[11px] leading-5 text-ink-secondary">{tournaments ? 'Cọc sau khi ban tổ chức duyệt đăng ký.' : 'Chỉ hiển thị hồ sơ và kênh liên hệ đã được người chơi đồng ý công khai.'}</p></div>
  </header>;
}
