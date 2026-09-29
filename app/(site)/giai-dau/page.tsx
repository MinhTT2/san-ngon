export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TournamentList } from '@/components/tournament-list';
import { CommunityIntro } from '@/components/community-intro';
import { DiscoveryEmpty } from '@/components/discovery-empty';
import { SPORT_LABELS } from '@/lib/constants';
import { registrationStatuses } from '@/lib/tournaments';
export const metadata = { title: 'Giải đấu thể thao' };
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string; sport?: string; page?: string }> }) {
  const params = await searchParams;
  const view = params.view === 'mine' || params.view === 'registered' ? params.view : 'all';
  const sport = Object.hasOwn(SPORT_LABELS, params.sport ?? '') ? params.sport! : '';
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (view !== 'all' && !user) redirect(`/dang-nhap?next=${encodeURIComponent(`/giai-dau?view=${view}`)}`);
  const page = /^\d+$/.test(params.page ?? '') ? Math.max(1, Math.min(10000, Number(params.page))) : 1;
  const { data: registrations, count, error } = user && view === 'registered' ? await db.from('tournament_registrations').select('id,tournament_id,status,paid_at,deposit_amount,tournaments(title)', { count: 'exact' }).eq('user_id', user.id).order('created_at', { ascending: false }).range((page - 1) * 12, page * 12 - 1).returns<{ id: string; tournament_id: string; status: string; paid_at: string | null; deposit_amount: number; tournaments: { title: string } }[]>() : { data: null, count: 0, error: null };
  if (error) throw new Error('Không tải được đăng ký của bạn.');
  return <main className="mx-auto max-w-7xl px-5 py-8 lg:px-16 lg:py-10">
    {view === 'all' ? <CommunityIntro kind="tournaments" /> : <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-ink-secondary">Sân Ngon / Giải đấu</p><h1 className="mt-3 font-display text-3xl font-extrabold text-pitch">{view === 'registered' ? 'Theo dõi đăng ký của bạn' : 'Giải đấu tôi tổ chức'}</h1></div><Link href="/giai-dau/tao" className="inline-flex min-h-11 items-center rounded-control border border-strong px-5 text-sm font-semibold text-pitch">Đề xuất tổ chức giải ↗</Link></header>}
    <nav id="danh-sach" aria-label="Danh sách giải đấu" className="my-7 scroll-mt-28 flex flex-wrap gap-1 border-b border-hairline">{[['all', 'Khám phá giải'], ['registered', 'Đã đăng ký'], ['mine', 'Tôi tổ chức']].map(([key, label]) => <Link key={key} href={key === 'all' ? '/giai-dau' : `?view=${key}`} aria-current={view === key ? 'page' : undefined} className={`inline-flex min-h-12 items-center border-b-2 px-4 text-sm ${view === key ? 'border-pitch font-bold text-pitch' : 'border-transparent text-ink-secondary hover:text-pitch'}`}>{label}</Link>)}</nav>
    {view === 'registered' ? <section>
      <h2 className="font-display text-2xl font-bold text-pitch">Giải tôi đã đăng ký</h2><p className="mt-2 text-sm text-ink-secondary">Mở giải để xem kết quả duyệt, đóng cọc và thông tin ngày thi đấu.</p>
      {registrations?.length ? <ul className="mt-5 grid gap-4 md:grid-cols-2">{registrations.map(r => <li key={r.id}><Link className="flex h-full items-center justify-between gap-4 rounded-card border border-hairline bg-card p-5 hover:border-pitch" href={`/giai-dau/${r.tournament_id}`}><div><p className="text-xs font-semibold text-ink-secondary">{registrationStatuses[r.status]}{r.status === 'approved' && ` · ${r.paid_at ? 'Đã nhận cọc' : r.deposit_amount === 0 ? 'Không cần cọc' : 'Xem hướng dẫn đóng cọc'}`}</p><h3 className="mt-2 break-words font-display text-xl font-bold text-pitch">{r.tournaments?.title ?? 'Xem đăng ký giải đấu'}</h3></div><span aria-hidden="true">↗</span></Link></li>)}</ul> : <DiscoveryEmpty title="Giải đầu tiên đang chờ bạn" description="Chọn một giải phù hợp với môn chơi và lịch của bạn. Các đăng ký sẽ được theo dõi ở đây." href="/giai-dau" label="Khám phá giải đấu" />}
      <nav aria-label="Trang đăng ký" className="mt-5 flex gap-5 text-sm font-semibold text-pitch">{page > 1 && <Link className="py-3" href={`?view=registered&page=${page - 1}`}>← Trang trước</Link>}{(count ?? 0) > page * 12 && <Link className="py-3" href={`?view=registered&page=${page + 1}`}>Trang sau →</Link>}</nav>
    </section> : <><form className="flex flex-wrap items-end gap-3 rounded-card border border-hairline bg-card p-4"><input type="hidden" name="view" value={view} /><label className="flex flex-1 flex-col gap-2 text-xs font-semibold sm:max-w-xs">Môn thi đấu<select name="sport" defaultValue={sport} className="min-h-11 rounded-control border border-hairline bg-page px-3 text-sm font-normal"><option value="">Tất cả môn</option>{Object.entries(SPORT_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label><button className="min-h-11 rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink">Lọc giải</button>{sport && <Link href={`?view=${view}`} className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-pitch underline underline-offset-4">Xóa bộ lọc</Link>}</form><TournamentList mode={view === 'mine' ? 'mine' : 'public'} sport={sport} page={page} /></>}
  </main>;
}
