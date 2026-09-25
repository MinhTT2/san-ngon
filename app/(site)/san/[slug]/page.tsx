import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { VenueSchedule } from './venue-schedule';
import { SPORT_LABELS } from '@/lib/constants';
import { VenueGallery } from '@/components/venue-gallery';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ngay?: string }>;
}) {
  const [{ slug }, { ngay }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  const { data: venue } = await supabase
    .from('venues')
    .select('id, name, address, district, phone, description, images, open_time, close_time, deposit_pct, booking_horizon_days, amenities')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (!venue) notFound();

  const { data: acceptsBookings, error: bookingAvailabilityError } = await supabase.rpc('venue_accepts_bookings', { p_venue_id: venue.id });
  if (bookingAvailabilityError) throw new Error('Không kiểm tra được trạng thái nhận đặt sân.');

  const { data: courts } = await supabase
    .from('courts').select('sport, name, surface, is_indoor').eq('venue_id', venue.id).eq('is_active', true);

  const sports = [...new Set((courts ?? []).map((c) => SPORT_LABELS[c.sport] ?? c.sport))];

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from('profiles').select('full_name, phone').eq('id', user.id).single()
    : { data: null };

  return (
    <main className="mx-auto max-w-7xl px-5 py-6 lg:px-16">
      <Link href={ngay ? `/tim-san?ngay=${encodeURIComponent(ngay)}` : '/tim-san'} className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-pitch">← Tìm sân khác</Link>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-display text-2xl font-extrabold tracking-tight text-pitch">{venue.name}</h1>
      <p className="mt-1 flex flex-wrap gap-x-2 text-sm text-ink-secondary">
        <span>{venue.address} · {venue.district}</span>
        <span>· {sports.join(', ')}</span>
        <span>· Mở {venue.open_time.slice(0, 5)}–{venue.close_time.slice(0, 5)}</span>
      </p></div>{acceptsBookings && <a href="#lich-san" className="inline-flex min-h-12 items-center justify-center rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink">Chọn giờ đặt sân ↓</a>}</div>

      <div className="mt-5"><VenueGallery images={venue.images ?? []} name={venue.name} /></div>

      {venue.description && <p className="mt-4 max-w-3xl text-[15px] leading-7 text-ink-secondary">{venue.description}</p>}
      {venue.amenities?.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{venue.amenities.map((item: string) => <span key={item} className="rounded-pill bg-sunk px-3 py-1 text-xs text-ink-secondary">{item}</span>)}</div>}

      <section className="mt-5 flex flex-col gap-3 border-y border-hairline py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-pitch">{courts?.length ?? 0} sân · Cọc trước {venue.deposit_pct}%</h2>
          <p className="text-sm leading-relaxed text-ink-secondary">Chọn giờ trên lịch để xem tổng tiền và số tiền cần cọc.</p>
          {!venue.phone && (
            <p className="text-xs text-ink-secondary">
              Chủ sân chưa công khai số điện thoại. <Link href="/lien-he" className="font-semibold text-pitch underline">Liên hệ Sân Ngon</Link> để được hỗ trợ.
            </p>
          )}
        </div>
        {venue.phone && (
          <a href={`tel:${venue.phone}`} className="inline-flex min-h-11 items-center justify-center rounded-control border border-hairline px-4 text-sm font-semibold text-pitch">
            Hỏi chủ sân · {venue.phone}
          </a>
        )}
      </section>

      <div id="lich-san" className="mt-6 scroll-mt-5">
        {acceptsBookings ? <VenueSchedule
          initialDate={ngay}
          venueId={venue.id}
          depositPct={venue.deposit_pct}
          horizonDays={venue.booking_horizon_days}
          defaultName={profile?.full_name}
          defaultPhone={profile?.phone}
          isAuthenticated={!!user}
        /> : <p role="status" className="rounded-card border border-hairline bg-card p-5 text-sm text-ink-secondary">Cụm sân này hiện chưa nhận đặt trực tuyến. Vui lòng liên hệ chủ sân để biết thêm thông tin.</p>}
      </div>
    </main>
  );
}
