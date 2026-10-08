import Link from 'next/link';
import { ArrowUpRight, Clock3, MapPin } from 'lucide-react';
import { SPORT_LABELS } from '@/lib/constants';
import { skillLabels, type CommunityProfile } from '@/lib/community';
import { UserAvatar } from './user-avatar';
import { SportGlyph } from './sport-glyph';

export function CommunityPlayerCard({ profile: p }: { profile: CommunityProfile }) {
  const tint = p.sport === 'badminton' ? 'bg-story-lilac' : p.sport === 'pickleball' ? 'bg-story-teal' : 'bg-free-fill';
  return <li className="pf-player-card pf-card group min-w-0 overflow-hidden rounded-[20px] border border-hairline bg-card">
    <Link href={`/ket-noi/${p.user_id}`} className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3">
        <span className="text-xs font-medium text-ink-secondary">{SPORT_LABELS[p.sport] ?? p.sport}</span>
        <span className={`grid size-9 shrink-0 place-items-center rounded-control ${tint}`}><SportGlyph sport={p.sport} className="pf-player-glyph size-6 text-pitch" /></span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-3.5"><UserAvatar name={p.display_name} avatar={p.avatar_url} className="size-16 shrink-0 text-xl" /><div className="min-w-0"><h3 className="break-words font-display text-xl font-bold leading-snug tracking-tight text-pitch">{p.display_name}</h3><p className="mt-1.5 flex items-start gap-1 text-xs leading-5 text-ink-secondary"><MapPin size={13} className="mt-0.5 shrink-0" aria-hidden="true" /><span className="line-clamp-2">{p.location}</span></p></div></div>
        <span className="mt-4 w-fit rounded-pill border border-hairline px-2.5 py-1.5 text-[11px] text-ink-secondary">{skillLabels[p.skill_level] ?? p.skill_level}</span>
        <p className="mt-3 line-clamp-2 text-xs leading-6 text-ink-secondary">{p.bio || 'Ghé xem hồ sơ để làm quen và hẹn một buổi chơi.'}</p>
        <div className="my-4 rounded-control bg-page p-3"><p className="flex items-center gap-1.5 text-[11px] font-semibold text-pitch"><Clock3 size={13} aria-hidden="true" />Thường chơi</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-secondary">{p.usual_play_times || 'Liên hệ để chọn giờ phù hợp'}</p></div>
        <div className="mt-auto flex min-h-11 items-center justify-between gap-3 border-t border-hairline pt-3 text-xs font-semibold text-pitch"><span>Xem hồ sơ & liên hệ</span><span className="grid size-9 place-items-center rounded-full border border-strong group-hover:bg-pitch group-hover:text-white"><ArrowUpRight size={17} className="pf-arrow" aria-hidden="true" /></span></div>
      </div>
    </Link>
  </li>;
}
