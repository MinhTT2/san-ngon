export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SPORT_LABELS } from '@/lib/constants';
import type { CommunityProfile } from '@/lib/community';
import { CommunityPlayerCard } from '@/components/community-player-card';
import { SportShortcuts } from '@/components/sport-shortcuts';
import { ShieldCheck } from 'lucide-react';
import { CommunityIntro } from '@/components/community-intro';
import { DiscoveryEmpty } from '@/components/discovery-empty';
import { fieldClass } from '@/components/form-field';
export const metadata = { title: 'Kết nối người chơi' };
export default async function Page({ searchParams }: { searchParams: Promise<{ sport?: string; location?: string; page?: string }> }) {
  const params = await searchParams; const sport = Object.hasOwn(SPORT_LABELS,params.sport ?? '') ? params.sport! : '';
  const location = typeof params.location === 'string' ? params.location.slice(0,200) : '';
  const page = /^\d+$/.test(params.page ?? '') ? Math.max(1,Math.min(10000,Number(params.page))) : 1;
  const db = await createClient(); const { data, error } = await db.rpc('search_community',{ p_sport: sport, p_location: location, p_page: page });
  if (error) throw new Error('Chưa tải được danh sách kết nối.');
  const result = data as { total: number; rows: CommunityProfile[] };
  const pageHref = (p: number) => `?${new URLSearchParams({ sport, location, page: String(p) })}`;
  return <main className="mx-auto max-w-7xl px-5 pb-12 pt-6 lg:px-16 lg:pt-8">
    <CommunityIntro kind="players" />
    <section id="danh-sach" aria-label="Khám phá người chơi" className="mt-6 scroll-mt-6">
      <SportShortcuts pathname="/ket-noi" sport={sport} params={{ location }} />
      <form className="mt-3 grid min-w-0 gap-3 rounded-[20px] border border-hairline bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:p-5"><label className="min-w-0 text-xs font-semibold text-ink-secondary">Môn chơi<select className={`${fieldClass} mt-2`} name="sport" defaultValue={sport}><option value="">Tất cả môn</option>{Object.entries(SPORT_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label><label className="min-w-0 text-xs font-semibold text-ink-secondary">Khu vực<input className={`${fieldClass} mt-2`} name="location" defaultValue={location} maxLength={200} placeholder="Ví dụ: Cầu Giấy, Hà Nội" /></label><button className="pf-action min-h-11 self-end rounded-control bg-pitch px-4 py-2 text-sm font-semibold text-pitch-ink hover:bg-ink">Tìm người chơi</button></form>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-4"><div><h2 className="font-display text-xl font-bold text-pitch">{sport || location ? 'Người chơi phù hợp' : 'Gặp nhau từ một môn chơi'}</h2><p className="mt-2 text-xs text-ink-secondary">{result.total} hồ sơ công khai{sport ? ` · ${SPORT_LABELS[sport]}` : ''}</p></div><p className="flex items-center gap-1.5 text-[11px] text-ink-secondary"><ShieldCheck size={14} className="text-pitch" aria-hidden="true" />Liên hệ qua kênh người chơi chọn chia sẻ</p></div>
      {(sport || location) && <Link href="/ket-noi" className="mt-2 inline-flex min-h-11 items-center text-xs font-semibold text-pitch underline underline-offset-4">Xóa bộ lọc</Link>}
      <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{result.rows.map(profile => <CommunityPlayerCard key={profile.user_id} profile={profile} />)}</ul>
    </section>
    {!result.rows.length && <DiscoveryEmpty title={sport || location || page > 1 ? 'Chưa gặp đúng bạn chơi?' : 'Một cộng đồng bắt đầu từ bạn'} description={sport || location || page > 1 ? 'Thử mở rộng khu vực hoặc chọn thêm môn chơi để tìm hồ sơ phù hợp.' : 'Tạo hồ sơ, chia sẻ môn yêu thích và thời gian thường ra sân. Bạn quyết định khi nào công khai thông tin liên hệ.'} href={sport || location || page > 1 ? '/ket-noi' : '/ket-noi/ho-so'} label={sport || location || page > 1 ? 'Xem tất cả người chơi' : 'Tạo hồ sơ kết nối'} />}
    <nav aria-label="Trang người chơi" className="mt-6 flex gap-5 text-sm font-semibold text-pitch">{page > 1 && <Link className="py-3" href={pageHref(page-1)}>← Trang trước</Link>}{result.total>page*24 && <Link className="py-3" href={pageHref(page+1)}>Trang sau →</Link>}</nav>
  </main>;
}
