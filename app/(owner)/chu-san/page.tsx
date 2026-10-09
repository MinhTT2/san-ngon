import Link from 'next/link';
import { QueryError } from '@/components/query-error';
import { DashboardPageHeader, DashboardLink } from '@/components/dashboard-page-header';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/status-badge';
import { hhmm, vnd, ymd, dayLabel } from '@/lib/format';
import type { BookingStatus } from '@/lib/types';
import { ConfirmPaymentButton, RefundDoneButton } from '@/components/owner-booking-actions';
import { TelegramConnect } from '@/components/telegram-connect';
import { OwnerStatsPanel, PeriodLinks } from '@/components/stats-panels';
import { parseOwnerStats } from '@/lib/stats';
import { OwnerReadiness } from '@/components/owner-readiness';
import { OwnerVenuePicker } from '@/components/owner-venue-picker';

export const dynamic = 'force-dynamic';

/**
 * Dashboard chủ sân. Trên desktop là lưới cả tuần — chủ sân cần thấy tuần tới
 * để biết khung nào đang ế mà giảm giá, thứ mà danh sách dọc không cho thấy.
 * Trên điện thoại rút về danh sách đơn trong ngày.
 *
 * Lọc đơn theo cụm sân đang chọn; RLS còn cho đọc các đơn tự đặt ở sân khác.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ venue?: string; period?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/chu-san');

  const { venue: selectedVenueId, period: rawPeriod } = await searchParams;
  const period = rawPeriod === '7' || rawPeriod === '90' ? Number(rawPeriod) : 30;
  const [{ data: venues, error: venuesError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from('venues').select('id, name, status').eq('owner_id', user.id).order('created_at').order('id'),
    supabase.from('profiles').select('telegram_chat_id').eq('id', user.id).maybeSingle(),
  ]);

  if (venuesError) throw new Error('Không tải được danh sách sân. Vui lòng thử lại.');
  if (!venues?.length) return <NoVenue />;
  const venue = venues.find((item) => item.id === selectedVenueId) ?? venues[0];

  const { data: statsData, error: statsError } = await supabase.rpc('get_owner_period_stats', {
    p_venue_id: venue.id,
    p_days: period,
  });
  const stats = statsError || !statsData ? null : parseOwnerStats(statsData);

  const { data: calendarData, error: calendarError } = await supabase.rpc('get_owner_operating_calendar', { p_venue_id: venue.id });
  if (calendarError || !calendarData) throw new Error('Chưa tải được ngày vận hành.');
  const calendar = calendarData as unknown as { today:string; from:string; until:string; days:string[] };

  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id, code, starts_at, ends_at, expires_at, status, total_amount, deposit_amount, refund_status, customer_name, customer_phone, courts!inner(name, venue_id, venues(name))')
    .eq('courts.venue_id', venue.id)
    .gte('starts_at', calendar.from)
    .lt('starts_at', calendar.until)
    .order('starts_at');

  const { data: refunds, error: refundsError } = await supabase
    .from('bookings')
    .select('id, code, starts_at, deposit_amount, customer_name, customer_phone, courts!inner(name, venue_id)')
    .eq('courts.venue_id', venue.id)
    .eq('refund_status', 'needed')
    .order('starts_at');

  const rows = (bookings ?? []).map((b) => {
    const c = b.courts as unknown as { name: string; venues: { name: string } };
    return { ...b, courtName: c?.name ?? '', venueName: c?.venues?.name ?? '' };
  });
  const refundRows = (refunds ?? []).map((b) => {
    const c = b.courts as unknown as { name: string };
    return { ...b, courtName: c?.name ?? '' };
  });
  const pendingRows = rows.filter((b) => b.status === 'pending' && Date.parse(b.expires_at) > Date.now());

  const days = calendar.days.map(date => new Date(date + 'T12:00:00+07:00'));

  const today = rows.filter((b) => ymd(new Date(b.starts_at)) === calendar.today);
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <DashboardPageHeader eyebrow="Chủ sân / Tổng quan" title={venue.name} description={`${dayLabel(new Date())} · Theo dõi lịch chơi và các việc cần xử lý tại cụm sân.`}
        actions={<><DashboardLink href={`/chu-san/don?venue=${venue.id}`}>Xem đơn</DashboardLink><DashboardLink href="/chu-san/lich">Lịch sân</DashboardLink><DashboardLink href="/chu-san/doi-soat">Xuất đối soát</DashboardLink></>} />

      <OwnerVenuePicker venues={venues} selectedId={venue.id} pathname="/chu-san" query={{ period: String(period) }} />

      <OwnerReadiness venueId={venue.id} />

      {venue.status !== 'active' && (
        <p className="mt-5 rounded-card border border-peak-line bg-peak-fill p-4 text-sm leading-relaxed text-peak-ink">
          {venue.status === 'draft' ? 'Cụm sân đang là bản nháp. Lưu đủ ảnh sân để công khai và nhận đặt.' : venue.status === 'pending' ? 'Hồ sơ cụm sân đang chờ duyệt theo luồng cũ.' : 'Cụm sân chưa được công khai. Kiểm tra thông tin trong phần quản lý.'}{' '}
          <Link href="/chu-san/quan-ly" className="font-semibold underline underline-offset-2">Quản lý sân</Link>
        </p>
      )}


      {refundsError ? <QueryError className="mt-8" title="Chưa tải được danh sách cần hoàn cọc" /> : refundRows.length > 0 && (
        <section className="mt-8 rounded-card border border-peak-line bg-peak-fill p-4">
          <h2 className="font-semibold text-peak-ink">Danh sách cần hoàn cọc</h2><Link href={"/chu-san/hoan-coc?venue="+venue.id} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline">Xem cần hoàn và lịch sử đã hoàn →</Link>
          <ul className="mt-3 flex flex-col divide-y divide-peak-line">
            {refundRows.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{b.code} · {b.customer_name ?? 'Khách'} · {b.courtName}</p>
                  <p className="mt-0.5 text-xs text-peak-ink">{b.customer_phone} · hoàn {vnd(b.deposit_amount)}</p>
                </div>
                <RefundDoneButton code={b.code} customerName={b.customer_name} customerPhone={b.customer_phone} courtName={b.courtName} depositAmount={b.deposit_amount} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {!bookingsError && pendingRows.length > 0 && (
        <section className="mt-8 rounded-card border border-hairline bg-card p-4">
          <h2 className="font-semibold">Đơn chờ chuyển khoản</h2>
          <p className="mt-1 text-xs text-ink-secondary">Dùng xác nhận tay khi SePay không gửi webhook.</p>
          <ul className="mt-3 flex flex-col divide-y divide-hairline">
            {pendingRows.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{b.code} · {b.customer_name ?? 'Khách'} · {b.courtName}</p>
                  <p className="mt-0.5 text-xs text-ink-secondary">{b.customer_phone} · cọc {vnd(b.deposit_amount)}</p>
                </div>
                <ConfirmPaymentButton code={b.code} customerName={b.customer_name} customerPhone={b.customer_phone} courtName={b.courtName} depositAmount={b.deposit_amount} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {!bookingsError && <>
      <h2 id="bookings" className="mt-10 scroll-mt-6 text-[15px] font-semibold">Đơn hôm nay</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {today.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-card border border-hairline bg-card p-4">
            <span className="w-12 flex-none text-sm font-semibold tabular-nums text-pitch">{hhmm(b.starts_at)}</span>
            <div className="flex min-w-0 flex-grow flex-col gap-0.5">
              <span className="text-sm font-semibold">{b.customer_name ?? 'Khách'} · {b.courtName}</span>
              <span className="text-xs text-ink-secondary">
                {b.customer_phone} · cọc {vnd(b.deposit_amount)} · {b.total_amount === b.deposit_amount && (b.status === 'confirmed' || b.status === 'completed') ? 'Đã thanh toán đủ tiền sân' : b.total_amount === b.deposit_amount ? 'Cọc bằng toàn bộ tiền sân' : 'Thu tại sân ' + vnd(b.total_amount - b.deposit_amount)}
              </span>
            </div>
            <StatusBadge status={b.status as BookingStatus} />
          </li>
        ))}
      </ul>

      {today.length === 0 && (
        <p className="mt-3 rounded-card border border-dashed border-strong p-10 text-center text-sm text-ink-secondary">
          Hôm nay chưa có đơn nào.
        </p>
      )}
      </>}
      <h2 id="calendar" className="mt-10 hidden scroll-mt-6 text-[15px] font-semibold lg:block">Bảy ngày tới</h2>
      {bookingsError ? <QueryError className="mt-3" title="Chưa tải được lịch đặt sân" /> : <>
      <Link href="/chu-san/lich" className="mt-6 inline-flex min-h-11 items-center rounded-control border border-hairline px-4 text-sm font-semibold text-pitch lg:hidden">Mở lịch 7 ngày của từng sân →</Link>
      <div className="mt-3 hidden overflow-x-auto rounded-card border border-hairline bg-card p-4 lg:block">
        <div className="grid min-w-[900px] gap-3" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {days.map((d) => {
            const dayRows = rows.filter((b) => ymd(new Date(b.starts_at)) === ymd(d));
            return (
              <div key={ymd(d)} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between border-b border-hairline pb-2">
                  <span className="text-xs font-semibold text-pitch">{dayLabel(d).split(',')[0]}</span>
                  <span className="text-xs tabular-nums text-ink-secondary">{ymd(d).slice(8,10)}/{ymd(d).slice(5,7)}</span>
                </div>
                {dayRows.length === 0 ? (
                  <span className="rounded-slot border border-dashed border-strong py-3 text-center text-xs text-ink-secondary">
                    Trống
                  </span>
                ) : (
                  dayRows.map((b) => (
                    <div
                      key={b.id}
                      className={`flex flex-col gap-0.5 rounded-slot px-2 py-1.5 text-xs ${
                        b.status === 'confirmed' ? 'bg-free-fill text-free-ink' : b.status === 'pending' ? 'bg-peak-fill text-peak-ink' : 'bg-sunk text-ink-secondary'
                      }`}
                    >
                      <span className="font-semibold tabular-nums">{hhmm(b.starts_at)} {b.courtName}</span>
                      <span className="truncate opacity-80">{b.customer_name ?? 'Khách'}</span>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>

      </>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-secondary">Theo dõi doanh thu và công suất để biết sân nào cần lấp lịch.</p>
        <PeriodLinks path={`/chu-san?venue=${venue.id}`} period={period} />
      </div>
      {stats ? <OwnerStatsPanel stats={stats} /> : <QueryError className="mt-3" title="Chưa tải được thống kê" />}

      {profileError || !profile ? <QueryError className="mt-6" title="Chưa tải được kết nối Telegram" /> : <TelegramConnect connected={Boolean(profile.telegram_chat_id)} />}

    </main>
  );
}

function NoVenue() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 lg:px-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-pitch">
        Bạn chưa có cụm sân nào
      </h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-secondary">
        Tạo cụm sân đầu tiên để thêm sân con, bảng giá và bắt đầu nhận đặt.
      </p>
      <Link
        href="/chu-san/quan-ly"
        className="mt-7 pf-action flex min-h-11 w-fit items-center rounded-control bg-pitch px-4 font-semibold text-pitch-ink"
      >
        Tạo cụm sân
      </Link>
      <OwnerReadiness />
    </main>
  );
}
