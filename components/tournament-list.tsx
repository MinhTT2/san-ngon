import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SPORT_LABELS } from '@/lib/constants';
import { vnd, dayLabel, hhmm } from '@/lib/format';
import { tournamentLabel, tournamentStatuses } from '@/lib/tournaments';
import { DiscoveryEmpty } from './discovery-empty';
import { TournamentCover } from './tournament-cover';
import { ArrowUpRight, CalendarDays, MapPin, Users } from 'lucide-react';
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
    <div className="mt-7 flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-4"><div><h2 className="font-display text-xl font-bold text-pitch">{mode === 'public' ? status === 'completed' ? 'Những giải đã diễn ra' : 'Chọn thử thách tiếp theo' : 'Giải đấu trong danh sách'}</h2><p className="mt-2 text-xs text-ink-secondary">{count ?? 0} giải đấu{sport && ` · ${SPORT_LABELS[sport]}`}</p></div>{mode === 'public' && <p className="text-xs text-ink-secondary">Xem thể lệ trước khi gửi đăng ký</p>}</div>
    <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data?.map(t => {
      const state = tournamentLabel(t);
      return <li key={t.id} className="pf-card group flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-hairline bg-card"><Link href={`/giai-dau/${t.id}`} className="flex h-full flex-col">
        <div className="relative"><TournamentCover path={t.cover_path} title={t.title} fallback className="aspect-video" /><span className={`absolute bottom-3 left-3 rounded-pill border px-2.5 py-1.5 text-[11px] font-semibold ${t.status === 'pending' ? 'border-peak-line bg-peak-fill text-peak-ink' : 'border-hairline bg-card text-pitch'}`}>{state}</span></div>
        <div className="flex flex-1 flex-col p-5"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-secondary">{SPORT_LABELS[t.sport]}</p>
          <h3 className="mt-2 break-words font-display text-xl font-bold leading-snug tracking-tight text-pitch">{t.title}</h3>
          <p className="mt-4 flex items-start gap-2 text-xs font-semibold leading-6 text-pitch"><CalendarDays size={15} className="mt-1 shrink-0" aria-hidden="true" /><span>{dayLabel(new Date(t.starts_at))} · {hhmm(t.starts_at)}</span></p>
          <p className="mt-2 flex items-start gap-2 text-xs leading-6 text-ink-secondary"><MapPin size={15} className="mt-1 shrink-0" aria-hidden="true" /><span className="line-clamp-2">{t.address}</span></p>
          <p className="mt-2 flex items-center gap-2 text-xs text-ink-secondary"><Users size={15} aria-hidden="true" />Quy mô tối đa {t.capacity} suất</p>
          <p className="mt-4 border-t border-hairline pt-3 text-[11px] leading-6 text-ink-secondary">Hạn đăng ký: {dayLabel(new Date(t.registration_deadline))} · {hhmm(t.registration_deadline)}</p>
          <div className="mt-auto flex items-end justify-between gap-3 pt-4"><div className="min-w-0"><p className="text-[11px] text-ink-secondary">Lệ phí / suất</p><p className="mt-1 font-display text-xl font-bold text-pitch">{t.entry_fee ? vnd(t.entry_fee) : 'Miễn phí'}</p><p className="mt-1 text-[11px] leading-5 text-ink-secondary">{t.deposit_amount ? `Cọc ${vnd(t.deposit_amount)} sau duyệt` : 'Không yêu cầu cọc'}</p></div><span className="grid size-11 shrink-0 place-items-center rounded-control border border-strong text-pitch"><ArrowUpRight size={20} className="pf-arrow" aria-hidden="true" /><span className="sr-only">{mode === 'public' ? 'Xem giải' : 'Quản lý'}</span></span></div>
        </div>
      </Link></li>;
    })}</ul>
    {!data?.length && <DiscoveryEmpty title={filtered ? 'Chưa tìm thấy giải phù hợp' : mode === 'public' ? 'Sân sẵn sàng. Chờ giải đầu tiên.' : 'Chưa có giải trong danh sách'} description={filtered ? 'Thử bỏ bộ lọc để xem thêm các giải đấu khác.' : mode === 'public' || mode === 'mine' ? 'Bạn có một ý tưởng cho giải đấu? Gửi đề xuất để admin hỗ trợ bố trí sân và duyệt tổ chức.' : 'Các đề xuất và giải đấu thuộc phạm vi của bạn sẽ xuất hiện tại đây.'} href={filtered ? `?view=${mode === 'mine' ? 'mine' : 'all'}` : '/giai-dau/tao'} label={filtered ? 'Xóa bộ lọc' : 'Đề xuất tổ chức giải'} />}
    {!!count && <nav aria-label="Trang giải đấu" className="mt-6 flex items-center gap-4 text-sm font-semibold text-pitch">{page > 1 && <Link className="inline-flex min-h-11 items-center" href={pageHref(page - 1)}>← Trang trước</Link>}<span className="text-xs font-normal text-ink-secondary">Trang {page} / {Math.ceil(count / 12)}</span>{count > page * 12 && <Link className="inline-flex min-h-11 items-center" href={pageHref(page + 1)}>Trang sau →</Link>}</nav>}
  </>;
}
