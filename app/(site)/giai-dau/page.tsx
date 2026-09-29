export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TournamentList } from '@/components/tournament-list';
import { SPORT_LABELS } from '@/lib/constants';
export const metadata = { title: 'Giải đấu thể thao' };
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string; sport?: string; page?: string }> }) {
  const params = await searchParams;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (params.view === 'mine' && !user) redirect('/dang-nhap?next=/giai-dau?view=mine');
  const page = /^\d+$/.test(params.page ?? '') ? Math.max(1, Math.min(10000, Number(params.page))) : 1;
  const { data: registrations, error } = user ? await db.from('tournament_registrations').select('id,tournament_id,status,tournaments(title)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30).returns<{ id: string; tournament_id: string; status: string; tournaments: { title: string } }[]>() : { data: null, error: null };
  if (error) throw new Error('Không tải được đăng ký của bạn.');
  return <main className="mx-auto max-w-7xl px-5 py-10 lg:px-16"><div className="flex flex-wrap items-end justify-between gap-5"><div><h1 className="font-display text-4xl font-extrabold text-pitch">Giải đấu</h1><p className="mt-3 text-sm text-ink-secondary">Chọn giải, gửi đăng ký và gặp nhau trên sân.</p></div><Link href="/giai-dau/tao" className="rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink">Đề xuất tổ chức giải</Link></div>
    <nav className="my-6 flex gap-5 text-sm font-semibold text-pitch"><Link href="/giai-dau" aria-current={params.view !== 'mine' ? 'page' : undefined}>Tất cả giải</Link><Link href="/giai-dau?view=mine" aria-current={params.view === 'mine' ? 'page' : undefined}>Giải tôi quản lý / đã đề xuất</Link></nav>
    <form className="flex flex-wrap gap-3"><input type="hidden" name="view" value={params.view === 'mine' ? 'mine' : 'all'} /><label className="text-sm">Môn thi đấu <select name="sport" defaultValue={params.sport ?? ''} className="ml-3 min-h-11 rounded-control border border-hairline bg-card px-3"><option value="">Tất cả môn</option>{Object.entries(SPORT_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label><button className="rounded-control border border-hairline px-5 text-sm font-semibold">Lọc giải</button></form>
    <TournamentList mode={params.view === 'mine' ? 'mine' : 'public'} sport={params.sport} page={page} />
    {!!registrations?.length && <section className="mt-10"><h2 className="font-display text-2xl font-bold text-pitch">Giải tôi đã đăng ký</h2><ul className="mt-4 space-y-3">{registrations.map(r => <li key={r.id}><Link className="block rounded-control border border-hairline bg-card p-4 text-sm font-semibold text-pitch" href={`/giai-dau/${r.tournament_id}`}>{r.tournaments?.title ?? 'Xem đăng ký giải đấu'} →</Link></li>)}</ul></section>}
  </main>;
}
