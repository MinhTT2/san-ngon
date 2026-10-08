import Link from 'next/link';
import { ArrowUpRight, Clock3, MapPin } from 'lucide-react';
import { SPORT_LABELS } from '@/lib/constants';
import { skillLabels, type CommunityProfile } from '@/lib/community';
import { UserAvatar } from './user-avatar';

export function CommunityPlayerCard({ profile: p }: { profile: CommunityProfile }) {
  return <li className="pf-card group min-w-0 overflow-hidden rounded-[20px] border border-hairline bg-card">
    <Link href={`/ket-noi/${p.user_id}`} className="flex h-full flex-col p-5">
      <div className="flex items-center gap-3.5"><UserAvatar name={p.display_name} avatar={p.avatar_url} className="size-14 shrink-0 text-xl" /><div className="min-w-0"><h3 className="break-words font-display text-xl font-bold leading-snug tracking-tight text-pitch">{p.display_name}</h3><p className="mt-1.5 flex items-start gap-1 text-xs leading-5 text-ink-secondary"><MapPin size={13} className="mt-0.5 shrink-0" aria-hidden="true" /><span className="line-clamp-2">{p.location}</span></p></div></div>
      <div className="mt-5 flex flex-wrap gap-2 text-[11px]"><span className="rounded-pill bg-free-fill px-2.5 py-1.5 font-semibold text-pitch">{SPORT_LABELS[p.sport] ?? p.sport}</span><span className="rounded-pill border border-hairline px-2.5 py-1.5 text-ink-secondary">{skillLabels[p.skill_level] ?? p.skill_level}</span></div>
      <p className="mt-4 line-clamp-2 text-xs leading-6 text-ink-secondary">{p.bio || 'Ghé xem hồ sơ để làm quen và hẹn một buổi chơi.'}</p>
      <div className="my-4 rounded-control bg-page p-3"><p className="flex items-center gap-1.5 text-[11px] font-semibold text-pitch"><Clock3 size={13} aria-hidden="true" />Thường chơi</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-secondary">{p.usual_play_times || 'Liên hệ để chọn giờ phù hợp'}</p></div>
      <div className="mt-auto flex min-h-11 items-center justify-between gap-3 border-t border-hairline pt-3 text-xs font-semibold text-pitch"><span>Xem hồ sơ & liên hệ</span><ArrowUpRight size={18} className="pf-arrow" aria-hidden="true" /></div>
    </Link>
  </li>;
}
