import Link from 'next/link';
import { DashboardPageHeader, DashboardLink } from '@/components/dashboard-page-header';
import { redirect } from 'next/navigation';
import { CalendarDays, Filter, ReceiptText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ConfirmPaymentButton, RefundDoneButton } from '@/components/owner-booking-actions';
import { StatusBadge } from '@/components/status-badge';
import { dayLabel, hhmm, vnd, ymd } from '@/lib/format';
import type { BookingStatus } from '@/lib/types';
import { CountUp } from '@/components/count-up';
import { QueryError } from '@/components/query-error';
import { OwnerVenuePicker } from '@/components/owner-venue-picker';

export const dynamic = 'force-dynamic';

const STATUSES: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'pending', label: 'Chờ cọc' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'completed', label: 'Đã hoàn tất' },
  { value: 'cancelled', label: 'Đã hủy' },
  { value: 'no_show', label: 'Không tới' },
];

export default async function OwnerBookingsPage({ searchParams }: { searchParams: Promise<{ venue?: string; status?: string; date?: string; from?: string; to?: string; q?: string; page?: string; scope?: string; refund?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/chu-san/don');
  const params = await searchParams;
  const status = STATUSES.some((item) => item.value === params.status) ? params.status! : 'all';
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? params.date! : '';
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.from ?? '') ? params.from! : selectedDate;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.to ?? '') ? params.to! : selectedDate;
  const search = (params.q ?? '').trim().slice(0,100);
  const refundNeeded = params.refund === 'needed';
  const scope = params.scope === 'all' || refundNeeded ? 'all' : 'upcoming';
  const page = /^\d{1,9}$/.test(params.page ?? '') ? Math.max(1,Number(params.page)) : 1;
  const { data: venues, error: venuesError } = await supabase.from('venues').select('id, name').eq('owner_id', user.id).order('created_at').order('id');
  if (venuesError) throw new Error('Không tải được danh sách sân.');
  if (!venues?.length) return <Empty />;
  const venue = venues.find((item) => item.id === params.venue) ?? venues[0];
  const { data, error } = await supabase.rpc('search_owner_bookings', {
    p_venue_id: venue.id, p_query: search || null, p_status: status,
    p_from: from || null, p_to: to || null, p_page: page, p_show_history: scope === 'all', p_refund_needed: refundNeeded,
  });
  type Result = { rows: Parameters<typeof BookingRow>[0]['booking'][]; total: number; confirmed: number; pending: number; page: number; pages: number; page_size: number; from: string | null; to: string | null };
  const result = !error && data && typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.rows) ? data as unknown as Result : null;
  const rows = result?.rows ?? [];
  const filters = { venue: venue.id, status, q: search || undefined, from: from || undefined, to: to || undefined, scope, refund: refundNeeded ? 'needed' : undefined };
  const pageHref = (next: number) => `/chu-san/don?${new URLSearchParams(Object.entries({ ...filters, page: String(next) }).filter((entry): entry is [string,string] => Boolean(entry[1])))}`;

  return <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <DashboardPageHeader eyebrow="Chủ sân / Vận hành" title="Đơn đặt sân" description="Theo dõi khách, tiền cọc và các đơn cần xử lý." actions={<DashboardLink href="/chu-san">Tổng quan</DashboardLink>} />
    <OwnerVenuePicker venues={venues} selectedId={venue.id} pathname="/chu-san/don" query={filters} />
    <form key={`${venue.id}:${status}:${search}:${from}:${to}:${scope}:${refundNeeded}`} className="mt-5 grid gap-3 rounded-card border border-hairline bg-card p-4 sm:grid-cols-2 xl:grid-cols-4 sm:items-end" method="get">
      <input type="hidden" name="venue" value={venue.id} />
      <label className="text-xs font-semibold text-ink-secondary sm:col-span-2">Mã đơn, số điện thoại hoặc tên khách<input name="q" maxLength={100} defaultValue={search} placeholder="VD: SANABC234 hoặc 0912345678" className="mt-1 h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm text-ink" /></label>
      <label className="text-xs font-semibold text-ink-secondary"><span id="owner-booking-status-label">Trạng thái</span><select aria-labelledby="owner-booking-status-label" name="status" defaultValue={status} className="mt-1 h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm text-ink">{STATUSES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="text-xs font-semibold text-ink-secondary"><span id="owner-booking-scope-label">Phạm vi</span><select aria-labelledby="owner-booking-scope-label" name="scope" defaultValue={scope} className="mt-1 h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm text-ink"><option value="upcoming">30 ngày tới</option><option value="all">Cả lịch sử</option></select></label>
      <label className="text-xs font-semibold text-ink-secondary">Từ ngày<input type="date" name="from" defaultValue={from} className="mt-1 h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm text-ink" /></label>
      <label className="text-xs font-semibold text-ink-secondary">Đến ngày<input type="date" name="to" defaultValue={to} className="mt-1 h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm text-ink" /></label>
      <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink"><Filter className="size-4" aria-hidden="true" /> Lọc đơn</button>
      <Link href={`/chu-san/don?venue=${venue.id}`} className="inline-flex h-11 items-center justify-center rounded-control border border-hairline px-4 text-sm font-semibold text-ink-secondary">Xóa lọc</Link>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-pitch sm:col-span-2 xl:col-span-4"><input type="checkbox" name="refund" value="needed" defaultChecked={refundNeeded} className="size-4 accent-pitch" />Chỉ đơn cần hoàn cọc</label>
      <p className="text-xs leading-6 text-ink-secondary sm:col-span-2 xl:col-span-4">Tìm mã, tên, số điện thoại hoặc đơn cần hoàn cọc sẽ gồm cả đơn cũ, trừ khi bạn chọn giới hạn ngày. Số liệu bên dưới tính trên tất cả đơn phù hợp, không chỉ trang đang xem.</p>
    </form>
    {!result ? <QueryError className="mt-5" title={error?.message.includes('INVALID_DATE_RANGE') || error?.code === '22008' || error?.code === '22007' ? 'Khoảng ngày không hợp lệ. Hãy chọn lại ngày lọc.' : 'Chưa tải được danh sách đơn đặt sân'} /> : <>
    <div className="mt-5 grid gap-3 sm:grid-cols-3"><MiniStat label="Phù hợp bộ lọc" value={result.total} icon={ReceiptText} /><MiniStat label="Đã xác nhận / hoàn tất" value={result.confirmed} icon={CalendarDays} /><MiniStat label="Đang chờ cọc" value={result.pending} icon={Filter} tone={result.pending ? 'peak' : undefined} /></div>
    <section className="mt-5 overflow-hidden rounded-card border border-hairline bg-card"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4"><div><h2 className="font-semibold text-pitch">{result.from || result.to ? `Đơn ${result.from ? 'từ ' + result.from.split('-').reverse().join('/') : ''}${result.to ? ' đến ' + result.to.split('-').reverse().join('/') : ''}` : 'Cả lịch sử đặt sân'}</h2><p className="mt-1 text-xs text-ink-secondary">{rows.length ? `${(result.page-1)*result.page_size+1}–${(result.page-1)*result.page_size+rows.length} / ${result.total} đơn của ${venue.name}` : 'Không có đơn phù hợp với bộ lọc.'}</p></div><span className="rounded-pill bg-sunk px-3 py-1 text-xs font-semibold text-ink-secondary">{status === 'all' ? 'Tất cả' : STATUSES.find((item) => item.value === status)?.label}</span></div>
      {rows.length ? <div className="divide-y divide-hairline">{rows.map((booking) => <BookingRow key={booking.id} booking={booking} />)}</div> : <div className="px-5 py-16 text-center"><ReceiptText className="mx-auto size-9 text-strong" aria-hidden="true" /><p className="mt-3 font-semibold text-pitch">Chưa có đơn nào</p><p className="mt-1 text-sm text-ink-secondary">Thử đổi ngày hoặc trạng thái để xem thêm.</p></div>}
    </section>
    {result.pages > 1 && <nav aria-label="Phân trang đơn đặt sân" className="mt-5 flex flex-wrap items-center justify-between gap-3">
      {result.page > 1 ? <Link href={pageHref(result.page-1)} className="pf-action inline-flex min-h-11 items-center rounded-control border border-hairline bg-card px-4 text-sm font-semibold text-pitch">Trang trước</Link> : <span />}
      <span className="text-sm text-ink-secondary">Trang {result.page} / {result.pages}</span>
      {result.page < result.pages ? <Link href={pageHref(result.page+1)} className="pf-action inline-flex min-h-11 items-center rounded-control border border-hairline bg-card px-4 text-sm font-semibold text-pitch">Trang sau</Link> : <span />}
    </nav>}
    </>}
  </main>;
}

