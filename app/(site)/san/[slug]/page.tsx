import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VenueSchedule } from './venue-schedule';
import { SPORT_LABELS } from '@/lib/constants';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: venue } = await supabase
    .from('venues')
    .select('id, name, address, district, phone, open_time, close_time, deposit_pct, booking_horizon_days, amenities')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (!venue) notFound();

  const { data: courts } = await supabase
    .from('courts').select('sport').eq('venue_id', venue.id).eq('is_active', true);

  const sports = [...new Set((courts ?? []).map((c) => SPORT_LABELS[c.sport] ?? c.sport))];

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from('profiles').select('full_name, phone').eq('id', user.id).single()
    : { data: null };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-pitch">{venue.name}</h1>
      <p className="mt-1 flex flex-wrap gap-x-2 text-sm text-ink-secondary">
        <span>{venue.address} · {venue.district}</span>
        <span>· {sports.join(', ')}</span>
        <span>· Mở {venue.open_time.slice(0, 5)}–{venue.close_time.slice(0, 5)}</span>
        {venue.phone && <span>· {venue.phone}</span>}
      </p>

      <div className="mt-6">
        <VenueSchedule
          venueId={venue.id}
          depositPct={venue.deposit_pct}
          horizonDays={venue.booking_horizon_days}
          defaultName={profile?.full_name}
          defaultPhone={profile?.phone}
        />
      </div>
    </main>
  );
}
