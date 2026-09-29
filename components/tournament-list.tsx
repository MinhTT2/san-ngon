import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SPORT_LABELS } from '@/lib/constants';
import { vnd, dayLabel, hhmm } from '@/lib/format';
import { tournamentStatuses } from '@/lib/tournaments';
export async function TournamentList({ mode = 'public', sport = '', page = 1 }: { mode?: 'public' | 'mine' | 'admin' | 'owner'; sport?: string; page?: number }) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  let query = db.from('tournaments').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (mode === 'public') query = query.eq('status', 'published');
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
  return <>
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data?.map(t => <Link key={t.id} href={`/giai-dau/${t.id}`} className="rounded-card border border-hairline bg-card p-6 transition-colors hover:border-pitch">
      <p className="text-xs font-semibold text-pitch">{SPORT_LABELS[t.sport]} · {tournamentStatuses[t.status]}</p>
      <h2 className="mt-3 font-display text-xl font-bold text-pitch">{t.title}</h2>
      <p className="mt-3 text-sm">{dayLabel(new Date(t.starts_at))} · {hhmm(t.starts_at)}</p>
      <p className="mt-2 text-sm text-ink-secondary">{t.address}</p>
      <p className="mt-4 text-sm">Tối đa {t.capacity} suất · Lệ phí {vnd(t.entry_fee)}</p><p className="mt-1 text-xs text-ink-secondary">Cọc {vnd(t.deposit_amount)} / suất</p>
    </Link>)}</div>
    {!data?.length && <p className="mt-6 rounded-card border border-dashed border-strong p-8 text-sm text-ink-secondary">Chưa có giải đấu trong danh sách này.</p>}
    <nav aria-label="Trang giải đấu" className="mt-6 flex gap-4 text-sm font-semibold text-pitch">{page > 1 && <Link href={`?view=${mode === 'mine' ? 'mine' : 'all'}&sport=${sport}&page=${page - 1}`}>← Trang trước</Link>}{(count ?? 0) > page * 12 && <Link href={`?view=${mode === 'mine' ? 'mine' : 'all'}&sport=${sport}&page=${page + 1}`}>Trang sau →</Link>}</nav>
  </>;
}
