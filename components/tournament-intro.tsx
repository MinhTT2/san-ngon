import Link from 'next/link';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { TournamentGuideVideo } from './tournament-guide-video';

export async function TournamentIntro() {
  const db = await createClient();
  const now = new Date().toISOString();
  const [active, completed] = await Promise.all([
    db.from('tournaments').select('id', { count: 'exact', head: true }).eq('status', 'published').gt('ends_at', now),
    db.from('tournaments').select('id', { count: 'exact', head: true }).or(`status.eq.completed,and(status.eq.published,ends_at.lte.${now})`),
  ]);
  if (active.error || completed.error) throw new Error('Chưa tải được tổng quan giải đấu.');
  return <header className="grid items-start gap-6 border-b border-hairline pb-6 lg:grid-cols-[1fr_240px]">
    <div>
      <p className="text-xs text-ink-secondary">Hà Nội / Giải đấu</p>
      <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight text-pitch sm:text-4xl">Giải đấu thể thao</h1>
      <p className="mt-3 max-w-lg text-sm leading-6 text-ink-secondary">Xem lịch thi đấu, thể lệ và lệ phí. Đăng ký cá nhân hoặc đội theo quy định của từng giải.</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-secondary"><span><strong className="text-base text-pitch">{active.count ?? 0}</strong> giải sắp hoặc đang diễn ra</span><span><strong className="text-base text-pitch">{completed.count ?? 0}</strong> giải đã kết thúc</span></div>
      <div className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-1">
        <Link href="/giai-dau/tao" className="pf-action inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-pitch underline underline-offset-4">Tổ chức giải đấu<ArrowUpRight size={15} className="pf-arrow" aria-hidden="true" /></Link>
        <details className="group"><summary className="flex min-h-11 list-none items-center gap-2 text-xs text-ink-secondary [&::-webkit-details-marker]:hidden">Cách tham gia<ChevronDown size={14} aria-hidden="true" className="group-open:rotate-180" /></summary><ol className="space-y-2 pb-2 text-xs leading-6 text-ink-secondary">{['Chọn giải và đọc thể lệ.', 'Gửi đăng ký để ban tổ chức duyệt.', 'Đóng cọc sau duyệt để xác nhận suất.'].map((step, index) => <li key={step}>{index + 1}. {step}</li>)}</ol></details>
      </div>
    </div>
    <div><details className="rounded-control border border-hairline px-4 lg:hidden"><summary className="flex min-h-11 cursor-pointer items-center justify-between text-sm font-semibold text-pitch">Video hướng dẫn · 18 giây<ChevronDown size={16} aria-hidden="true" /></summary><div className="max-w-[280px] pb-4"><TournamentGuideVideo /></div></details><div className="hidden lg:block [&>button]:mt-0"><TournamentGuideVideo /></div></div>
  </header>;
}
