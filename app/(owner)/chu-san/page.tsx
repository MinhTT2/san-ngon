import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/status-badge';
import { hhmm, vnd, ymd, dayLabel } from '@/lib/format';
import type { BookingStatus } from '@/lib/types';
import { ConfirmPaymentButton, RefundDoneButton } from '@/components/owner-booking-actions';
import { TelegramConnect } from '@/components/telegram-connect';
import { StatTile } from '@/components/charts/stat-tile';
import { RevenueArea, type RevenuePoint } from '@/components/charts/revenue-area';
import { OccupancyHeatmap, type OccupancyCell } from '@/components/charts/occupancy-heatmap';

export const dynamic = 'force-dynamic';

type OwnerSummary = {
  doanh_thu: number; doanh_thu_truoc: number;
  so_don: number; so_don_truoc: number;
  so_don_huy: number; ty_le_lap_day: number;
};

/**
 * Dashboard chủ sân. Trên desktop là lưới cả tuần — chủ sân cần thấy tuần tới
 * để biết khung nào đang ế mà giảm giá, thứ mà danh sách dọc không cho thấy.
 * Trên điện thoại rút về danh sách đơn trong ngày.
 *
 * Lọc đơn theo cụm sân đang chọn; RLS còn cho đọc các đơn tự đặt ở sân khác.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ venue?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/chu-san');

  const { venue: selectedVenueId } = await searchParams;
  const [{ data: venues, error: venuesError }, { data: profile }] = await Promise.all([
    supabase.from('venues').select('id, name, status').eq('owner_id', user.id).order('created_at').order('id'),
    supabase.from('profiles').select('telegram_chat_id').eq('id', user.id).maybeSingle(),
  ]);

  if (venuesError) throw new Error('Không tải được danh sách sân. Vui lòng thử lại.');
  if (!venues?.length) return <NoVenue />;
  const venue = venues.find((item) => item.id === selectedVenueId) ?? venues[0];

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

  // Số liệu của riêng cụm sân đang chọn. stats_can_read() trong Postgres tự
  // chặn nếu ai đó đổi ?venue= sang cụm sân của người khác.
  const [tomTat, doanhThuNgay, luoiLapDay] = await Promise.all([
    supabase.rpc('stats_summary', { p_venue_id: venue.id, p_days: 30 }).single(),
    supabase.rpc('stats_revenue_daily', { p_venue_id: venue.id, p_days: 30 }),
    supabase.rpc('stats_occupancy_grid', { p_venue_id: venue.id, p_days: 28 }),
  ]);
  const tongQuan = tomTat.data as OwnerSummary | null;
  const doanhThu = (doanhThuNgay.data ?? []) as RevenuePoint[];
  const luoi = (luoiLapDay.data ?? []) as OccupancyCell[];

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

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Tiền cọc 30 ngày"
          value={trieu(tongQuan?.doanh_thu ?? 0)}
          unit="triệu"
          delta={tyLe(tongQuan?.doanh_thu, tongQuan?.doanh_thu_truoc)}
          spark={doanhThu.map((d) => d.doanh_thu)}
        />
        <StatTile
          label="Lấp đầy trung bình 28 ngày"
          value={`${Math.round((tongQuan?.ty_le_lap_day ?? 0) * 100)}%`}
          delta={null}
          deltaLabel={`${tongQuan?.so_don_huy ?? 0} đơn huỷ hoặc không đến`}
        />
        <StatTile
          label="Hôm nay"
          value={String(paidToday.length)}
          unit="đơn đã chốt"
          delta={null}
          deltaLabel={`${vnd(paidToday.reduce((sum, b) => sum + b.deposit_amount, 0))} cọc · ${today.length - paidToday.length} đơn đang chờ chuyển khoản`}
        />
        <StatTile
          label="Cần hoàn cọc"
          value={String(refundRows.length)}
          delta={null}
          tone={refundRows.length ? 'peak' : undefined}
          deltaLabel={refundRows.length ? 'Khách huỷ sớm, phải trả lại cọc' : 'Không có khoản nào phải trả lại'}
        />
      </div>

      <div className="mt-6 flex flex-col gap-5">
        <section className="rounded-card border border-hairline bg-card p-5 sm:p-6">
          <h2 className="font-semibold">Tiền cọc về tài khoản</h2>
          <p className="mt-1 text-xs text-ink-secondary">30 ngày gần nhất của {venue.name}.</p>
          <div className="mt-5"><RevenueArea data={doanhThu} height={190} /></div>
        </section>

        {/* Lưới cần cả 18 cột giờ; nhét vào nửa trang là cắt mất giờ vàng. */}
        <section className="rounded-card border border-hairline bg-card p-5 sm:p-6">
          <h2 className="font-semibold">Khung nào đang ế</h2>
          <p className="mt-1 text-xs text-ink-secondary">
            Ô nhạt là khung còn trống đều —{' '}
            <Link href="/chu-san/quan-ly" className="font-medium text-pitch underline underline-offset-2">
              hạ giá khung đó
            </Link>{' '}
            thường kéo được khách.
          </p>
          <div className="mt-5">
            <OccupancyHeatmap data={luoi} subtitle="Tính trên số lượt có thể bán của chính cụm sân này." />
          </div>
        </section>
      </div>

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

/** 34.590.000 → "34,6" — thẻ số liệu đọc bằng mắt, không phải để đối soát. */
function trieu(v: number) {
  return (v / 1_000_000).toFixed(1).replace('.', ',');
}

/** Kỳ trước bằng 0 thì không có gì để so. */
function tyLe(now?: number, before?: number) {
  if (!before || before === 0 || now === undefined) return null;
  return (now - before) / before;
}

