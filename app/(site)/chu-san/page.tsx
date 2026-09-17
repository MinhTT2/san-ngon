import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/status-badge';
import { hhmm, vnd, ymd, dayLabel } from '@/lib/format';
import type { BookingStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Dashboard chủ sân. Trên desktop là lưới cả tuần — chủ sân cần thấy tuần tới
 * để biết khung nào đang ế mà giảm giá, thứ mà danh sách dọc không cho thấy.
 * Trên điện thoại rút về danh sách đơn trong ngày.
 *
 * RLS lo phần lọc: policy bookings_select chỉ trả về đơn thuộc sân của người
 * đang đăng nhập, nên không cần lọc theo owner ở đây.
 */
export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/chu-san');

  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 6);

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, code, starts_at, ends_at, status, total_amount, deposit_amount, refund_status, customer_name, customer_phone, courts(name, venues(name))')
    .gte('starts_at', `${ymd(from)}T00:00:00+07:00`)
    .lte('starts_at', `${ymd(to)}T23:59:59+07:00`)
    .order('starts_at');

  const rows = (bookings ?? []).map((b) => {
    const c = b.courts as unknown as { name: string; venues: { name: string } };
    return { ...b, courtName: c?.name ?? '', venueName: c?.venues?.name ?? '' };
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const today = rows.filter((b) => ymd(new Date(b.starts_at)) === ymd(new Date()));
  const paidToday = today.filter((b) => b.status === 'confirmed');
  const needRefund = rows.filter((b) => b.refund_status === 'needed');

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 lg:px-16">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-pitch">Lịch sân của bạn</h1>
        <span className="text-sm text-ink-secondary">{dayLabel(new Date())}</span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat value={String(paidToday.length)} label="Đơn đã chốt hôm nay" />
        <Stat value={vnd(paidToday.reduce((s, b) => s + b.deposit_amount, 0))} label="Cọc đã nhận hôm nay" />
        <Stat value={String(today.length - paidToday.length)} label="Đang chờ chuyển khoản" />
        <Stat value={String(needRefund.length)} label="Cần hoàn cọc" tone={needRefund.length ? 'danger' : undefined} />
      </div>

      <h2 className="mt-10 text-[15px] font-semibold">Bảy ngày tới</h2>
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

      <h2 className="mt-10 text-[15px] font-semibold">Đơn hôm nay</h2>
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