function BookingRow({ booking }: { booking: { id: string; code: string; starts_at: string; ends_at: string; status: BookingStatus; total_amount: number; deposit_amount: number; refund_status: string | null; customer_name: string | null; customer_phone: string; courtName: string } }) {
  return <article data-motion-item className="pf-booking-record grid items-start gap-4 px-4 py-5 sm:px-5 xl:grid-cols-[minmax(0,1fr)_130px_minmax(0,230px)]"><div className="flex min-w-0 items-start gap-4"><time dateTime={booking.starts_at} className="flex w-16 shrink-0 flex-col overflow-hidden rounded-control border border-hairline bg-page text-center text-pitch"><span className="border-b border-hairline bg-free-fill py-1 text-[10px] font-semibold">{ymd(new Date(booking.starts_at)).slice(5, 7)}/{ymd(new Date(booking.starts_at)).slice(0, 4)}</span><span className="py-1 font-display text-2xl font-bold">{ymd(new Date(booking.starts_at)).slice(8, 10)}</span></time><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{booking.customer_name ?? 'Khách đặt sân'}</p><StatusBadge status={booking.status} /></div><p className="mt-1.5 text-xs font-semibold text-pitch">{hhmm(booking.starts_at)} – {hhmm(booking.ends_at)} · {booking.courtName}</p><p className="mt-1 text-xs leading-5 text-ink-secondary">{dayLabel(new Date(booking.starts_at))}</p><p className="mt-2 break-all text-[11px] font-medium text-ink-secondary">{booking.code} · <a href={`tel:${booking.customer_phone}`} className="underline underline-offset-4">{booking.customer_phone}</a></p></div></div><div className="border-t border-hairline pt-3 xl:border-0 xl:pt-0 xl:text-right"><p className="text-sm font-semibold tabular-nums text-pitch">{vnd(booking.total_amount)}</p><p className="mt-1 text-xs text-ink-secondary">cọc {vnd(booking.deposit_amount)}</p></div><div className="flex flex-wrap gap-2 xl:justify-end">{booking.status === 'pending' && <ConfirmPaymentButton code={booking.code} customerName={booking.customer_name} customerPhone={booking.customer_phone} courtName={booking.courtName} depositAmount={booking.deposit_amount} />}{booking.refund_status === 'needed' && <RefundDoneButton code={booking.code} customerName={booking.customer_name} customerPhone={booking.customer_phone} courtName={booking.courtName} depositAmount={booking.deposit_amount} />}</div></article>;
}

function MiniStat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof ReceiptText; tone?: 'peak' }) {
  return <div data-motion-item className={`flex items-center gap-3 rounded-card border p-4 ${tone === 'peak' ? 'border-peak-line bg-peak-fill' : 'border-hairline bg-card'}`}><Icon className={`size-5 ${tone === 'peak' ? 'text-peak-ink' : 'text-pitch'}`} aria-hidden="true" /><span><strong className="block font-display text-2xl font-bold text-pitch"><CountUp to={value} /></strong><span className="text-xs text-ink-secondary">{label}</span></span></div>;
}

function Empty() {
  return <main className="mx-auto max-w-3xl px-5 py-16 lg:px-16"><h1 className="font-display text-3xl font-extrabold text-pitch">Bạn chưa có cụm sân nào</h1><p className="mt-3 text-sm text-ink-secondary">Tạo cụm sân để bắt đầu nhận và quản lý đơn đặt sân.</p><Link href="/chu-san/quan-ly" className="mt-6 inline-flex rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink">Tạo cụm sân</Link></main>;
}
