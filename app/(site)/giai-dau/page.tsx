export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TournamentList } from '@/components/tournament-list';
import { CommunityIntro } from '@/components/community-intro';
import { SportShortcuts } from '@/components/sport-shortcuts';
import { DiscoveryEmpty } from '@/components/discovery-empty';
import { SPORT_LABELS } from '@/lib/constants';
import { registrationLabel } from '@/lib/tournaments';
import { TournamentRefresh } from '@/components/tournament-refresh';
import { dayLabel, hhmm } from '@/lib/format';
import { ArrowUpRight } from 'lucide-react';
export const metadata = { title: 'Giải đấu thể thao' };
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string; sport?: string; page?: string; status?: string }> }) {
  const params = await searchParams;
  const view = params.view === 'mine' || params.view === 'registered' ? params.view : 'all';
  const sport = Object.hasOwn(SPORT_LABELS, params.sport ?? '') ? params.sport! : '';
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (view !== 'all' && !user) redirect(`/dang-nhap?next=${encodeURIComponent(`/giai-dau?view=${view}`)}`);
  const page = /^\d+$/.test(params.page ?? '') ? Math.max(1, Math.min(10000, Number(params.page))) : 1;
  const { data: registrationData, error } = user && view === 'registered' ? await db.rpc('get_my_tournament_registrations', { p_page: page }) : { data: null, error: null };
  if (error) throw new Error('Không tải được đăng ký của bạn.');
  const result = registrationData as { total: number; rows: { id: string; tournament_id: string; status: string; paid_at: string | null; deposit_amount: number; title: string; tournament_status: string; starts_at: string; ends_at: string; address: string; payment_expires_at: string | null; registration_deadline: string }[] } | null;
  const registrations = result?.rows;
  const count = result?.total ?? 0;
  return <main className="mx-auto max-w-7xl px-5 pb-12 pt-6 lg:px-16 lg:pt-8">
    {view === 'registered' && user && <TournamentRefresh userId={user.id} deadlines={(registrations ?? []).flatMap(registration => [registration.registration_deadline, registration.starts_at, registration.ends_at, ...(registration.payment_expires_at ? [registration.payment_expires_at] : [])])} />}
    {view === 'all' ? <CommunityIntro kind="tournaments" /> : <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-ink-secondary">Sân Ngon / Giải đấu</p><h1 className="mt-3 font-display text-3xl font-extrabold text-pitch">{view === 'registered' ? 'Theo dõi đăng ký của bạn' : 'Giải đấu tôi tổ chức'}</h1></div><Link href="/giai-dau/tao" className="inline-flex min-h-11 items-center gap-2 rounded-control border border-strong px-5 text-sm font-semibold text-pitch">Tổ chức giải đấu<ArrowUpRight size={16} aria-hidden="true" /></Link></header>}
    <nav id="danh-sach" aria-label="Danh sách giải đấu" className="my-5 scroll-mt-6 flex gap-1 overflow-x-auto border-b border-hairline">{[['all', 'Khám phá giải'], ['registered', 'Đã đăng ký'], ['mine', 'Tôi tổ chức']].map(([key, label]) => <Link key={key} href={key === 'all' ? '/giai-dau' : `?view=${key}`} aria-current={view === key ? 'page' : undefined} className={`pf-action inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm ${view === key ? 'border-pitch font-bold text-pitch' : 'border-transparent text-ink-secondary hover:text-pitch'}`}>{label}</Link>)}</nav>
    {view === 'registered' ? <section>
      <h2 className="font-display text-2xl font-bold text-pitch">Giải tôi đã đăng ký</h2><p className="mt-2 text-sm text-ink-secondary">Mở giải để xem kết quả duyệt, đóng cọc và thông tin ngày thi đấu.</p>
      {registrations?.length ? <ul className="mt-5 grid gap-4 md:grid-cols-2">{registrations.map(registration => <li key={registration.id}><Link className="flex h-full min-w-0 items-start justify-between gap-4 rounded-card border border-hairline bg-card p-5 hover:border-pitch" href={`/giai-dau/${registration.tournament_id}`}><div className="min-w-0"><p className={`text-xs font-semibold ${registration.status === 'pending' || (registration.status === 'approved' && !registration.paid_at && registration.deposit_amount > 0) ? 'text-peak-ink' : 'text-ink-secondary'}`}>{registration.tournament_status === 'cancelled' ? 'Giải đã hủy · Xem hoàn tiền' : registrationLabel(registration)}</p><h3 className="mt-2 break-words font-display text-xl font-bold text-pitch">{registration.title}</h3><p className="mt-3 text-sm text-ink-secondary">{dayLabel(new Date(registration.starts_at))} · {hhmm(registration.starts_at)}</p><p className="mt-2 break-words text-xs leading-6 text-ink-secondary">{registration.address}</p>{registration.status === 'approved' && !registration.paid_at && registration.deposit_amount > 0 && registration.payment_expires_at && <p className="mt-3 text-xs font-semibold text-peak-ink">Đóng cọc trước {dayLabel(new Date(registration.payment_expires_at))} · {hhmm(registration.payment_expires_at)}</p>}</div><ArrowUpRight size={18} aria-hidden="true" className="shrink-0 text-pitch" /></Link></li>)}</ul> : <DiscoveryEmpty title="Giải đầu tiên đang chờ bạn" description="Chọn một giải phù hợp với môn chơi và lịch của bạn. Các đăng ký sẽ được theo dõi ở đây." href="/giai-dau" label="Khám phá giải đấu" />}
      <nav aria-label="Trang đăng ký" className="mt-5 flex gap-5 text-sm font-semibold text-pitch">{page > 1 && <Link className="py-3" href={`?view=registered&page=${page - 1}`}>← Trang trước</Link>}{(count ?? 0) > page * 12 && <Link className="py-3" href={`?view=registered&page=${page + 1}`}>Trang sau →</Link>}</nav>
    </section> : <><SportShortcuts pathname="/giai-dau" sport={sport} params={{ view, status: params.status }} /><form aria-label="Lọc giải đấu" className="mt-3 flex flex-wrap items-end gap-3 rounded-[20px] border border-hairline bg-card p-4"><input type="hidden" name="view" value={view} /><label className="flex min-w-[120px] flex-1 flex-col gap-2 text-xs font-semibold text-ink-secondary sm:max-w-xs">Môn thi đấu<select name="sport" defaultValue={sport} className="min-h-11 rounded-control border border-hairline bg-page px-3 text-sm font-normal"><option value="">Tất cả môn</option>{Object.entries(SPORT_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>{view === 'all' && <label className="flex flex-col gap-2 text-xs font-semibold">Thời điểm<select name="status" defaultValue={params.status === 'completed' ? 'completed' : 'published'} className="min-h-11 rounded-control border border-hairline bg-page px-3 text-sm font-normal"><option value="published">Sắp / đang diễn ra</option><option value="completed">Đã kết thúc</option></select></label>}<button className="pf-action min-h-11 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink">Lọc giải</button>{sport && <Link href={`?view=${view}`} className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-pitch underline underline-offset-4">Xóa bộ lọc</Link>}</form><TournamentList mode={view === 'mine' ? 'mine' : 'public'} sport={sport} status={params.status} page={page} /></>}
  </main>;
}
