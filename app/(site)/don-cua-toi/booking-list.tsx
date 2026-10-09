'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { playMotion } from '@/lib/motion';
import { NavigationMarker } from '@/components/navigation-marker';
import { useRouter } from 'next/navigation';
import { ArrowRight, CalendarDays, Clock3, History, Plus, Search } from 'lucide-react';
import { CancelBookingButton } from '@/components/cancel-booking-button';
import { StatusBadge } from '@/components/status-badge';
import { createClient, subscribeWithSession } from '@/lib/supabase/client';
import { dayLabel, hhmm, vnd, ymd } from '@/lib/format';
import { CANCEL_WINDOW_HOURS, HOLD_MINUTES, SPORT_LABELS } from '@/lib/constants';
import type { Booking } from '@/lib/types';
import { useQueryControls } from '@/lib/use-query-controls';
import { CopyButton } from '@/components/copy-button';

export type MyBooking = Pick<Booking, 'id' | 'code' | 'starts_at' | 'ends_at' | 'status' | 'total_amount' | 'deposit_amount' | 'expires_at' | 'paid_at' | 'refund_status'> & {
  courts: { name: string; sport: string; venues: { name: string; district: string; slug: string; status: string } | null } | null;
};

type Filter = 'active' | 'pending' | 'confirmed' | 'history' | 'all';

