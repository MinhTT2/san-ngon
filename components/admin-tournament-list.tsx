import Link from 'next/link';
import { ClipboardCheck, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { SPORT_LABELS } from '@/lib/constants';
import { tournamentLabel, tournamentStatuses } from '@/lib/tournament-status';
import type { Tournament } from '@/lib/tournaments';
import { tournamentSearchPattern } from '@/lib/tournament-discovery';
import { dayLabel, hhmm, vnd, ymd } from '@/lib/format';
import { TournamentDeleteForm } from './tournament-delete-form';
import { QueryError } from './query-error';

type TournamentRow = Pick<Tournament, 'id' | 'title' | 'sport' | 'status' | 'starts_at' | 'ends_at' | 'registration_deadline' | 'capacity' | 'entry_fee' | 'deposit_amount' | 'address' | 'created_at'> & {
  courts: { name: string; venues: { name: string } | null } | null;
  organizer: { full_name: string | null; phone: string | null } | null;
};
const GROUPS = [
  { value:'pending',label:'Chờ duyệt',hint:'Duyệt đề xuất và bố trí sân' },
  { value:'published',label:'Đã công khai',hint:'Theo dõi giải và người tham gia' },
  { value:'history',label:'Lịch sử',hint:'Đã kết thúc, hủy hoặc từ chối' },
  { value:'all',label:'Tất cả',hint:'Tra cứu toàn bộ giải đấu' },
] as const;
const HISTORY = ['completed','cancelled','rejected'];

export async function AdminTournamentList({ params }: { params: { page?: string; status?: string; q?: string; sport?: string } }) {
  const status = params.status === '' || params.status === 'all' ? 'all' : params.status === 'history' || Object.hasOwn(tournamentStatuses,params.status ?? '') ? params.status! : 'pending';
  const sport = Object.hasOwn(SPORT_LABELS,params.sport ?? '') ? params.sport! : '';
  const q = (typeof params.q === 'string' ? params.q : '').trim().slice(0,100);
  let page = /^\d{1,9}$/.test(params.page ?? '') ? Math.max(1,Number(params.page)) : 1;
  const db = await createClient();
  const countQuery = (group: string) => {
    let query = db.from('tournaments').select('id',{count:'exact',head:true});
    if (q) query = query.ilike('title',tournamentSearchPattern(q));
    if (sport) query = query.eq('sport',sport as Tournament['sport']);
    return group === 'history' ? query.in('status',HISTORY) : group === 'all' ? query : query.eq('status',group);
  };
  let query = db.from('tournaments').select('id,title,sport,status,starts_at,ends_at,registration_deadline,capacity,entry_fee,deposit_amount,address,created_at,courts(name,venues(name)),organizer:profiles!tournaments_manager_id_fkey(full_name,phone)',{count:'exact'});
  if (q) query = query.ilike('title',tournamentSearchPattern(q));
  if (sport) query = query.eq('sport',sport as Tournament['sport']);
  if (status === 'history') query = query.in('status',HISTORY);
  else if (status !== 'all') query = query.eq('status',status);
  query = status === 'pending' ? query.order('created_at') : status === 'published' ? query.order('starts_at') : query.order('created_at',{ascending:false});
  query = query.order('id');
  const pageSize = 20;
  const [counts, initialResult] = await Promise.all([
    Promise.all(GROUPS.map(group => countQuery(group.value))),
    query.range((page-1)*pageSize,page*pageSize-1).returns<TournamentRow[]>(),
  ]);
  let result = initialResult;
  if (result.error?.code === 'PGRST103' && page > 1) {
    const available = await countQuery(status);
    if (!available.error) {
      page = Math.max(1, Math.ceil((available.count ?? 0) / pageSize));
      result = await query.range((page-1)*pageSize,page*pageSize-1).returns<TournamentRow[]>();
    }
  }
  const pages = Math.max(1,Math.ceil((result.count ?? 0)/pageSize));
  if (!result.error && page > pages) {
    page = pages;
    result = await query.range((page-1)*pageSize,page*pageSize-1).returns<TournamentRow[]>();
  }
  const failed = result.error || counts.some(count => count.error);
  const rows = result.data ?? [];
  const activeGroup = HISTORY.includes(status) ? 'history' : status;
  const href = (nextStatus: string, nextPage = 1) => `/admin/giai-dau?${new URLSearchParams({status:nextStatus,...(q ? {q} : {}),...(sport ? {sport} : {}),...(nextPage > 1 ? {page:String(nextPage)} : {})})}`;
  const title = status === 'pending' ? 'Đề xuất chờ duyệt' : status === 'published' ? 'Giải đã công khai' : status === 'history' ? 'Lịch sử giải đấu' : status === 'all' ? 'Tất cả giải đấu' : tournamentStatuses[status];
  const now = Date.now();
  return <div className="mt-6 space-y-5">
    <nav aria-label="Nhóm giải đấu" className="grid grid-cols-2 gap-2 xl:grid-cols-4">{GROUPS.map((group,i) => <Link key={group.value} href={href(group.value)} aria-current={activeGroup === group.value ? 'page' : undefined} className={`pf-action min-w-0 rounded-card border p-4 ${activeGroup === group.value ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline bg-card text-pitch hover:border-strong'}`}><span className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{group.label}</span><strong className="font-display text-2xl font-bold tabular-nums">{counts[i].error ? '—' : counts[i].count ?? 0}</strong></span><span className={`mt-2 block text-[11px] leading-5 ${activeGroup === group.value ? 'text-pitch-ink/80' : 'text-ink-secondary'}`}>{group.hint}</span></Link>)}</nav>
    <section aria-label="Danh sách giải đấu admin" className="min-w-0 overflow-hidden rounded-card border border-hairline bg-card">
      <form key={`${status}:${q}:${sport}`} method="get" className="border-b border-hairline p-4 sm:p-5"><div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_190px_auto]">
        <label className="min-w-0 text-xs font-semibold text-ink-secondary sm:col-span-2 xl:col-span-1">Tên giải đấu<span className="relative mt-1.5 block"><Search size={16} className="pointer-events-none absolute left-3 top-3.5" aria-hidden="true" /><input type="search" name="q" maxLength={100} defaultValue={q} placeholder="Tìm theo tên giải…" className="h-11 w-full rounded-control border border-hairline bg-page pl-10 pr-3 text-sm text-ink" /></span></label>
        <label className="min-w-0 text-xs font-semibold text-ink-secondary"><span id="admin-tournament-sport-label">Môn thi đấu</span><select aria-labelledby="admin-tournament-sport-label" name="sport" defaultValue={sport} className="mt-1.5 h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm text-ink"><option value="">Tất cả môn</option>{Object.entries(SPORT_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="min-w-0 text-xs font-semibold text-ink-secondary"><span id="admin-tournament-status-label">Trạng thái</span><select aria-labelledby="admin-tournament-status-label" name="status" defaultValue={status} className="mt-1.5 h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm text-ink"><option value="all">Tất cả trạng thái</option><option value="history">Toàn bộ lịch sử</option>{Object.entries(tournamentStatuses).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-1"><button type="submit" className="pf-action min-h-11 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink">Lọc giải</button>{(q || sport || status !== 'pending') && <Link href="/admin/giai-dau" className="pf-action inline-flex min-h-11 items-center px-2 text-xs font-semibold text-pitch underline underline-offset-4">Xóa lọc</Link>}</div>
      </div><p className="mt-3 text-xs leading-5 text-ink-secondary">Tìm trong trạng thái đang chọn. Số lượng từng nhóm tính theo tên và môn đang lọc, trên toàn bộ giải.</p></form>
      {failed ? <QueryError className="m-4" title="Chưa tải được danh sách giải đấu" /> : <><header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline p-4 sm:px-5"><div><h2 className="font-display text-xl font-bold text-pitch">{title}</h2><p className="mt-1 text-xs leading-5 text-ink-secondary">{status === 'pending' ? 'Đề xuất gửi trước được xếp trước. Mở giải để duyệt, bố trí sân và chốt thỏa thuận.' : status === 'published' ? 'Xếp theo lịch thi đấu gần nhất. Mở giải để xem người tham gia, giao dịch và quyết toán.' : 'Giải mới gửi được xếp trước. Hồ sơ cũ được giữ để tra cứu và đối soát.'}</p></div><span className="rounded-pill bg-sunk px-3 py-1.5 text-xs font-semibold text-pitch">{result.count ?? 0} giải</span></header>
      {rows.length ? <><div className="hidden xl:block"><table className="w-full table-fixed text-left text-sm"><caption className="sr-only">Giải đấu, địa điểm, lịch thi đấu, lệ phí và trạng thái</caption><thead className="bg-page text-[11px] text-ink-secondary"><tr className="border-b border-hairline">{['Giải / Người tổ chức','Sân tổ chức','Lịch thi đấu','Quy mô / Lệ phí','Trạng thái','Thao tác'].map((label,i) => <th key={label} scope="col" className={`px-4 py-3 font-semibold ${i === 0 ? 'w-[23%]' : i === 5 ? 'w-36' : ''}`}>{label}</th>)}</tr></thead><tbody>{rows.map(t => <tr key={t.id} className="border-b border-hairline align-top last:border-0 hover:bg-page"><td className="break-words px-4 py-4"><TournamentName t={t} /></td><td className="break-words px-4 py-4"><TournamentVenue t={t} /></td><td className="px-4 py-4"><TournamentDates t={t} /></td><td className="px-4 py-4"><TournamentFees t={t} /></td><td className="px-4 py-4"><TournamentState t={t} now={now} /></td><td className="px-3 py-4"><TournamentActions t={t} /></td></tr>)}</tbody></table></div>
      <ul className="divide-y divide-hairline xl:hidden">{rows.map(t => <li key={t.id} className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><TournamentName t={t} /></div><TournamentState t={t} now={now} /></div><dl className="mt-4 grid gap-4 sm:grid-cols-2"><div><dt className="mb-1 text-[11px] text-ink-secondary">Sân tổ chức</dt><dd className="break-words text-sm"><TournamentVenue t={t} /></dd></div><div><dt className="mb-1 text-[11px] text-ink-secondary">Lịch thi đấu</dt><dd className="text-sm"><TournamentDates t={t} /></dd></div><div><dt className="mb-1 text-[11px] text-ink-secondary">Quy mô / Lệ phí</dt><dd className="text-sm"><TournamentFees t={t} /></dd></div></dl><div className="mt-4 border-t border-hairline pt-3"><TournamentActions t={t} /></div></li>)}</ul></> : <div role="status" className="px-5 py-12 text-center"><ClipboardCheck className="mx-auto size-8 text-pitch" aria-hidden="true" /><p className="mt-3 font-semibold text-pitch">{q || sport ? 'Không có giải phù hợp' : status === 'pending' ? 'Không có đề xuất đang chờ duyệt' : 'Chưa có giải trong nhóm này'}</p><p className="mt-2 text-sm leading-6 text-ink-secondary">{q || sport ? 'Thử đổi tên, môn thi đấu hoặc trạng thái.' : 'Chọn nhóm khác để theo dõi giải đã công khai và tra cứu lịch sử.'}</p>{status === 'pending' && <Link href={href('published')} className="pf-action mt-4 inline-flex min-h-11 items-center rounded-control border border-hairline px-4 text-sm font-semibold text-pitch">Xem giải đã công khai</Link>}</div>}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline p-4 text-xs text-ink-secondary"><span>{rows.length ? `${(page-1)*pageSize+1}–${(page-1)*pageSize+rows.length} / ${result.count} giải` : '0 giải'}</span><nav aria-label="Phân trang giải đấu admin" className="flex flex-wrap items-center gap-3">{page > 1 && <Link href={href(status,page-1)} className="pf-action inline-flex min-h-11 items-center rounded-control border border-hairline px-3 font-semibold text-pitch">Trang trước</Link>}<span>Trang {page} / {pages}</span>{page < pages && <Link href={href(status,page+1)} className="pf-action inline-flex min-h-11 items-center rounded-control border border-hairline px-3 font-semibold text-pitch">Trang sau</Link>}</nav></footer></>}
    </section>
  </div>;
}

function dateLabel(value: string) { const date = new Date(value); return `${dayLabel(date)}/${ymd(date).slice(0,4)} · ${hhmm(value)}`; }
function TournamentName({t}: {t:TournamentRow}) { return <><Link href={`/giai-dau/${t.id}`} className="break-words font-semibold leading-6 text-pitch hover:underline">{t.title}</Link><p className="mt-1 text-xs text-ink-secondary">{SPORT_LABELS[t.sport]}</p><p className="mt-2 break-words text-xs text-ink-secondary">{t.organizer?.full_name || 'Chưa có tên người tổ chức'}</p>{t.organizer?.phone && <a href={`tel:${t.organizer.phone}`} className="mt-1 inline-block text-xs tabular-nums text-pitch underline underline-offset-4">{t.organizer.phone}</a>}</>; }
function TournamentVenue({t}: {t:TournamentRow}) { return <><p className="font-semibold text-pitch">{t.courts?.venues?.name || 'Chưa bố trí sân'}</p>{t.courts && <p className="mt-1 text-xs text-ink-secondary">{t.courts.name}</p>}<p className="mt-2 text-xs leading-5 text-ink-secondary">{t.address}</p></>; }
function TournamentDates({t}: {t:TournamentRow}) { return <><p className="text-xs font-semibold leading-5 text-pitch">{dateLabel(t.starts_at)}</p><p className="mt-1 text-xs leading-5 text-ink-secondary">Đến {dateLabel(t.ends_at)}</p><p className="mt-2 text-[11px] leading-5 text-ink-secondary">Hạn đăng ký: {dateLabel(t.registration_deadline)}</p></>; }
function TournamentFees({t}: {t:TournamentRow}) { return <><p className="text-xs font-semibold text-pitch">Tối đa {t.capacity} suất</p><p className="mt-2 text-sm font-semibold tabular-nums text-pitch">{t.entry_fee ? vnd(t.entry_fee) : 'Miễn phí'}</p><p className="mt-1 text-[11px] leading-5 text-ink-secondary">{t.entry_fee ? 'mỗi suất' : 'Không thu lệ phí'}<br />{t.deposit_amount ? `Cọc ${vnd(t.deposit_amount)}` : 'Không yêu cầu cọc'}</p></>; }
function TournamentState({t,now}: {t:TournamentRow;now:number}) { return <span className={`inline-flex rounded-pill px-2.5 py-1 text-xs font-medium ${t.status === 'pending' ? 'bg-peak-fill text-peak-ink' : t.status === 'published' ? 'bg-free-fill text-pitch' : 'bg-sunk text-ink-secondary'}`}>{tournamentLabel(t,now)}</span>; }
function TournamentActions({t}: {t:TournamentRow}) { return <div className="flex flex-wrap items-start gap-2"><Link href={`/giai-dau/${t.id}${t.status === 'pending' ? '#duyet-giai' : ''}`} className="pf-action inline-flex min-h-11 items-center rounded-control border border-hairline px-3 text-xs font-semibold text-pitch hover:border-strong">{t.status === 'pending' ? 'Duyệt đề xuất' : 'Xem chi tiết'}</Link><details className="group relative"><summary className="pf-action flex min-h-11 cursor-pointer list-none items-center rounded-control border border-hairline px-3 text-xs font-semibold text-ink-secondary [&::-webkit-details-marker]:hidden">Thêm <span aria-hidden="true" className="ml-1 group-open:rotate-180">⌄</span></summary><div className="mt-2"><TournamentDeleteForm id={t.id} title={t.title} /></div></details></div>; }
