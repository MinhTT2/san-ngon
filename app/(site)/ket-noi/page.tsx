export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SPORT_LABELS } from '@/lib/constants';
import { skillLabels, type CommunityProfile } from '@/lib/community';
import { UserAvatar } from '@/components/user-avatar';
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
  return <main className="mx-auto max-w-7xl px-5 py-8 lg:px-16 lg:py-10">
    <CommunityIntro kind="players" />
    <form id="danh-sach" className="my-7 scroll-mt-28 grid gap-4 rounded-card border border-hairline bg-card p-5 sm:grid-cols-[1fr_1fr_auto]"><label className="text-xs font-semibold">Môn chơi<select className={`${fieldClass} mt-2`} name="sport" defaultValue={sport}><option value="">Tất cả môn</option>{Object.entries(SPORT_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label><label className="text-xs font-semibold">Khu vực<input className={`${fieldClass} mt-2`} name="location" defaultValue={location} maxLength={200} placeholder="Ví dụ: Cầu Giấy, Hà Nội" /></label><button className="min-h-11 self-end rounded-control bg-pitch px-6 py-3 text-sm font-semibold text-pitch-ink">Tìm người chơi</button></form>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-2xl font-bold text-pitch">{sport || location ? 'Người chơi phù hợp' : 'Gặp nhau từ một môn chơi'}</h2><p className="text-sm text-ink-secondary">{result.total} hồ sơ công khai</p></div>
    {(sport || location) && <Link href="/ket-noi" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline underline-offset-4">Xóa bộ lọc</Link>}
    <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{result.rows.map(p => <Link key={p.user_id} href={`/ket-noi/${p.user_id}`} className="group min-w-0 overflow-hidden rounded-card border border-hairline bg-card transition-colors hover:border-pitch"><div className="flex items-center gap-4 border-b border-hairline bg-free-fill/50 p-5"><UserAvatar name={p.display_name} avatar={p.avatar_url} className="size-14 shrink-0 text-xl" /><div className="min-w-0"><h3 className="break-words font-display text-xl font-bold text-pitch">{p.display_name}</h3><p className="mt-1 break-words text-sm text-ink-secondary">{p.location}</p></div></div><div className="p-5"><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-free-fill px-3 py-1.5 font-semibold text-pitch">{SPORT_LABELS[p.sport]}</span><span className="rounded-full border border-hairline px-3 py-1.5 text-ink-secondary">{skillLabels[p.skill_level]}</span></div><p className="mt-6 flex justify-between gap-3 text-sm font-semibold text-pitch">Làm quen & liên hệ <span aria-hidden="true">↗</span></p></div></Link>)}</div>
    {!result.rows.length && <DiscoveryEmpty title={sport || location || page > 1 ? 'Chưa gặp đúng bạn chơi?' : 'Một cộng đồng bắt đầu từ bạn'} description={sport || location || page > 1 ? 'Thử mở rộng khu vực hoặc chọn thêm môn chơi để tìm hồ sơ phù hợp.' : 'Tạo hồ sơ, chia sẻ môn yêu thích và thời gian thường ra sân. Bạn quyết định khi nào công khai thông tin liên hệ.'} href={sport || location || page > 1 ? '/ket-noi' : '/ket-noi/ho-so'} label={sport || location || page > 1 ? 'Xem tất cả người chơi' : 'Tạo hồ sơ kết nối'} />}
    <nav aria-label="Trang người chơi" className="mt-6 flex gap-5 text-sm font-semibold text-pitch">{page > 1 && <Link className="py-3" href={pageHref(page-1)}>← Trang trước</Link>}{result.total>page*24 && <Link className="py-3" href={pageHref(page+1)}>Trang sau →</Link>}</nav>
  </main>;
}
