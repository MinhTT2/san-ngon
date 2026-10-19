import Link from 'next/link';
import { CalendarCheck, Filter, ReceiptText, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { QueryError } from '@/components/query-error';
import { AdminBookingList } from '@/components/admin-booking-list';
import { ADMIN_BOOKING_GROUPS, type AdminBookingFilter, type AdminBookingParams, type AdminBookingResult } from '@/lib/admin-bookings';

export async function AdminBookings({ params }: { params: AdminBookingParams }) {
  const filter: AdminBookingFilter = ADMIN_BOOKING_GROUPS.find(item => item.value === params.filter)?.value
    ?? (params.status === 'pending' ? 'pending' : params.q?.trim() ? 'all' : 'upcoming');
  const query = (params.q ?? '').trim().slice(0,100);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.from ?? '') ? params.from! : '';
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.to ?? '') ? params.to! : '';
  const page = /^\d{1,9}$/.test(params.page ?? '') ? Math.max(1,Number(params.page)) : 1;
  const db = await createClient();
  const { data, error } = await db.rpc('search_admin_bookings', {
    p_filter: filter, p_query: query || null, p_from: from || null, p_to: to || null, p_page: page,
  });
  const result = !error && data && typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.rows)
    ? data as unknown as AdminBookingResult : null;
  const group = ADMIN_BOOKING_GROUPS.find(item => item.value === filter)!;
  const href = (nextFilter: AdminBookingFilter, nextPage = 1) => `/admin?${new URLSearchParams({
    view: 'bookings', filter: nextFilter, ...(query ? { q: query } : {}),
    ...(from ? { from } : {}), ...(to ? { to } : {}), ...(nextPage > 1 ? { page: String(nextPage) } : {}),
  })}`;

  return <div className="mt-6 space-y-5">
    <nav aria-label="Nhóm đơn đặt sân" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {ADMIN_BOOKING_GROUPS.map(item => <Link key={item.value} href={href(item.value)} aria-current={filter === item.value ? 'page' : undefined}
        className={`pf-action min-w-0 rounded-card border p-4 ${filter === item.value ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline bg-card text-pitch hover:border-strong'}`}>
        <span className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{item.label}</span><strong className="font-display text-2xl font-bold tabular-nums">{result ? result[item.count] : '—'}</strong></span>
        <span className={`mt-2 block text-[11px] leading-5 ${filter === item.value ? 'text-pitch-ink/80' : 'text-ink-secondary'}`}>{item.hint}</span>
      </Link>)}
    </nav>
    <section className="min-w-0 overflow-hidden rounded-card border border-hairline bg-card" aria-label="Danh sách đơn đặt sân">
      <form key={`${filter}:${query}:${from}:${to}`} method="get" className="border-b border-hairline p-4 sm:p-5">
        <input type="hidden" name="view" value="bookings" />
        {/* Searching always starts with every order; queue links retain the search. */}
        <input type="hidden" name="filter" value="all" />
        <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_150px_150px_auto]">
          <label className="min-w-0 text-xs font-semibold text-ink-secondary sm:col-span-2 xl:col-span-1">Mã đơn, khách, điện thoại hoặc sân
            <span className="relative mt-1.5 block"><Search size={16} className="pointer-events-none absolute left-3 top-3.5" aria-hidden="true" /><input type="search" name="q" maxLength={100} defaultValue={query} placeholder="VD: SANABC234, 0912345678, tên sân…" className="h-11 w-full rounded-control border border-hairline bg-page pl-10 pr-3 text-sm text-ink" /></span>
          </label>
          <label className="min-w-0 text-xs font-semibold text-ink-secondary">Ngày chơi từ<input type="date" name="from" defaultValue={from} className="mt-1.5 h-11 w-full min-w-0 rounded-control border border-hairline bg-page px-3 text-sm text-ink" /></label>
          <label className="min-w-0 text-xs font-semibold text-ink-secondary">Đến ngày<input type="date" name="to" defaultValue={to} className="mt-1.5 h-11 w-full min-w-0 rounded-control border border-hairline bg-page px-3 text-sm text-ink" /></label>
          <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-1"><button type="submit" className="pf-action inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink"><Filter size={15} aria-hidden="true" />Tìm đơn</button>{(query || from || to) && <Link href="/admin?view=bookings" className="pf-action inline-flex min-h-11 items-center px-3 text-xs font-semibold text-pitch underline underline-offset-4">Xóa lọc</Link>}</div>
        </div>
        <p className="mt-3 text-xs leading-5 text-ink-secondary">Tìm trên toàn bộ đơn, kể cả đơn cũ. Chọn nhóm phía trên để thu hẹp kết quả{query || from || to ? '; số lượng đã tính theo bộ lọc.' : '.'}</p>
      </form>
      {!result ? <QueryError className="m-4" title={error?.message.includes('INVALID_DATE_RANGE') || error?.code === '22008' || error?.code === '22007' ? 'Khoảng ngày không hợp lệ. Hãy chọn lại ngày lọc.' : 'Chưa tải được danh sách đơn đặt sân'} /> : <>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline p-4 sm:px-5"><div><h2 className="font-display text-xl font-bold text-pitch">{group.label === 'Sắp chơi' ? 'Đơn sắp chơi và đang chơi' : group.label === 'Cần hoàn' ? 'Đơn cần hoàn cọc' : filter === 'history' ? 'Lịch sử đặt sân' : filter === 'all' ? 'Tất cả đơn đặt sân' : 'Đơn chờ cọc'}</h2><p className="mt-1 text-xs leading-5 text-ink-secondary">{filter === 'upcoming' ? 'Đơn đã xác nhận, xếp theo giờ chơi gần nhất.' : filter === 'pending' ? 'Chỉ gồm giữ chỗ còn hạn, xếp theo hạn cọc gần nhất.' : filter === 'refund' ? 'Theo dõi chủ sân chuyển hoàn thủ công cho khách.' : 'Đơn mới tạo được xếp trước.'}</p></div><span className="rounded-pill bg-sunk px-3 py-1.5 text-xs font-semibold text-pitch">{result.matched} đơn</span></div>
        {result.rows.length ? <AdminBookingList bookings={result.rows} /> : <div role="status" className="px-5 py-12 text-center"><CalendarCheck className="mx-auto size-8 text-pitch" aria-hidden="true" /><p className="mt-3 font-semibold text-pitch">{query || from || to ? 'Không có đơn phù hợp' : filter === 'upcoming' ? 'Chưa có đơn sắp chơi' : filter === 'pending' ? 'Không có đơn đang chờ cọc' : filter === 'refund' ? 'Không có cọc đang chờ hoàn' : 'Chưa có đơn trong nhóm này'}</p><p className="mt-2 text-sm leading-6 text-ink-secondary">{query || from || to ? 'Thử đổi từ khóa, khoảng ngày hoặc nhóm đơn.' : filter === 'upcoming' ? 'Đơn đã nhận cọc sẽ xuất hiện ở đây. Bạn vẫn có thể tra cứu các đơn cũ trong Lịch sử.' : 'Các thay đổi được cập nhật khi có đơn mới hoặc khi quay lại trang.'}</p>{filter === 'upcoming' && !query && !from && !to && <Link href={href('history')} className="pf-action mt-4 inline-flex min-h-11 items-center gap-2 rounded-control border border-hairline px-4 text-sm font-semibold text-pitch"><ReceiptText size={16} aria-hidden="true" />Xem lịch sử đơn</Link>}</div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline p-4 text-xs text-ink-secondary"><span>{result.rows.length ? `${(result.page-1)*result.page_size+1}–${(result.page-1)*result.page_size+result.rows.length} / ${result.matched} đơn` : '0 đơn'}</span><nav aria-label="Phân trang đơn đặt sân" className="flex items-center gap-3">{result.page > 1 && <Link href={href(filter,result.page-1)} className="pf-action inline-flex min-h-11 items-center rounded-control border border-hairline px-3 font-semibold text-pitch">Trang trước</Link>}<span>Trang {result.page} / {result.pages}</span>{result.page < result.pages && <Link href={href(filter,result.page+1)} className="pf-action inline-flex min-h-11 items-center rounded-control border border-hairline px-3 font-semibold text-pitch">Trang sau</Link>}</nav></div>
      </>}
    </section>
  </div>;
}
