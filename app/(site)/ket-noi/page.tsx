export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SPORT_LABELS } from '@/lib/constants';
import { skillLabels, type CommunityProfile } from '@/lib/community';
import { UserAvatar } from '@/components/user-avatar';
import { fieldClass } from '@/components/tournament-fields';
export const metadata = { title: 'Kết nối người chơi' };
export default async function Page({ searchParams }: { searchParams: Promise<{ sport?: string; location?: string; page?: string }> }) {
  const params = await searchParams; const sport = Object.hasOwn(SPORT_LABELS,params.sport ?? '') ? params.sport! : '';
  const location = typeof params.location === 'string' ? params.location.slice(0,200) : '';
  const page = /^\d+$/.test(params.page ?? '') ? Math.max(1,Math.min(10000,Number(params.page))) : 1;
  const db = await createClient(); const { data, error } = await db.rpc('search_community',{ p_sport: sport, p_location: location, p_page: page });
  if (error) throw new Error('Chưa tải được danh sách kết nối.');
  const result = data as { total: number; rows: CommunityProfile[] };
  const pageHref = (p: number) => `?${new URLSearchParams({ sport, location, page: String(p) })}`;
  return <main className="mx-auto max-w-7xl px-5 py-10 lg:px-16"><header className="flex flex-wrap items-end justify-between gap-5"><div><h1 className="font-display text-4xl font-extrabold text-pitch">Kết nối trên sân</h1><p className="mt-3 text-sm leading-7 text-ink-secondary">Tìm người cùng môn, cùng khu vực. Mở hồ sơ để tự liên hệ qua điện thoại, Zalo hoặc Facebook.</p></div><Link href="/ket-noi/ho-so" className="rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink">Hồ sơ kết nối của tôi</Link></header>
    <form className="my-7 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-sm">Môn chơi<select className={`${fieldClass} mt-2`} name="sport" defaultValue={sport}><option value="">Tất cả môn</option>{Object.entries(SPORT_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label><label className="text-sm">Khu vực<input className={`${fieldClass} mt-2`} name="location" defaultValue={location} maxLength={200} placeholder="Ví dụ: Cầu Giấy, Hà Nội" /></label><button className="self-end rounded-control border border-hairline bg-card px-6 py-3 text-sm font-semibold">Tìm người chơi</button></form>
    <p className="text-sm text-ink-secondary">{result.total} hồ sơ công khai</p><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{result.rows.map(p => <Link key={p.user_id} href={`/ket-noi/${p.user_id}`} className="rounded-card border border-hairline bg-card p-6 hover:border-pitch"><UserAvatar name={p.display_name} avatar={p.avatar_url} className="size-16 text-2xl" /><h2 className="mt-4 font-display text-xl font-bold text-pitch">{p.display_name}</h2><p className="mt-2 text-sm text-ink-secondary">{p.location}</p><p className="mt-3 text-sm">{SPORT_LABELS[p.sport]} · {skillLabels[p.skill_level]}</p><p className="mt-4 text-sm font-semibold text-pitch">Xem thông tin liên hệ →</p></Link>)}</div>
    {!result.rows.length && <p className="my-8 text-sm text-ink-secondary">Chưa tìm thấy hồ sơ phù hợp. Thử khu vực hoặc môn khác.</p>}<nav aria-label="Trang người chơi" className="mt-6 flex gap-5 text-sm font-semibold text-pitch">{page > 1 && <Link href={pageHref(page-1)}>← Trang trước</Link>}{result.total>page*24 && <Link href={pageHref(page+1)}>Trang sau →</Link>}</nav>
  </main>;
}