export function BookingList({ bookings, userId, initialNow, failed = false, summary, invalidRange = false }: {
  bookings: MyBooking[];
  userId: string;
  initialNow: number;
  failed?: boolean;
  invalidRange?: boolean;
  summary?: { total: number; pending: number; confirmed: number; history: number; matched: number; page: number; pages: number; page_size: number };
}) {
  const router = useRouter();
  const { params } = useQueryControls();
  const [isNavigating, startTransition] = useTransition();
  const navigate = (values: Record<string, string | null>, push = false) => {
    const url = new URL(window.location.href);
    for (const [key,value] of Object.entries(values)) {
      if (value) url.searchParams.set(key,value); else url.searchParams.delete(key);
    }
    if (!Object.hasOwn(values,'page')) url.searchParams.delete('page');
    startTransition(() => { if (push) router.push(url.pathname+url.search, {scroll:false}); else router.replace(url.pathname+url.search, {scroll:false}); });
  };
  const requestedFilter = params.get('filter') ?? '';
  const filter: Filter = ['active', 'pending', 'confirmed', 'history', 'all'].includes(requestedFilter) ? requestedFilter as Filter : 'active';
  const urlQuery = (params.get('q') ?? '').slice(0, 100);
  const [query,setQuery] = useState(urlQuery);
  useEffect(() => { setQuery(urlQuery); }, [urlQuery]);
  useEffect(() => {
    if (query === urlQuery) return;
    const timer = setTimeout(() => navigate({q:query || null}),300);
    return () => clearTimeout(timer);
    // navigate reads the latest URL; typing stays local until the debounce ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query,urlQuery]);
  const setFilter = (value: Filter) => navigate({filter:value === 'active' ? null : value,q:query || null},true);
  const resultsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (resultsRef.current) return playMotion(resultsRef.current, { opacity: [0.45, 1] }, { duration: 0.28 });
  }, [filter]);
  const [clock, setClock] = useState(initialNow);
  const now = Math.max(clock, initialNow);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => { setClock(Date.now()); router.refresh(); };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    const channel = supabase.channel(`my-bookings:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `user_id=eq.${userId}` }, refresh);
    const unsubscribe = subscribeWithSession(supabase, channel, status => { if (status === 'SUBSCRIBED') refresh(); });
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router, userId]);

  // Chuyển cách hiển thị ngay khi hết giữ chỗ, kể cả cron chưa đổi trạng thái.
  // Đây chỉ là nhãn UI; quyền thanh toán/hủy vẫn do SQL quyết định.
  useEffect(() => {
    const deadlines = bookings.flatMap((b) => b.status === 'pending' ? [Date.parse(b.expires_at)]
      : b.status === 'confirmed' ? [Date.parse(b.ends_at)] : []).filter((time) => time > now);
    if (!deadlines.length) return;
    const timer = setTimeout(() => { setClock(Date.now()); router.refresh(); }, Math.min(2_147_483_647, Math.min(...deadlines) - now + 100));
    return () => clearTimeout(timer);
  }, [bookings, now, router]);

  const rows = bookings.map((b) => {
    const expired = b.status === 'pending' && Date.parse(b.expires_at) <= now;
    const pending = b.status === 'pending' && !expired;
    const confirmed = b.status === 'confirmed' && Date.parse(b.ends_at) > now;
    return { ...b, expired, pending, confirmed, active: pending || confirmed };
  });
  const pendingCount = summary?.pending ?? 0;
  const confirmedCount = summary?.confirmed ?? 0;
  const historyCount = summary?.history ?? 0;
  const visible = rows;
  const matched = summary?.matched ?? 0;
  const pageHref = (page: number) => {
    const next = new URLSearchParams(params.toString()); next.set('page',String(page));
    return `/don-cua-toi?${next}`;
  };
  const summaries = [
    { key: 'pending' as const, label: 'Chờ cọc', count: pendingCount, note: 'Thanh toán để xác nhận sân', Icon: Clock3 },
    { key: 'confirmed' as const, label: 'Sắp chơi / đang chơi', count: confirmedCount, note: 'Sân đã được xác nhận', Icon: CalendarDays },
    { key: 'history' as const, label: 'Lịch sử đặt sân', count: historyCount, note: 'Đã kết thúc, hủy hoặc hết hạn', Icon: History },
  ];

  return (
    <main className="mx-auto max-w-7xl px-5 pb-16 pt-8 lg:px-12 lg:pt-12 [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-4 [&_a:focus-visible]:outline-pitch [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-4 [&_button:focus-visible]:outline-pitch">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-secondary">Lịch chơi của bạn</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-pitch sm:text-5xl">Đơn của tôi</h1>
          <p className="mt-3 text-sm leading-6 text-ink-secondary">Xem sân đã đặt, tiếp tục chuyển cọc và quản lý lịch chơi.</p>
        </div>
        <Link href="/tim-san" className="pf-action inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink hover:bg-pitch/90">
          <Plus size={17} aria-hidden="true" /> Đặt sân mới
        </Link>
      </header>

      <form key={`${params.get('from')}:${params.get('to')}`} method="get" className="mt-6 flex flex-wrap items-end gap-3 rounded-card border border-hairline bg-card p-4">
        <input type="hidden" name="filter" value={filter} /><input type="hidden" name="q" value={query} />
        <label className="min-w-0 text-xs font-semibold text-ink-secondary">Từ ngày<input type="date" name="from" defaultValue={params.get('from') ?? ''} className="mt-1 block min-h-11 rounded-control border border-hairline bg-page px-3 text-sm" /></label>
        <label className="min-w-0 text-xs font-semibold text-ink-secondary">Đến ngày<input type="date" name="to" defaultValue={params.get('to') ?? ''} className="mt-1 block min-h-11 rounded-control border border-hairline bg-page px-3 text-sm" /></label>
        <button type="submit" className="min-h-11 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink">Lọc ngày</button>
        <Link href={`/don-cua-toi?${new URLSearchParams({filter,...(query ? {q:query} : {})})}`} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-pitch underline">Xóa lọc ngày</Link>
      </form>

      {failed ? (
        <div role="alert" className="mt-8 rounded-card border border-hairline bg-card p-8 text-center">
          <p className="font-semibold">{invalidRange ? 'Khoảng ngày không hợp lệ. Hãy chọn lại ngày lọc.' : 'Chưa tải được đơn của bạn'}</p>
          <p className="mt-2 text-sm text-ink-secondary">Vui lòng thử lại để xem tình trạng đặt sân mới nhất.</p>
          <button onClick={() => router.refresh()} className="mt-4 rounded-control border border-pitch px-5 py-3 text-sm font-semibold text-pitch">Thử lại</button>
        </div>
      ) : <>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {summaries.map(({ key, label, count, note, Icon }) => (
            <button key={key} type="button" onClick={() => setFilter(key)} aria-pressed={filter === key}
              className={`pf-action flex items-center gap-4 rounded-card border p-4 text-left transition-colors sm:items-start sm:p-5 ${filter === key ? 'border-pitch bg-free-fill' : 'border-hairline bg-card hover:border-strong'}`}>
              <span className={`grid size-10 shrink-0 place-items-center rounded-control ${key === 'pending' && count ? 'bg-peak-fill text-peak-ink' : 'bg-sunk text-pitch'}`}><Icon size={20} aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3 sm:block"><p className="text-sm text-ink-secondary">{label}</p><p className="font-display text-3xl font-bold tabular-nums text-pitch sm:mt-2">{count}</p></div>
                <p className="mt-1 text-xs leading-5 text-ink-secondary">{note}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-card border border-hairline bg-card p-4">
          <label htmlFor="booking-search" className="relative min-w-0 flex-1"><span className="sr-only">Tìm đơn theo mã hoặc tên sân</span><Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 text-ink-secondary" /><input id="booking-search" type="search" value={query} maxLength={100} onChange={event => setQuery(event.target.value)} placeholder="Tìm mã đơn, tên sân, khu vực…" className="min-h-11 w-full rounded-control border border-hairline bg-page pl-10 pr-3 text-sm" /></label>
          {query && <button type="button" onClick={() => { setQuery(''); navigate({q:null}); }} className="min-h-11 px-2 text-sm font-semibold text-pitch underline">Xóa tìm kiếm</button>}
          <p role="status" className="w-full text-xs text-ink-secondary sm:w-auto">{isNavigating ? 'Đang tải kết quả…' : `${matched} đơn trong mục đang xem`}</p>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-hairline">
          <div role="group" aria-label="Lọc đơn đặt sân" className="pf-tab-rail relative isolate flex gap-1"><NavigationMarker activeKey={filter} variant="underline" />
            {([
              ['active', 'Đang đặt', pendingCount + confirmedCount],
              ['history', 'Lịch sử', historyCount],
              ['all', 'Tất cả', summary?.total ?? 0],
            ] as const).map(([key, label, count]) => (
              <button key={key} type="button" aria-pressed={filter === key || (key === 'active' && (filter === 'pending' || filter === 'confirmed'))} onClick={() => setFilter(key)}
                className={`pf-tab-link relative z-10 flex min-h-12 items-center gap-2 border-b-2 px-2 text-sm font-semibold sm:px-4 ${filter === key || (key === 'active' && (filter === 'pending' || filter === 'confirmed')) ? 'border-pitch text-pitch' : 'border-transparent text-ink-secondary hover:text-pitch'}`}>
                {label}<span className="rounded-pill bg-sunk px-2 py-0.5 text-xs tabular-nums">{count}</span>
              </button>
            ))}
          </div>
          <p className="pb-3 text-xs text-ink-secondary sm:pb-0">{filter === 'pending' ? 'Chỉ hiện đơn chờ cọc' : filter === 'confirmed' ? 'Chỉ hiện sân đã xác nhận' : 'Giờ chơi theo giờ Việt Nam'}</p>
        </div>

        <div ref={resultsRef} data-booking-results aria-busy={isNavigating}>
        {visible.length === 0 ? (
          <div className="mt-5 rounded-card border border-hairline bg-card px-5 py-14 text-center">
            <CalendarDays className="mx-auto text-pitch" size={32} strokeWidth={1.5} aria-hidden="true" />
            <h2 className="mt-4 font-display text-2xl font-bold text-pitch">{query.trim() ? 'Không có đơn khớp trong mục này' : (summary?.total ?? 0) === 0 ? 'Chưa có buổi chơi nào' : filter === 'pending' ? 'Không có đơn chờ cọc' : filter === 'history' ? 'Chưa có lịch sử đặt sân' : 'Bạn chưa có lịch chơi sắp tới'}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-secondary">{query.trim() ? 'Thử tên sân hoặc mã đơn ngắn hơn, hoặc tìm trong tất cả đơn của bạn.' : (summary?.total ?? 0) > 0 && filter !== 'history' ? 'Đơn đã kết thúc, hủy hoặc hết hạn nằm trong Lịch sử.' : 'Chọn sân và khung giờ phù hợp. Các đơn của bạn sẽ xuất hiện tại đây.'}</p>
            {query.trim() && filter !== 'all' ? <button type="button" onClick={() => setFilter('all')} className="mt-5 min-h-11 rounded-control border border-hairline px-5 text-sm font-semibold text-pitch">Tìm trong tất cả đơn</button> : <Link href="/tim-san" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-pitch underline underline-offset-4">Tìm sân để chơi <ArrowRight size={16} aria-hidden="true" /></Link>}
          </div>
        ) : (
          <div className="pf-booking-table mt-5 lg:overflow-hidden lg:rounded-card lg:border lg:border-hairline lg:bg-card">
            <table className="block w-full text-left text-sm lg:table lg:table-fixed">
              <caption className="sr-only">Danh sách đơn đặt sân, {visible.length} đơn</caption>
              <thead className="hidden border-b border-hairline bg-sunk text-xs text-ink-secondary lg:table-header-group">
                <tr><th scope="col" className="w-[25%] px-5 py-4 font-medium">Sân & mã đơn</th><th scope="col" className="w-[20%] px-4 py-4 font-medium">Lịch chơi</th><th scope="col" className="w-[19%] px-4 py-4 font-medium">Tiền sân & cọc</th><th scope="col" className="w-[19%] px-4 py-4 font-medium">Trạng thái</th><th scope="col" className="w-[17%] px-4 py-4 font-medium">Thao tác</th></tr>
              </thead>
              <tbody className="flex flex-col gap-4 lg:table-row-group">
                {visible.map((b) => (
                  <tr key={b.id} className="pf-player-booking grid grid-cols-2 gap-x-4 gap-y-5 rounded-card border border-hairline bg-card p-5 lg:table-row lg:rounded-none lg:border-x-0 lg:border-t-0 lg:p-0 lg:align-top lg:last:border-b-0">
                    <td className="col-span-2 block min-w-0 lg:table-cell lg:px-5 lg:py-6">
                      <p className="font-display text-lg font-bold leading-snug text-pitch">{b.courts?.venues?.name ?? 'Thông tin sân đang cập nhật'}</p>
                      <p className="mt-1.5 font-medium">{b.courts?.name ?? 'Sân đã đặt'}{b.courts?.sport && <span className="font-normal text-ink-secondary"> · {SPORT_LABELS[b.courts.sport]}</span>}</p>
                      <p className="mt-1 text-xs text-ink-secondary">{b.courts?.venues?.district}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2"><Link href={`/dat-san/${b.code}`} className="inline-flex min-h-11 items-center text-xs font-semibold tracking-wide text-ink-secondary underline decoration-hairline underline-offset-4">{b.code}</Link><CopyButton value={b.code} /></div>
                    </td>
                    <td className="block min-w-0 lg:table-cell lg:px-4 lg:py-6">
                      <p className="mb-2 text-xs text-ink-secondary lg:hidden">Lịch chơi</p>
                      <p className="font-semibold tabular-nums">{hhmm(b.starts_at)} – {hhmm(b.ends_at)}</p>
                      <p className="mt-1.5 text-xs leading-5 text-ink-secondary">{dayLabel(new Date(b.starts_at))}/{ymd(new Date(b.starts_at)).slice(0, 4)}</p>
                    </td>
                    <td className="block min-w-0 lg:table-cell lg:px-4 lg:py-6">
                      <p className="mb-2 text-xs text-ink-secondary lg:hidden">Tiền sân & cọc</p>
                      <p className="font-semibold tabular-nums">{vnd(b.total_amount)} <span className="text-xs font-normal text-ink-secondary">tổng</span></p>
                      <p className={`mt-1.5 text-xs leading-5 ${b.pending ? 'text-peak-ink' : 'text-ink-secondary'}`}>
                        {b.pending ? `Cần cọc ${vnd(b.deposit_amount)}` : b.paid_at ? `Đã cọc ${vnd(b.deposit_amount)}` : b.refund_status === 'needed' || b.refund_status === 'done' ? 'Có giao dịch chuyển khoản' : 'Chưa ghi nhận cọc'}
                      </p>
                      {(b.status === 'confirmed' || b.status === 'completed' || b.pending) && <p className="mt-1 text-xs leading-5 text-ink-secondary">{b.deposit_amount >= b.total_amount ? b.pending ? 'Cọc bằng toàn bộ tiền sân' : 'Đã thanh toán đủ tiền sân' : <>{b.pending ? 'Sau cọc, trả tại sân' : 'Trả tại sân'} {vnd(b.total_amount - b.deposit_amount)}</>}</p>}
                      {b.refund_status === 'needed' && <p className="mt-1 text-xs font-medium text-peak-ink">Đang chờ hoàn cọc</p>}
                      {b.refund_status === 'done' && <p className="mt-1 text-xs font-medium text-success">Đã hoàn cọc</p>}
                    </td>
                    <td className="col-span-2 block border-t border-hairline pt-4 lg:table-cell lg:border-0 lg:px-4 lg:py-6">
                      {b.expired || b.status === 'completed' ? <span className="inline-block rounded-pill bg-sunk px-2.5 py-1 text-xs font-medium text-ink-secondary">{b.expired ? 'Hết hạn giữ chỗ' : 'Đã chơi xong'}</span> : <StatusBadge status={b.status} />}
                      <p className="mt-2 text-xs leading-5 text-ink-secondary">{b.pending ? `Giữ đến ${hhmm(b.expires_at)} · ${dayLabel(new Date(b.expires_at))}` : b.confirmed ? 'Đã giữ sân cho bạn.' : b.expired ? 'Khung giờ đã được mở lại.' : b.status === 'cancelled' ? 'Đơn đã đóng, không còn giữ sân.' : b.status === 'confirmed' ? 'Đã qua giờ chơi.' : 'Đơn đã kết thúc.'}</p>
                    </td>
                    <td className="col-span-2 block lg:table-cell lg:px-4 lg:py-6">
                      <div className="flex flex-wrap items-center gap-4 lg:flex-col lg:items-start lg:gap-3">
                        <Link href={`/dat-san/${b.code}`} className={`inline-flex min-h-11 items-center justify-center rounded-control px-3 text-center text-xs font-semibold ${b.pending ? 'bg-pitch text-pitch-ink hover:bg-pitch/90' : 'border border-hairline text-pitch hover:bg-sunk'}`}>{b.pending ? 'Tiếp tục thanh toán' : 'Xem chi tiết'}</Link>
                        {b.active && <CancelBookingButton code={b.code} pending={b.pending} refundable={b.status === 'confirmed' && Date.parse(b.starts_at) - now >= CANCEL_WINDOW_HOURS * 3600_000} className="min-h-11 lg:min-h-0" />}
                        <details className="w-full text-xs"><summary className="inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline">Các thao tác khác</summary><div className="flex flex-col items-start gap-1">
                          {b.courts?.venues?.status === 'active' && <Link href={`/san/${b.courts.venues.slug}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline">Đặt lại sân này</Link>}
                          {(b.status === 'confirmed' || b.status === 'completed') && <><a href={`/api/bookings/${b.code}/calendar`} className="inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline">Tải lịch buổi chơi</a><p className="text-xs leading-5 text-ink-secondary">Lịch đã tải không tự cập nhật khi hủy đơn.</p></>}
                          <Link href={'/ho-tro-giao-dich?code='+b.code} className="inline-flex min-h-11 items-center text-sm text-ink-secondary underline">Cần hỗ trợ đơn này?</Link>
                        </div></details>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
        {summary && summary.pages > 1 && <nav aria-label="Phân trang đơn của tôi" className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {summary.page > 1 ? <Link href={pageHref(summary.page-1)} scroll={false} className="inline-flex min-h-11 items-center rounded-control border border-hairline px-4 text-sm font-semibold text-pitch">Trang trước</Link> : <span />}
          <p className="text-sm text-ink-secondary">Trang {summary.page} / {summary.pages} · {(summary.page-1)*summary.page_size+1}–{(summary.page-1)*summary.page_size+visible.length} / {matched} đơn</p>
          {summary.page < summary.pages ? <Link href={pageHref(summary.page+1)} scroll={false} className="inline-flex min-h-11 items-center rounded-control border border-hairline px-4 text-sm font-semibold text-pitch">Trang sau</Link> : <span />}
        </nav>}
      </>}

      <aside className="mt-8 rounded-card border border-hairline bg-sunk/50 p-5 sm:flex sm:items-start sm:gap-4">
        <Clock3 className="mb-3 shrink-0 text-pitch sm:mb-0" size={20} aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold text-pitch">Vì sao có đơn dù chưa chuyển cọc?</h2>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-ink-secondary">Mỗi lần xác nhận giữ chỗ thành công tạo một mã đơn cho một sân và khoảng giờ đã chọn. Bạn có {HOLD_MINUTES} phút để chuyển cọc. Chưa ghi nhận đủ cọc khi hết hạn, sân tự mở lại; đơn vẫn được lưu trong Lịch sử.</p>
          <p className="mt-2 text-xs leading-6 text-ink-secondary">Muốn trả cọc cho đơn đang giữ? Chọn <strong className="font-semibold text-pitch">Tiếp tục thanh toán</strong> để mở lại đúng mã đơn. Xem lại đơn không tạo đơn mới.</p>
        </div>
      </aside>
    </main>
  );
}
