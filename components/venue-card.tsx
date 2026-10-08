import Link from 'next/link';
import { ArrowUpRight, Clock3, MapPin } from 'lucide-react';
import { SPORT_LABELS } from '@/lib/constants';
import { hhmm, vnd } from '@/lib/format';
import { FavoriteButton } from './favorite-button';
import { VenueCardPhoto } from './venue-card-photo';

export type VenueCardData = {
  id: string; slug: string; name: string; address: string; district: string; images: string[];
  amenities: string[]; court_count: number; sports: string[]; available_slots: number;
  min_price: number | null; next_slot: string | null;
};
export function VenueCard({ venue: v, date, signedIn, saved, returnPath }: {
  venue: VenueCardData; date: string; signedIn: boolean; saved: boolean | null; returnPath: string;
}) {
  const href = `/san/${v.slug}?ngay=${date}`;
  const src = v.images?.[0] ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/venue-photos/${v.images[0]}` : undefined;
  return <li className="pf-venue-card pf-card group relative flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-hairline bg-card">
    <Link href={href} aria-label={`Xem lịch ${v.name}`} className="pf-venue-cover relative block">
      <VenueCardPhoto src={src} name={v.name} />
      <span className={`absolute bottom-3 left-3 rounded-pill border px-3 py-1.5 text-xs font-semibold ${v.available_slots ? 'border-free-line bg-free-fill text-pitch' : 'border-hairline bg-card text-ink-secondary'}`}>
        {v.available_slots ? `Còn ${v.available_slots} khung trống` : 'Hết giờ trống ngày này'}
      </span>
    </Link>
    <div className="pf-venue-favorite absolute right-3 top-3"><FavoriteButton compact venueName={v.name} venueId={v.id} signedIn={signedIn} saved={saved} returnPath={returnPath} /></div>
    <div className="pf-venue-body flex flex-1 flex-col p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-secondary">{v.district} · {v.court_count} sân</p>
      <h2 className="mt-2 font-display text-xl font-bold leading-snug tracking-tight text-pitch"><Link href={href} className="hover:underline">{v.name}</Link></h2>
      <p className="mt-2 flex items-start gap-1.5 text-xs leading-6 text-ink-secondary"><MapPin size={14} className="mt-1 shrink-0" aria-hidden="true" /><span className="line-clamp-2">{v.address}</span></p>
      <div className="mt-3 flex flex-wrap gap-1.5">{v.sports.map(sport => <span key={sport} className="rounded-pill bg-sunk px-2.5 py-1 text-[11px] font-medium text-ink-secondary">{SPORT_LABELS[sport] ?? sport}</span>)}</div>
      <p className="mb-4 mt-4 flex items-center gap-1.5 text-xs text-ink-secondary"><Clock3 size={14} aria-hidden="true" />{v.next_slot ? `Sớm nhất ${hhmm(v.next_slot)}` : 'Thử chọn một ngày khác'}</p>
      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-hairline pt-4 mt-auto">
        <div><p className="text-[11px] text-ink-secondary">Giá từ / giờ</p><p className="mt-1 font-display text-xl font-bold tabular-nums text-pitch">{v.min_price != null ? vnd(v.min_price) : 'Chưa có giá'}</p></div>
        <Link href={href} className="pf-action inline-flex min-h-11 items-center gap-2 rounded-control border border-strong px-3 text-xs font-semibold text-pitch hover:border-pitch hover:bg-pitch hover:text-white">Xem lịch<ArrowUpRight size={16} className="pf-arrow" aria-hidden="true" /></Link>
      </div>
    </div>
  </li>;
}
