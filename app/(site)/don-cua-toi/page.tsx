import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/status-badge';
import { hhmm, dayLabel, vnd } from '@/lib/format';
import type { BookingStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Bảng trên desktop, thẻ trên điện thoại. Cùng một dữ liệu, hai bố cục. */
export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/don-cua-toi');

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, code, starts_at, ends_at, status, total_amount, deposit_amount, expires_at, courts(name, venues(name, district))')
    .order('starts_at', { ascending: false });

  const rows = (bookings ?? []).map((b) => {
    const court = b.courts as unknown as { name: string; venues: { name: string; district: string } };
    return {
      ...b,
      courtName: court?.name ?? '',
      venueName: court?.venues?.name ?? '',
      district: court?.venues?.district ?? '',
      left: Math.max(0, Math.floor((new Date(b.expires_at).getTime() - Date.now()) / 1000)),
    };
  });

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 lg:px-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-pitch">Đơn của tôi</h1>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-card border border-hairline p-10 text-center text-sm text-ink-secondary">
          Bạn chưa đặt sân nào. <Link href="/tim-san" className="font-semibold text-pitch underline">Tìm sân</Link>
        </p>
      ) : (
        <>
          <div className="mt-8 hidden overflow-hidden rounded-card border border-hairline bg-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs text-ink-secondary">
                  <th className="px-5 py-3 font-medium">Mã đơn</th>
                  <th className="px-5 py-3 font-medium">Sân</th>
                  <th className="px-5 py-3 font-medium">Thời gian</th>
                  <th className="px-5 py-3 text-right font-medium">Đã cọc</th>
                  <th className="px-5 py-3 text-right font-medium">Trả tại sân</th>
                  <th className="px-5 py-3 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id} className="border-b border-hairline last:border-0">
                    <td className="px-5 py-4">
                      <Link href={`/dat-san/${b.code}`} className="font-semibold tracking-wide">{b.code}</Link>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium">{b.venueName}</div>
                      <div className="text-xs text-ink-secondary">{b.courtName} · {b.district}</div>
                    </td>
                    <td className="px-5 py-4 tabular-nums">
                      <div>{hhmm(b.starts_at)}–{hhmm(b.ends_at)}</div>
                      <div className="text-xs text-ink-secondary">{dayLabel(new Date(b.starts_at))}</div>
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">{vnd(b.deposit_amount)}</td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums">
                      {vnd(b.total_amount - b.deposit_amount)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge
                        status={b.status as BookingStatus}
                        secondsLeft={b.status === 'pending' ? b.left : undefined}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-6 flex flex-col gap-3 md:hidden">
            {rows.map((b) => (
              <li key={b.id}>
                <Link href={`/dat-san/${b.code}`} className="flex flex-col gap-2.5 rounded-card border border-hairline bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <StatusBadge
                      status={b.status as BookingStatus}
                      secondsLeft={b.status === 'pending' ? b.left : undefined}
                    />
                    <span className="text-xs font-semibold tracking-wide text-ink-secondary">{b.code}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">{b.venueName} — {b.courtName}</span>
                    <span className="text-sm text-ink-secondary">
                      {hhmm(b.starts_at)}–{hhmm(b.ends_at)} · {dayLabel(new Date(b.starts_at))}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-hairline pt-2.5 text-sm">
                    <span className="text-ink-secondary">Đã cọc {vnd(b.deposit_amount)}</span>
                    <span className="font-semibold">Còn {vnd(b.total_amount - b.deposit_amount)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
