import { z } from 'zod';
import type { VenueCalendar } from '@/lib/types';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { VenueSchedule } from './venue-schedule';
import { CANCEL_WINDOW_HOURS, SPORT_LABELS } from '@/lib/constants';
import { ArrowDown, ArrowLeft, Check, Clock3, Layers3, MapPin, Phone, ShieldCheck } from 'lucide-react';
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

  const parsedDate = z.string().date().safeParse(ngay);
  const { data: calendarData, error: calendarError } = await supabase.rpc('get_venue_calendar', {
    p_venue_id: venue.id, p_date: parsedDate.success ? parsedDate.data : null,
  });
  if (calendarError || !calendarData) throw new Error('Không tải được ngày đặt sân. Vui lòng thử lại.');
  const calendar = calendarData as unknown as VenueCalendar;

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
    <main className="mx-auto max-w-7xl px-5 pb-12 pt-6 lg:px-16 lg:pt-8">
      <nav aria-label="Điều hướng trang sân" className="mb-4 flex flex-wrap items-center gap-2 text-xs text-ink-secondary"><Link href={ngay ? `/tim-san?ngay=${encodeURIComponent(ngay)}` : '/tim-san'} className="pf-action inline-flex min-h-11 items-center gap-2 font-semibold text-pitch"><ArrowLeft size={14} aria-hidden="true" />Tìm sân</Link><span aria-hidden="true">/</span><span>{venue.district}</span></nav>
      <header className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:flex-wrap">
        <div className="min-w-0 w-full sm:w-auto sm:flex-1"><div className="mb-3 flex flex-wrap gap-2">{sports.map(sport => <span key={sport} className="rounded-pill border border-strong bg-free-fill px-3 py-1 text-xs font-semibold text-pitch">{sport}</span>)}</div>
          <h1 className="break-words font-display text-3xl font-extrabold leading-tight tracking-tight text-pitch sm:text-4xl">{venue.name}</h1>
          <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-ink-secondary"><MapPin size={16} className="mt-1 shrink-0" aria-hidden="true" /><span>{venue.address} · {venue.district}</span></p>
        </div>
        {acceptsBookings && <a href="#lich-san" className="pf-action inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink hover:bg-ink">Chọn giờ đặt sân<ArrowDown size={16} aria-hidden="true" /></a>}
      </header>
      <dl className="my-5 grid grid-cols-1 gap-3 rounded-card border border-hairline bg-card px-4 py-4 sm:grid-cols-3 sm:gap-0">
        <div className="flex items-center gap-3 sm:pr-4"><Layers3 size={20} className="shrink-0 text-pitch" aria-hidden="true" /><div><dt className="text-[11px] text-ink-secondary">Quy mô cụm sân</dt><dd className="mt-1 text-sm font-semibold text-pitch">{courts?.length ?? 0} sân cho bạn chọn</dd></div></div>
        <div className="flex items-center gap-3 border-t border-hairline pt-3 sm:border-l sm:border-t-0 sm:px-4 sm:pt-0"><Clock3 size={20} className="shrink-0 text-pitch" aria-hidden="true" /><div><dt className="text-[11px] text-ink-secondary">Giờ mở cửa của cụm</dt><dd className="mt-1 text-sm font-semibold tabular-nums text-pitch">{venue.open_time.slice(0, 5)} – {venue.close_time.slice(0, 5)}</dd></div></div>
        <div className="flex items-center gap-3 border-t border-hairline pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0"><ShieldCheck size={20} className="shrink-0 text-pitch" aria-hidden="true" /><div><dt className="text-[11px] text-ink-secondary">Thanh toán khi đặt</dt><dd className="mt-1 text-sm font-semibold text-pitch">Cọc trước {venue.deposit_pct}% qua QR</dd></div></div>
      </dl>
      {!!venue.images?.length && <div id="anh-san" className="scroll-mt-24"><VenueGallery images={venue.images} name={venue.name} compact /></div>}
      <nav aria-label="Các mục trong trang sân" className="sticky top-0 z-20 flex gap-1 overflow-x-auto border-y border-hairline bg-page py-1 text-sm font-semibold text-pitch">
        <a href="#thong-tin-san" className="pf-action inline-flex min-h-11 shrink-0 items-center rounded-control px-3 hover:bg-free-fill">Thông tin sân</a>
        {!!venue.images?.length && <a href="#anh-san" className="pf-action inline-flex min-h-11 shrink-0 items-center rounded-control px-3 hover:bg-free-fill">Ảnh sân</a>}
        <a href="#lich-san" className="pf-action inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control px-3 hover:bg-free-fill">Giờ trống<ArrowDown size={14} aria-hidden="true" /></a>
      </nav>
      <div id="thong-tin-san" className="grid scroll-mt-24 gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0"><h2 className="font-display text-xl font-bold text-pitch">Một chút về cụm sân</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink-secondary">{venue.description || 'Xem ảnh và lịch trống để chọn buổi chơi phù hợp. Chủ sân sẽ hỗ trợ nếu bạn cần biết thêm về địa điểm.'}</p>
          {venue.amenities?.length > 0 && <div className="mt-5"><h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-secondary">Tiện ích tại sân</h3><ul className="mt-3 flex flex-wrap gap-2">{venue.amenities.map((item: string) => <li key={item} className="inline-flex items-center gap-1.5 rounded-control border border-hairline bg-card px-3 py-2 text-xs text-pitch"><Check size={13} aria-hidden="true" />{item}</li>)}</ul></div>}
        </section>
        <aside className="rounded-card border border-strong bg-free-fill p-5"><h2 className="font-display text-lg font-bold text-pitch">Hỏi thêm trước khi đặt?</h2><p className="mt-2 text-xs leading-6 text-ink-secondary">Liên hệ chủ sân về đường đi, thiết bị hoặc điều kiện tại sân.</p>
          {venue.phone ? <a href={`tel:${venue.phone}`} className="pf-action mt-3 inline-flex min-h-11 items-center gap-2 rounded-control border border-strong bg-card px-3 text-sm font-semibold text-pitch hover:border-pitch"><Phone size={15} aria-hidden="true" />{venue.phone}</a> : <Link href="/lien-he" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline underline-offset-4">Liên hệ Sân Ngon</Link>}
          <p className="mt-3 border-t border-strong pt-3 text-[11px] leading-6 text-ink-secondary">Hủy trước giờ chơi ít nhất {CANCEL_WINDOW_HOURS} tiếng được hoàn cọc theo chính sách hiện tại. <Link href="/chinh-sach-huy" className="font-semibold text-pitch underline underline-offset-2">Xem chính sách</Link>.</p>
        </aside>
      </div>
      <section id="lich-san" aria-label="Chọn lịch đặt sân" className="scroll-mt-24 border-t border-hairline pt-6">
        {acceptsBookings ? <VenueSchedule
          key={calendar.date}
          calendar={calendar}
          venueId={venue.id}
          depositPct={venue.deposit_pct}
          defaultName={profile?.full_name}
          defaultPhone={profile?.phone}
          isAuthenticated={!!user}
        /> : <div role="status" className="rounded-card border border-hairline bg-card p-5"><h2 className="font-display text-xl font-bold text-pitch">Hiện chưa nhận đặt trực tuyến</h2><p className="mt-2 text-sm leading-7 text-ink-secondary">Liên hệ chủ sân để biết thêm về lịch nhận khách của cụm sân.</p></div>}
      </section>
    </main>
  );
}
