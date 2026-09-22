import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/status-badge';
import { hhmm, vnd, ymd, dayLabel } from '@/lib/format';
import type { BookingStatus } from '@/lib/types';
import { ConfirmPaymentButton, RefundDoneButton } from '@/components/owner-booking-actions';
import { TelegramConnect } from '@/components/telegram-connect';
import { OwnerStatsPanel, PeriodLinks } from '@/components/stats-panels';
import { parseOwnerStats } from '@/lib/stats';

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
  const [{ data: venues, error: venuesError }, { data: profile }] = await Promise.all([
    supabase.from('venues').select('id, name, status').eq('owner_id', user.id).order('created_at').order('id'),
    supabase.from('profiles').select('telegram_chat_id').eq('id', user.id).maybeSingle(),
  ]);

  if (venuesError) throw new Error('Không tải được danh sách sân. Vui lòng thử lại.');
  if (!venues?.length) return <NoVenue />;
  const venue = venues.find((item) => item.id === selectedVenueId) ?? venues[0];

  const statsTo = new Date();
  const statsFrom = new Date();
  statsFrom.setDate(statsFrom.getDate() - period + 1);
  const { data: statsData } = await supabase.rpc('get_owner_stats' as never, {
    p_venue_id: venue.id,
    p_from: ymd(statsFrom),
    p_to: ymd(statsTo),
  } as never);
  const stats = parseOwnerStats(statsData);

  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 6);

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, code, starts_at, ends_at, status, total_amount, deposit_amount, refund_status, customer_name, customer_phone, courts!inner(name, venue_id, venues(name))')
    .eq('courts.venue_id', venue.id)
    .gte('starts_at', `${ymd(from)}T00:00:00+07:00`)
    .lte('starts_at', `${ymd(to)}T23:59:59+07:00`)
    .order('starts_at');

  const { data: refunds } = await supabase
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
  const pendingRows = rows.filter((b) => b.status === 'pending');

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const today = rows.filter((b) => ymd(new Date(b.starts_at)) === ymd(new Date()));
  const paidToday = today.filter((b) => b.status === 'confirmed');

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 lg:px-16">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-pitch">{venue.name}</h1>
        <span className="text-sm text-ink-secondary">{dayLabel(new Date())}</span>
      </div>

      {venues.length > 1 && (
        <nav aria-label="Chọn cụm sân" className="mt-5 flex flex-wrap gap-2">
          {venues.map((item) => (
            <Link
              key={item.id}
              href={`/chu-san?venue=${item.id}`}
              aria-current={item.id === venue.id ? 'page' : undefined}
              className={`rounded-control border px-4 py-3 text-sm font-medium ${item.id === venue.id ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline bg-card text-ink hover:border-strong'}`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      )}

      {venue.status !== 'active' && (
        <p className="mt-5 rounded-card border border-peak-line bg-peak-fill p-4 text-sm leading-relaxed text-peak-ink">
          Hồ sơ đang chờ duyệt nên sân chưa hiện ở trang tìm sân và chưa nhận được đơn nào.{' '}
          <Link href="/dang-ky-san" className="font-semibold underline underline-offset-2">Xem tiến độ</Link>
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat value={String(paidToday.length)} label="Đơn đã chốt hôm nay" />
        <Stat value={vnd(paidToday.reduce((s, b) => s + b.deposit_amount, 0))} label="Cọc đã nhận hôm nay" />
        <Stat value={String(today.length - paidToday.length)} label="Đang chờ chuyển khoản" />
        <Stat value={String(refundRows.length)} label="Cần hoàn cọc" tone={refundRows.length ? 'danger' : undefined} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-secondary">Theo dõi doanh thu và công suất để biết sân nào cần lấp lịch.</p>
        <PeriodLinks path={`/chu-san?venue=${venue.id}`} period={period} />
      </div>
      <OwnerStatsPanel stats={stats} />

      <TelegramConnect connected={Boolean(profile?.telegram_chat_id)} />

      {refundRows.length > 0 && (
        <section className="mt-8 rounded-card border border-peak-line bg-peak-fill p-4">
          <h2 className="font-semibold text-peak-ink">Danh sách cần hoàn cọc</h2>
          <ul className="mt-3 flex flex-col divide-y divide-peak-line">
            {refundRows.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{b.code} · {b.customer_name ?? 'Khách'} · {b.courtName}</p>
                  <p className="mt-0.5 text-xs text-peak-ink">{b.customer_phone} · hoàn {vnd(b.deposit_amount)}</p>
                </div>
                <RefundDoneButton code={b.code} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {pendingRows.length > 0 && (
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
                <ConfirmPaymentButton code={b.code} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 id="calendar" className="mt-10 scroll-mt-6 text-[15px] font-semibold">Bảy ngày tới</h2>
      <div className="mt-3 hidden overflow-x-auto rounded-card border border-hairline bg-card p-4 lg:block">
        <div className="grid min-w-[900px] gap-3" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {days.map((d) => {
            const dayRows = rows.filter((b) => ymd(new Date(b.starts_at)) === ymd(d));
            return (
              <div key={ymd(d)} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between border-b border-hairline pb-2">
                  <span className="text-xs font-semibold text-pitch">{dayLabel(d).split(',')[0]}</span>
                  <span className="text-xs tabular-nums text-ink-secondary">{d.getDate()}/{d.getMonth() + 1}</span>
                </div>
                {dayRows.length === 0 ? (
                  <span className="rounded-slot border border-dashed border-strong py-3 text-center text-[11px] text-ink-secondary">
                    Trống
                  </span>
                ) : (
                  dayRows.map((b) => (
                    <div
                      key={b.id}
                      className={`flex flex-col gap-0.5 rounded-slot px-2 py-1.5 text-[11px] ${
                        b.status === 'confirmed' ? 'bg-free-fill text-free-ink' : 'bg-peak-fill text-peak-ink'
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

      <h2 id="bookings" className="mt-10 scroll-mt-6 text-[15px] font-semibold">Đơn hôm nay</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {today.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-card border border-hairline bg-card p-4">
            <span className="w-12 flex-none text-sm font-semibold tabular-nums text-pitch">{hhmm(b.starts_at)}</span>
            <div className="flex min-w-0 flex-grow flex-col gap-0.5">
              <span className="text-sm font-semibold">{b.customer_name ?? 'Khách'} · {b.courtName}</span>
              <span className="text-xs text-ink-secondary">
                {b.customer_phone} · cọc {vnd(b.deposit_amount)} · thu tại sân {vnd(b.total_amount - b.deposit_amount)}
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
        href="/tao-cum-san"
        className="mt-7 flex h-13 w-fit items-center rounded-control bg-pitch px-7 font-semibold text-pitch-ink"
      >
        Tạo cụm sân
      </Link>
    </main>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: 'danger' }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-hairline bg-card p-4">
      <span className={`font-display text-xl font-bold ${tone === 'danger' ? 'text-danger' : 'text-pitch'}`}>
        {value}
      </span>
      <span className="text-[11px] leading-tight text-ink-secondary">{label}</span>
    </div>
  );
}
