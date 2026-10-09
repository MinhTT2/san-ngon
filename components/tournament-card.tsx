import Link from 'next/link';
import { ArrowUpRight, Clock3, MapPin, Users } from 'lucide-react';
import { SPORT_LABELS } from '@/lib/constants';
import { dayLabel, hhmm, vnd, ymd } from '@/lib/format';
import { tournamentLabel, type Tournament } from '@/lib/tournaments';
import { TournamentCover } from './tournament-cover';
import { SportGlyph } from './sport-glyph';

export type TournamentCardData = Tournament & { courts: { venues: { name: string; images: string[] } | null } | null };

export function TournamentCard({ tournament: t, layout, mode }: { tournament: TournamentCardData; layout: string; mode: string }) {
  const state = tournamentLabel(t);
  const live = state === 'Đang diễn ra';
  const date = ymd(new Date(t.starts_at));
  return <li className="pf-tournament-card pf-card group min-w-0 overflow-hidden rounded-[20px] border border-hairline bg-card" data-layout={layout}>
    <Link href={`/giai-dau/${t.id}`} className="pf-tournament-link flex h-full min-w-0 flex-col">
      <div className="pf-tournament-media relative shrink-0">
        <TournamentCover path={t.cover_path} title={t.title} sport={t.sport} venueImages={t.courts?.venues?.images ?? []} venueName={t.courts?.venues?.name ?? ''} fallback className="pf-tournament-cover aspect-[16/9]" />
        <span className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1.5 text-[11px] font-semibold ${t.status === 'pending' ? 'border-peak-line bg-peak-fill text-peak-ink' : live ? 'border-free-line bg-free-fill text-free-ink' : 'border-hairline bg-card text-pitch'}`}>
          {live && <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />}{state}
        </span>
        <time dateTime={t.starts_at} className="pf-tournament-date absolute bottom-3 left-3 flex w-16 flex-col overflow-hidden rounded-control border border-card bg-card text-center text-pitch">
          <span className="border-b border-hairline bg-free-fill py-1 text-[10px] font-semibold uppercase tracking-wider">Tháng {date.slice(5, 7)}</span>
          <span className="py-1 font-display text-3xl font-bold leading-none">{date.slice(8, 10)}</span>
        </time>
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-secondary"><SportGlyph sport={t.sport} className="size-4" />{SPORT_LABELS[t.sport]}</p>
        <h3 className="mt-2 break-words font-display text-xl font-bold leading-snug tracking-tight text-pitch">{t.title}</h3>
        <div className="mt-4 space-y-2 text-xs leading-6">
          <p className="flex items-start gap-2 font-semibold text-pitch"><Clock3 size={14} className="mt-1 shrink-0" aria-hidden="true" /><span>{dayLabel(new Date(t.starts_at))} · {hhmm(t.starts_at)}</span></p>
          <p className="flex items-start gap-2 text-ink-secondary"><MapPin size={14} className="mt-1 shrink-0" aria-hidden="true" /><span className="line-clamp-2 break-words">{t.address}</span></p>
          <p className="flex items-center gap-2 text-ink-secondary"><Users size={14} className="shrink-0" aria-hidden="true" />Tối đa {t.capacity} suất tham gia</p>
        </div>
        <p className="mb-4 mt-4 border-t border-hairline pt-3 text-[11px] leading-6 text-ink-secondary">Hạn đăng ký: {dayLabel(new Date(t.registration_deadline))} · {hhmm(t.registration_deadline)}</p>
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-hairline pt-4">
          <div className="min-w-0"><p className="text-[11px] text-ink-secondary">Lệ phí / suất</p><p className="mt-1 font-display text-xl font-bold text-pitch">{t.entry_fee ? vnd(t.entry_fee) : 'Miễn phí'}</p><p className="mt-1 text-[11px] leading-5 text-ink-secondary">{t.deposit_amount ? `Cọc ${vnd(t.deposit_amount)} sau duyệt` : 'Không yêu cầu cọc'}</p></div>
          <span className="pf-tournament-cta inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control border border-strong px-3 text-xs font-semibold text-pitch"><span>{mode === 'public' ? 'Xem giải' : 'Quản lý'}</span><ArrowUpRight size={16} className="pf-arrow" aria-hidden="true" /></span>
        </div>
      </div>
    </Link>
  </li>;
}
