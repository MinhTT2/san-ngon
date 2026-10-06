import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SPORT_LABELS } from '@/lib/constants';
import { vnd, dayLabel, hhmm } from '@/lib/format';
import { tournamentLabel, tournamentStatuses } from '@/lib/tournaments';
import { DiscoveryEmpty } from './discovery-empty';
import { TournamentCover } from './tournament-cover';
export async function TournamentList({ mode = 'public', sport = '', status = '', page = 1 }: { mode?: 'public' | 'mine' | 'admin' | 'owner'; sport?: string; status?: string; page?: number }) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  const now = new Date().toISOString();
  let query = db.from('tournaments').select('*', { count: 'exact' }).order(mode === 'public' ? 'starts_at' : 'created_at', { ascending: mode === 'public' && status !== 'completed' });
  if (mode === 'public') query = status === 'completed' ? query.or(`status.eq.completed,and(status.eq.published,ends_at.lte.${now})`) : query.eq('status', 'published').gt('ends_at', now);
  else if (Object.hasOwn(tournamentStatuses, status)) query = query.eq('status', status as 'pending');
  if (mode === 'mine') query = query.eq('manager_id', user?.id ?? '00000000-0000-0000-0000-000000000000');
  if (mode === 'owner' && user) {
    const { data: venues, error } = await db.from('venues').select('courts(id)').eq('owner_id', user.id);
    if (error) throw new Error('Chưa tải được sân.');
    const ids = (venues ?? []).flatMap(v => v.courts.map(c => c.id));
    query = query.or(`manager_id.eq.${user.id}${ids.length ? `,court_id.in.(${ids.join(',')})` : ''}`);
  }
  if (Object.hasOwn(SPORT_LABELS, sport)) query = query.eq('sport', sport as 'badminton');
  const { data, count, error } = await query.range((page - 1) * 12, page * 12 - 1);
  if (error) throw new Error('Chưa tải được giải đấu. Vui lòng thử lại.');
  const pageHref = (p: number) => `?${new URLSearchParams({ view: mode === 'mine' ? 'mine' : 'all', sport, status, page: String(p) })}`;
  const filtered = !!sport || !!status || page > 1;
  return <>
    <p className="mt-6 text-sm text-ink-secondary">{count ?? 0} giải đấu{sport && ` · ${SPORT_LABELS[sport]}`}</p>
    <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{data?.map(t => {
      const state = tournamentLabel(t);
      return <Link key={t.id} href={`/giai-dau/${t.id}`} className="group flex min-w-0 flex-col overflow-hidden rounded-card border border-hairline bg-card transition-colors hover:border-pitch">
        <TournamentCover path={t.cover_path} title={t.title} fallback className="aspect-video border-b border-hairline" />
        <div className="flex items-center justify-between gap-3 border-b border-hairline bg-free-fill/60 px-5 py-4"><span className="text-xs font-bold uppercase tracking-wide text-pitch">{SPORT_LABELS[t.sport]}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${t.status === 'pending' ? 'bg-peak-fill text-peak-ink' : 'bg-card text-ink-secondary'}`}>{state}</span></div>
        <div className="flex flex-1 flex-col p-5"><p className="text-sm font-semibold text-pitch">{dayLabel(new Date(t.starts_at))} <span className="font-normal text-ink-secondary">· {hhmm(t.starts_at)}</span></p>
          <h2 className="mt-3 break-words font-display text-2xl font-bold leading-tight text-pitch">{t.title}</h2>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-ink-secondary">{t.address}</p>
          <p className="mt-4 text-xs leading-6 text-ink-secondary">Tối đa {t.capacity} suất<br />Hạn đăng ký: {dayLabel(new Date(t.registration_deadline))} · {hhmm(t.registration_deadline)}</p>
          <div className="mt-auto pt-5"><div className="flex items-end justify-between gap-3 border-t border-hairline pt-4"><div><p className="text-xs text-ink-secondary">Lệ phí / suất</p><p className="mt-1 font-display text-xl font-bold text-pitch">{t.entry_fee ? vnd(t.entry_fee) : 'Miễn phí'}</p><p className="mt-1 text-xs text-ink-secondary">{t.deposit_amount ? `Cọc ${vnd(t.deposit_amount)} sau duyệt` : 'Không yêu cầu cọc'}</p></div><span className="shrink-0 text-sm font-semibold text-pitch">{mode === 'public' ? 'Xem giải →' : 'Quản lý →'}</span></div></div>
        </div>
      </Link>;
    })}</div>
    {!data?.length && <DiscoveryEmpty title={filtered ? 'Chưa tìm thấy giải phù hợp' : mode === 'public' ? 'Sân sẵn sàng. Chờ giải đầu tiên.' : 'Chưa có giải trong danh sách'} description={filtered ? 'Thử bỏ bộ lọc để xem thêm các giải đấu khác.' : mode === 'public' || mode === 'mine' ? 'Bạn có một ý tưởng cho giải đấu? Gửi đề xuất để admin hỗ trợ bố trí sân và duyệt tổ chức.' : 'Các đề xuất và giải đấu thuộc phạm vi của bạn sẽ xuất hiện tại đây.'} href={filtered ? `?view=${mode === 'mine' ? 'mine' : 'all'}` : '/giai-dau/tao'} label={filtered ? 'Xóa bộ lọc' : 'Đề xuất tổ chức giải'} />}
    {!!count && <nav aria-label="Trang giải đấu" className="mt-6 flex items-center gap-4 text-sm font-semibold text-pitch">{page > 1 && <Link className="inline-flex min-h-11 items-center" href={pageHref(page - 1)}>← Trang trước</Link>}<span className="text-xs font-normal text-ink-secondary">Trang {page} / {Math.ceil(count / 12)}</span>{count > page * 12 && <Link className="inline-flex min-h-11 items-center" href={pageHref(page + 1)}>Trang sau →</Link>}</nav>}
  </>;
}
