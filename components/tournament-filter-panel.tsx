'use client';
import { useEffect, useRef, useState } from 'react';
import { enterMotion } from '@/lib/motion';
import Link from 'next/link';
import { Search, SlidersHorizontal } from 'lucide-react';
import { SPORT_LABELS } from '@/lib/constants';
import type { TournamentFilters } from '@/lib/tournament-discovery';

export function TournamentFilterPanel({ filters, view }: { filters: TournamentFilters; view: string }) {
  const [expanded, setExpanded] = useState(!!(filters.q || filters.location || filters.sport || filters.status));
  const optionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (expanded && optionsRef.current && !window.matchMedia('(min-width: 1024px)').matches) return enterMotion(optionsRef.current, 0, -8);
  }, [expanded]);
  const filtered = !!(filters.q || filters.location || filters.sport || filters.status);
  const control = 'min-h-11 w-full min-w-0 rounded-control border border-hairline bg-page px-3 text-sm font-normal text-ink';
  return <aside className="min-w-0 rounded-card border border-hairline bg-card p-5 lg:sticky lg:top-24">
    <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-display text-lg font-bold text-pitch"><SlidersHorizontal size={18} aria-hidden="true" />Tìm giải của bạn</h2><button type="button" aria-expanded={expanded} aria-controls="tournament-filter-options" onClick={() => setExpanded(!expanded)} className="min-h-11 shrink-0 rounded-control border border-hairline px-3 text-xs font-semibold text-pitch lg:hidden">{expanded ? 'Thu gọn' : 'Bộ lọc'}</button></div>
    <form action="/giai-dau" aria-label="Lọc giải đấu" className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
      <input type="hidden" name="view" value={view} /><input type="hidden" name="layout" value={filters.layout} />
      <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold text-ink-secondary sm:col-span-2 lg:col-span-1">Tên giải đấu<span className="relative"><Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5" /><input name="q" type="search" defaultValue={filters.q} maxLength={100} placeholder="Bạn đang tìm giải nào?" className={`${control} pl-9`} /></span></label>
      <div ref={optionsRef} id="tournament-filter-options" className={`${expanded ? 'grid' : 'hidden'} gap-4 sm:col-span-2 sm:grid-cols-2 lg:col-span-1 lg:grid lg:grid-cols-1`}>
      <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold text-ink-secondary">Khu vực<input name="location" type="search" defaultValue={filters.location} maxLength={100} placeholder="Ví dụ: Cầu Giấy" className={control} /></label>
      <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold text-ink-secondary">Môn thi đấu<select name="sport" defaultValue={filters.sport} className={control}><option value="">Tất cả môn</option>{Object.entries(SPORT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {view === 'all' && <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold text-ink-secondary">Trạng thái<select name="status" defaultValue={filters.status} className={control}><option value="">Sắp / đang diễn ra</option><option value="open">Đang nhận đăng ký</option><option value="upcoming">Sắp diễn ra</option><option value="ongoing">Đang diễn ra</option><option value="completed">Đã kết thúc</option></select></label>}
      <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold text-ink-secondary">Sắp xếp<select name="sort" defaultValue={filters.sort} className={control}><option value="soonest">Ngày thi đấu</option><option value="newest">Mới đăng</option><option value="fee">Lệ phí thấp nhất</option></select></label>
      </div>
      <div className="flex flex-col justify-end gap-2 sm:col-span-2 lg:col-span-1"><button className="pf-action flex min-h-11 items-center justify-center gap-2 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink"><Search size={16} aria-hidden="true" />Lọc giải</button>{filtered && <Link href={`/giai-dau?view=${view}&layout=${filters.layout}`} className="inline-flex min-h-11 items-center justify-center text-xs font-semibold text-pitch underline underline-offset-4">Xóa bộ lọc</Link>}</div>
    </form>
    <p className="mt-5 hidden border-t border-hairline pt-4 text-xs lg:block leading-6 text-ink-secondary">Gửi đăng ký trước. Chỉ chuyển cọc sau khi được ban tổ chức duyệt.</p>
  </aside>;
}