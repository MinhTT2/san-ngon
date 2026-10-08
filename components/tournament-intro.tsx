import Link from 'next/link';
import { ArrowUpRight, ChevronDown, Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export async function TournamentIntro() {
  const db = await createClient();
  const now = new Date().toISOString();
  const [active, completed] = await Promise.all([
    db.from('tournaments').select('id', { count: 'exact', head: true }).eq('status', 'published').gt('ends_at', now),
    db.from('tournaments').select('id', { count: 'exact', head: true }).or(`status.eq.completed,and(status.eq.published,ends_at.lte.${now})`),
  ]);
  if (active.error || completed.error) throw new Error('Chưa tải được tổng quan giải đấu.');
  return <header className="overflow-hidden rounded-[24px] border border-pitch bg-pitch text-pitch-ink">
    <div className="grid lg:grid-cols-[1fr_320px]">
      <div className="relative overflow-hidden p-6 sm:p-8 lg:p-10">
        <svg aria-hidden="true" viewBox="0 0 420 280" fill="none" className="pointer-events-none absolute -right-24 top-0 h-full text-free-line/10"><path d="M20 20H400V260H20ZM210 20V260M20 70H70V210H20M400 70H350V210H400" stroke="currentColor" strokeWidth="2" /><circle cx="210" cy="140" r="52" stroke="currentColor" strokeWidth="2" /></svg>
        <p className="relative flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-free-line"><Trophy size={16} aria-hidden="true" />Sân Ngon / Giải đấu</p>
        <h1 className="relative mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">Cùng đam mê.<br /><span className="text-free-line">Chung một sân đấu.</span></h1>
        <p className="relative mt-5 max-w-lg text-sm leading-7 text-free-fill">Tìm giải phù hợp, rủ đội cùng tham gia. Lịch thi đấu, thể lệ và lệ phí rõ ràng trước khi bạn ra sân.</p>
        <div className="relative mt-6 flex flex-wrap items-center gap-3"><a href="#danh-sach" className="pf-action inline-flex min-h-11 items-center gap-2 rounded-control bg-card px-5 text-sm font-semibold text-pitch">Khám phá giải đấu<ArrowUpRight size={16} aria-hidden="true" /></a><Link href="/giai-dau/tao" className="pf-action inline-flex min-h-11 items-center gap-2 rounded-control border border-free-line/40 px-5 text-sm font-semibold text-pitch-ink">Tổ chức giải đấu<ArrowUpRight size={16} aria-hidden="true" /></Link></div>
      </div>
      <div className="flex flex-col justify-between border-t border-free-line/20 p-6 sm:px-8 lg:border-l lg:border-t-0 lg:p-8">
        <dl className="grid grid-cols-2 gap-5 lg:grid-cols-1 lg:gap-6">{[[active.count ?? 0, 'Sắp / đang diễn ra'], [completed.count ?? 0, 'Giải đã kết thúc']].map(([value, label]) => <div key={label}><dt className="text-xs text-free-line">{label}</dt><dd className="mt-2 font-display text-4xl font-bold">{value}</dd></div>)}</dl>
        <details className="group mt-6 border-t border-free-line/20 pt-3"><summary className="flex min-h-11 list-none items-center justify-between gap-3 text-xs font-semibold [&::-webkit-details-marker]:hidden">Lần đầu tham gia? Xem 3 bước<ChevronDown size={16} aria-hidden="true" className="shrink-0 group-open:rotate-180" /></summary><ol className="space-y-3 pb-2 pt-3 text-xs leading-6 text-free-fill">{['Chọn giải và đọc thể lệ.', 'Gửi đăng ký, chờ ban tổ chức duyệt.', 'Đóng cọc sau duyệt để xác nhận suất.'].map((step, i) => <li key={step} className="flex gap-3"><span className="font-semibold text-free-line">0{i + 1}</span>{step}</li>)}</ol></details>
      </div>
    </div>
  </header>;
}