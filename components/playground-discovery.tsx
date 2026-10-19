import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Reveal } from './reveal';

const features = [
  { key: 'courts', number: '01', label: 'Đặt sân', title: 'Giữ giờ cho buổi chơi.', description: 'Chọn sân, xem lịch trống và giá trước khi đặt.', href: '/tim-san', cta: 'Khám phá sân' },
  { key: 'tournaments', number: '02', label: 'Giải đấu', title: 'Thêm một lần thử sức.', description: 'Tìm giải phù hợp, đọc thể lệ và đăng ký tham gia.', href: '/giai-dau', cta: 'Tìm giải đấu' },
  { key: 'players', number: '03', label: 'Kết nối', title: 'Có bạn, vui hơn.', description: 'Tìm người cùng môn và tự liên hệ để hẹn buổi chơi.', href: '/ket-noi', cta: 'Gặp người chơi' },
] as const;

/** Original vector artwork: a court, a tournament bracket and a circle of players. */
function PlaygroundArtwork({ kind }: { kind: typeof features[number]['key'] }) {
  return <div className="pf-playground-art" aria-hidden="true">
    <div className="pf-playground-orbit" />
    <div className="pf-playground-board">
      <svg viewBox="0 0 240 150" fill="none" className="h-full w-full" stroke="currentColor" strokeWidth="1.5">
        <rect x="14" y="14" width="212" height="122" rx="3" />
        {kind === 'courts' ? <>
          <path d="M120 14v122M14 44h32v62H14m212-62h-32v62h32" />
          <circle cx="120" cy="75" r="24" /><circle cx="120" cy="75" r="2" fill="currentColor" />
          <path d="M14 57h12v36H14m212-36h-12v36h12" />
        </> : kind === 'tournaments' ? <>
          <path d="M47 38h37v27h36m-73 47h37V85h36m73-47h-37v27h-36m73 47h-37V85h-36M120 65v20" />
          {[38, 112].flatMap(cy => [47, 193].map(cx => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="8" fill="var(--color-pitch)" />))}
          <circle cx="120" cy="75" r="13" fill="var(--color-free-fill)" stroke="var(--color-pitch)" />
          <path d="m114 75 4 4 8-8" stroke="var(--color-pitch)" />
        </> : <>
          <path d="m120 36 56 68H64l56-68Z" strokeDasharray="4 5" />
          {[[120, 36], [64, 104], [176, 104]].map(([cx, cy]) => <g key={cx}>
            <circle cx={cx} cy={cy} r="18" fill="var(--color-pitch)" />
            <circle cx={cx} cy={cy - 4} r="5" /><path d={`M${cx - 8} ${cy + 9}q8-14 16 0`} />
          </g>)}
        </>}
      </svg>
    </div>
    <span className="pf-playground-chip">{kind === 'courts' ? 'Chọn giờ' : kind === 'tournaments' ? 'Ra thi đấu' : 'Hẹn buổi chơi'}<ArrowUpRight size={14} /></span>
  </div>;
}

export function PlaygroundDiscovery() {
  return <section className="mx-auto max-w-7xl px-5 pt-12 lg:px-16 lg:pt-16" aria-labelledby="playground-title">
    <Reveal className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-secondary">Không chỉ là đặt sân</p><h2 id="playground-title" className="mt-3 font-display text-3xl font-bold tracking-tight text-pitch sm:text-4xl">Một sân chơi, nhiều cuộc hẹn.</h2></div>
      <p className="max-w-xs text-sm leading-6 text-ink-secondary">Từ buổi chơi quen thuộc đến một giải đấu mới. Chọn cách bạn muốn ra sân.</p>
    </Reveal>
    <ul className="grid gap-5 md:grid-cols-3">
      {features.map(feature => <li key={feature.key} className="min-w-0">
        <Link href={feature.href} data-depth="" data-playground={feature.key} className="pf-depth-card pf-playground-card pf-card group flex h-full min-w-0 flex-col overflow-hidden rounded-[20px] border border-hairline bg-card focus-visible:outline-offset-4">
          <div className="flex items-center justify-between px-6 pt-5 text-xs font-semibold text-pitch"><span>{feature.label}</span><span className="font-normal tabular-nums text-ink-secondary">{feature.number}</span></div>
          <PlaygroundArtwork kind={feature.key} />
          <div className="flex flex-1 flex-col px-6 pb-6"><h3 className="font-display text-xl font-bold tracking-tight text-pitch">{feature.title}</h3><p className="mb-5 mt-2 text-sm leading-6 text-ink-secondary">{feature.description}</p><span className="mt-auto flex min-h-11 items-center justify-between gap-3 border-t border-hairline pt-4 text-xs font-semibold text-pitch">{feature.cta}<ArrowUpRight size={18} className="pf-arrow" aria-hidden="true" /></span></div>
        </Link>
      </li>)}
    </ul>
  </section>;
}
