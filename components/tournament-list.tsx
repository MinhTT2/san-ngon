import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SPORT_LABELS } from '@/lib/constants';
import { vnd, dayLabel, hhmm } from '@/lib/format';
import { tournamentLabel, tournamentStatuses } from '@/lib/tournaments';
import { tournamentSearchPattern } from '@/lib/tournament-discovery';
import { DiscoveryEmpty } from './discovery-empty';
import { TournamentCover } from './tournament-cover';
import { ArrowUpRight, CalendarDays, LayoutGrid, List, MapPin, Users } from 'lucide-react';

export async function TournamentList({ mode = 'public', sport = '', status = '', page = 1, q = '', location = '', sort = 'soonest', layout = 'grid' }: {
  mode?: 'public' | 'mine' | 'admin' | 'owner'; sport?: string; status?: string; page?: number;
  q?: string; location?: string; sort?: string; layout?: string;
}) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  const now = new Date().toISOString();
  let query = db.from('tournaments').select('*', { count: 'exact' });
  if (mode === 'public') {
    if (status === 'completed') query = query.or(`status.eq.completed,and(status.eq.published,ends_at.lte.${now})`);
    else {
      query = query.eq('status', 'published').gt('ends_at', now);
      if (status === 'open') query = query.gt('registration_deadline', now).gt('starts_at', now);
      if (status === 'upcoming') query = query.gt('starts_at', now);
      if (status === 'ongoing') query = query.lte('starts_at', now);
    }
  } else if (Object.hasOwn(tournamentStatuses, status)) query = query.eq('status', status as 'pending');
  if (mode === 'mine') query = query.eq('manager_id', user?.id ?? '00000000-0000-0000-0000-000000000000');
  if (mode === 'owner' && user) {
    const { data: venues, error } = await db.from('venues').select('courts(id)').eq('owner_id', user.id);
    if (error) throw new Error('Chưa tải được sân.');
    const ids = (venues ?? []).flatMap(v => v.courts.map(c => c.id));
    query = query.or(`manager_id.eq.${user.id}${ids.length ? `,court_id.in.(${ids.join(',')})` : ''}`);
  }
  if (Object.hasOwn(SPORT_LABELS, sport)) query = query.eq('sport', sport as 'badminton');
  if (q) query = query.ilike('title', tournamentSearchPattern(q));
  if (location) query = query.ilike('address', tournamentSearchPattern(location));
  query = sort === 'fee' ? query.order('entry_fee').order('starts_at')
    : sort === 'newest' || (mode !== 'public' && mode !== 'mine') ? query.order('created_at', { ascending: false })
    : query.order('starts_at', { ascending: status !== 'completed' });
  const { data, count, error } = await query.order('id').range((page - 1) * 12, page * 12 - 1);
  if (error) throw new Error('Chưa tải được giải đấu. Vui lòng thử lại.');
  const href = (patch: Record<string, string>) => `?${new URLSearchParams({ view: mode === 'mine' ? 'mine' : 'all', sport, status, q, location, sort, layout, page: String(page), ...patch })}`;
  const filtered = !!sport || !!status || !!q || !!location || page > 1;
  const discovery = mode === 'public' || mode === 'mine';
  return <section aria-label="Kết quả giải đấu" className="min-w-0">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-4"><div className="min-w-0 flex-1"><h2 className="font-display text-xl font-bold text-pitch">{mode === 'public' ? status === 'completed' ? 'Những giải đã diễn ra' : 'Khám phá giải đấu' : 'Giải đấu trong danh sách'}</h2><p className="mt-2 break-words text-xs leading-6 text-ink-secondary">{count ?? 0} giải đấu{sport && ` · ${SPORT_LABELS[sport]}`}{q && <> · Tên: <strong className="break-words">{q}</strong></>}{location && <> · Khu vực: <strong className="break-words">{location}</strong></>}</p></div>{discovery && <nav aria-label="Cách xem giải đấu" className="flex shrink-0 gap-1 rounded-control border border-hairline bg-card p-1">{[['grid', 'Dạng thẻ', LayoutGrid], ['list', 'Dạng danh sách', List]].map(([key, label, Icon]) => {
      const ViewIcon = Icon as typeof List;
      return <Link key={String(key)} scroll={false} href={href({ layout: String(key) })} aria-label={String(label)} aria-current={layout === key ? 'true' : undefined} className={`pf-action grid size-10 place-items-center rounded-[7px] ${layout === key ? 'bg-pitch text-pitch-ink' : 'text-ink-secondary hover:bg-sunk'}`}><ViewIcon size={17} aria-hidden="true" /></Link>;
    })}</nav>}</div>
    <ul className={`mt-5 grid gap-4 ${layout === 'list' ? '' : discovery ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>{data?.map(t => {
      const state = tournamentLabel(t);
      const awaiting = t.status === 'pending';
      const live = state === 'Đang diễn ra';
      return <li key={t.id} className="pf-card group min-w-0 overflow-hidden rounded-card border border-hairline bg-card"><Link href={`/giai-dau/${t.id}`} className={`flex h-full min-w-0 ${layout === 'list' ? 'flex-col sm:flex-row' : 'flex-col'}`}>
        <div className={`relative shrink-0 ${layout === 'list' ? 'sm:w-48' : ''}`}><TournamentCover path={t.cover_path} title={t.title} fallback className={`aspect-video ${layout === 'list' ? 'sm:aspect-auto sm:h-full sm:min-h-48' : ''}`} /><span className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1.5 text-[11px] font-semibold ${awaiting ? 'border-peak-line bg-peak-fill text-peak-ink' : live ? 'border-free-line bg-free-fill text-free-ink' : 'border-hairline bg-card text-pitch'}`}>{live && <span className="size-1.5 rounded-full bg-success" />}{state}</span><span className="absolute bottom-3 left-3 rounded-control bg-pitch px-2.5 py-1.5 text-[11px] font-semibold text-pitch-ink">{SPORT_LABELS[t.sport]}</span></div>
        <div className="flex min-w-0 flex-1 flex-col p-5">
          <h3 className="break-words font-display text-xl font-bold leading-snug tracking-tight text-pitch">{t.title}</h3>
          <p className="mt-4 flex items-start gap-2 text-xs font-semibold leading-6 text-pitch"><CalendarDays size={15} className="mt-1 shrink-0" aria-hidden="true" /><span>{dayLabel(new Date(t.starts_at))} · {hhmm(t.starts_at)}</span></p>
          <p className="mt-2 flex items-start gap-2 text-xs leading-6 text-ink-secondary"><MapPin size={15} className="mt-1 shrink-0" aria-hidden="true" /><span className="line-clamp-2 break-words">{t.address}</span></p>
          <p className="mt-2 flex items-center gap-2 text-xs text-ink-secondary"><Users size={15} aria-hidden="true" />Tối đa {t.capacity} suất tham gia</p>
          <p className="mt-4 border-t border-hairline pt-3 text-[11px] leading-6 text-ink-secondary">Hạn đăng ký: {dayLabel(new Date(t.registration_deadline))} · {hhmm(t.registration_deadline)}</p>
          <div className="mt-auto flex items-end justify-between gap-3 pt-4"><div className="min-w-0"><p className="text-[11px] text-ink-secondary">Lệ phí / suất</p><p className="mt-1 font-display text-xl font-bold text-pitch">{t.entry_fee ? vnd(t.entry_fee) : 'Miễn phí'}</p><p className="mt-1 text-[11px] leading-5 text-ink-secondary">{t.deposit_amount ? `Cọc ${vnd(t.deposit_amount)} sau duyệt` : 'Không yêu cầu cọc'}</p></div><span className="grid size-11 shrink-0 place-items-center rounded-control border border-strong text-pitch"><ArrowUpRight size={20} className="pf-arrow" aria-hidden="true" /><span className="sr-only">{mode === 'public' ? 'Xem giải' : 'Quản lý'}</span></span></div>
        </div>
      </Link></li>;
    })}</ul>
    {!data?.length && <DiscoveryEmpty title={filtered ? 'Chưa tìm thấy giải phù hợp' : mode === 'public' ? 'Sân sẵn sàng. Chờ giải đầu tiên.' : 'Chưa có giải trong danh sách'} description={filtered ? 'Thử tên ngắn hơn, đổi khu vực hoặc bỏ bộ lọc để xem thêm giải.' : mode === 'public' || mode === 'mine' ? 'Bạn có một ý tưởng cho giải đấu? Gửi đề xuất để admin hỗ trợ bố trí sân và duyệt tổ chức.' : 'Các đề xuất và giải đấu thuộc phạm vi của bạn sẽ xuất hiện tại đây.'} href={filtered ? `?view=${mode === 'mine' ? 'mine' : 'all'}` : '/giai-dau/tao'} label={filtered ? 'Xóa bộ lọc' : 'Đề xuất tổ chức giải'} />}
    {!!count && <nav aria-label="Trang giải đấu" className="mt-6 flex flex-wrap items-center gap-4 text-sm font-semibold text-pitch">{page > 1 && <Link className="inline-flex min-h-11 items-center" href={href({ page: String(page - 1) })}>← Trang trước</Link>}<span className="text-xs font-normal text-ink-secondary">Trang {page} / {Math.ceil(count / 12)}</span>{count > page * 12 && <Link className="inline-flex min-h-11 items-center" href={href({ page: String(page + 1) })}>Trang sau →</Link>}</nav>}
  </section>;
}