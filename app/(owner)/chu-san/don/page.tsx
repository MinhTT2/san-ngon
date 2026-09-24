import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, Filter, ReceiptText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ConfirmPaymentButton, RefundDoneButton } from '@/components/owner-booking-actions';
import { StatusBadge } from '@/components/status-badge';
import { hhmm, vnd, ymd } from '@/lib/format';
import type { BookingStatus } from '@/lib/types';
import { OwnerVenuePicker } from '@/components/owner-venue-picker';

export const dynamic = 'force-dynamic';

const STATUSES: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'pending', label: 'Chờ cọc' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'completed', label: 'Đã hoàn tất' },
  { value: 'cancelled', label: 'Đã hủy' },
];

export default async function OwnerBookingsPage({ searchParams }: { searchParams: Promise<{ venue?: string; status?: string; date?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/chu-san/don');
  const params = await searchParams;
  const status = STATUSES.some((item) => item.value === params.status) ? params.status! : 'all';
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? params.date! : '';
  const { data: venues, error: venuesError } = await supabase.from('venues').select('id, name').eq('owner_id', user.id).order('created_at').order('id');
  if (venuesError) throw new Error('Không tải được danh sách sân.');
  if (!venues?.length) return <Empty />;
  const venue = venues.find((item) => item.id === params.venue) ?? venues[0];
  const from = selectedDate ? selectedDate : ymd(new Date());
  const to = selectedDate ? selectedDate : ymd(new Date(Date.now() + 30 * 86400000));
  let query = supabase.from('bookings').select('id, code, starts_at, ends_at, status, total_amount, deposit_amount, refund_status, customer_name, customer_phone, courts!inner(name, venue_id)').eq('courts.venue_id', venue.id).gte('starts_at', `${from}T00:00:00+07:00`).lte('starts_at', `${to}T23:59:59+07:00`).order('starts_at');
  if (status !== 'all') query = query.eq('status', status as BookingStatus);
  const { data: bookings, error } = await query;
  if (error) throw new Error('Không tải được danh sách đơn.');
  const rows = (bookings ?? []).map((booking) => ({ ...booking, courtName: (booking.courts as unknown as { name: string })?.name ?? 'Sân' }));
  const confirmed = rows.filter((booking) => booking.status === 'confirmed' || booking.status === 'completed');
  const pending = rows.filter((booking) => booking.status === 'pending');

  return <main className="mx-auto max-w-7xl px-5 py-8 lg:px-10 lg:py-10">
    <header className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-pitch">Vận hành</p><h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-pitch">Đơn đặt sân</h1><p className="mt-2 text-sm text-ink-secondary">Theo dõi khách, tiền cọc và những đơn cần xử lý tiếp theo.</p></div><Link href="/chu-san" className="rounded-control border border-hairline bg-card px-4 py-2.5 text-sm font-semibold text-pitch hover:border-strong">← Về tổng quan</Link></header>
    <OwnerVenuePicker venues={venues} selectedId={venue.id} pathname="/chu-san/don" query={{ status, date: selectedDate || undefined }} />
    <form className="mt-5 grid gap-3 rounded-card border border-hairline bg-card p-4 sm:grid-cols-[minmax(0,1fr)_180px_150px_auto] sm:items-end" method="get"><input type="hidden" name="venue" value={venue.id} /><label className="text-xs font-semibold text-ink-secondary">Trạng thái<select name="status" defaultValue={status} className="mt-1 h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm text-ink"><option value="all">Tất cả trạng thái</option>{STATUSES.slice(1).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="text-xs font-semibold text-ink-secondary sm:col-span-1">Ngày cụ thể<input type="date" name="date" defaultValue={selectedDate} className="mt-1 h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm text-ink" /></label><button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink"><Filter className="size-4" aria-hidden="true" /> Lọc đơn</button><Link href={`/chu-san/don?venue=${venue.id}`} className="inline-flex h-11 items-center justify-center rounded-control border border-hairline px-4 text-sm font-semibold text-ink-secondary">Xóa lọc</Link></form>
    <div className="mt-5 grid gap-3 sm:grid-cols-3"><MiniStat label="Trong danh sách" value={rows.length} icon={ReceiptText} /><MiniStat label="Đã xác nhận / hoàn tất" value={confirmed.length} icon={CalendarDays} /><MiniStat label="Đang chờ cọc" value={pending.length} icon={Filter} tone={pending.length ? 'peak' : undefined} /></div>
    <section className="mt-5 overflow-hidden rounded-card border border-hairline bg-card"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4"><div><h2 className="font-semibold text-pitch">{selectedDate ? `Đơn ngày ${selectedDate.split('-').reverse().join('/')}` : '30 ngày tới'}</h2><p className="mt-1 text-xs text-ink-secondary">{rows.length ? `${rows.length} đơn của ${venue.name}` : 'Không có đơn phù hợp với bộ lọc.'}</p></div><span className="rounded-pill bg-sunk px-3 py-1 text-xs font-semibold text-ink-secondary">{status === 'all' ? 'Tất cả' : STATUSES.find((item) => item.value === status)?.label}</span></div>
      {rows.length ? <div className="divide-y divide-hairline">{rows.map((booking) => <BookingRow key={booking.id} booking={booking} />)}</div> : <div className="px-5 py-16 text-center"><ReceiptText className="mx-auto size-9 text-strong" aria-hidden="true" /><p className="mt-3 font-semibold text-pitch">Chưa có đơn nào</p><p className="mt-1 text-sm text-ink-secondary">Thử đổi ngày hoặc trạng thái để xem thêm.</p></div>}
    </section>
  </main>;
}

function BookingRow({ booking }: { booking: { id: string; code: string; starts_at: string; ends_at: string; status: BookingStatus; total_amount: number; deposit_amount: number; refund_status: string | null; customer_name: string | null; customer_phone: string; courtName: string } }) {
  return <article className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-page"><div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-control bg-sunk text-pitch"><span className="text-xs font-semibold">{hhmm(booking.starts_at)}</span><span className="mt-0.5 text-[10px] text-ink-secondary">{hhmm(booking.ends_at)}</span></div><div className="min-w-[180px] flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{booking.customer_name ?? 'Khách đặt sân'}</p><StatusBadge status={booking.status} /></div><p className="mt-1 text-xs text-ink-secondary">{booking.code} · {booking.courtName} · {booking.customer_phone}</p></div><div className="text-left sm:text-right"><p className="text-sm font-semibold tabular-nums text-pitch">{vnd(booking.total_amount)}</p><p className="mt-1 text-xs text-ink-secondary">cọc {vnd(booking.deposit_amount)}</p></div>{booking.status === 'pending' && <ConfirmPaymentButton code={booking.code} />}{booking.refund_status === 'needed' && <RefundDoneButton code={booking.code} />}</article>;
}

function MiniStat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof ReceiptText; tone?: 'peak' }) {
  return <div className={`flex items-center gap-3 rounded-card border p-4 ${tone === 'peak' ? 'border-peak-line bg-peak-fill' : 'border-hairline bg-card'}`}><Icon className={`size-5 ${tone === 'peak' ? 'text-peak-ink' : 'text-pitch'}`} aria-hidden="true" /><span><strong className="block font-display text-2xl font-bold text-pitch">{value}</strong><span className="text-xs text-ink-secondary">{label}</span></span></div>;
}

function Empty() {
  return <main className="mx-auto max-w-3xl px-5 py-16 lg:px-16"><h1 className="font-display text-3xl font-extrabold text-pitch">Bạn chưa có cụm sân nào</h1><p className="mt-3 text-sm text-ink-secondary">Tạo cụm sân để bắt đầu nhận và quản lý đơn đặt sân.</p><Link href="/chu-san/quan-ly" className="mt-6 inline-flex rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink">Tạo cụm sân</Link></main>;
}
