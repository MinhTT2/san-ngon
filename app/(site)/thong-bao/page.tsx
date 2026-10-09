import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { dayLabel, hhmm, ymd } from '@/lib/format';
import { NotificationSearchParams } from '@/lib/search-params';
import { ArrowUpRight, Bell, BellCheck, CalendarCheck2, Trophy } from 'lucide-react';
import { NavigationMarker } from '@/components/navigation-marker';
import { NotificationReadButton } from '@/components/notification-read-button';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Thông báo · Sân Ngon', robots: { index: false, follow: false } };
const PAGE_SIZE = 20;

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
  tournament_id: string | null;
  booking: { code: string } | { code: string }[] | null;
};

export default async function Page({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { status, page } = NotificationSearchParams.parse(await searchParams);
  const href = (targetPage: number, targetStatus = status) => `/thong-bao?${new URLSearchParams({ status: targetStatus, page: String(targetPage) })}`;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/dang-nhap?next=${encodeURIComponent(href(page))}`);

  let query = supabase
    .from('notifications')
    .select('id, title, body, created_at, read_at, tournament_id, booking:bookings(code)', { count: 'exact' })
    .eq('user_id', user.id);
  if (status === 'unread') query = query.is('read_at', null);
  const [{ data, count, error }, unread] = await Promise.all([
    query.order('created_at', { ascending: false }).order('id', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).is('read_at', null),
  ]);
  // PostgREST returns 416 when a read/removed item makes this page disappear.
  if (error?.code === 'PGRST103' && page > 1 && !unread.error) redirect(href(1));
  const failed = !!error || !!unread.error;
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  if (!failed && page > pages) redirect(href(pages));
  const notifications = ((data ?? []) as unknown as NotificationRow[]).map((notification) => ({
    ...notification,
    booking: Array.isArray(notification.booking) ? notification.booking[0] ?? null : notification.booking,
  }));
  const groups = Map.groupBy(notifications, notification => ymd(new Date(notification.created_at)));

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 lg:px-10 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-hairline pb-7">
      <div><p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-secondary">Hộp thư của bạn</p>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-pitch sm:text-4xl">Thông báo</h1>
      <p className="mt-3 text-sm leading-6 text-ink-secondary">Theo dõi đơn đặt sân, giải đấu và hồ sơ chủ sân của bạn.</p>
      </div>{!failed && <p className="flex items-center gap-2 text-xs font-medium text-pitch"><Bell className="size-4" aria-hidden="true" />{unread.count ? `${unread.count} thông báo chưa đọc` : 'Bạn đã đọc hết thông báo'}</p>}
      </header>
      <nav aria-label="Lọc thông báo" className="pf-tab-rail relative isolate mt-5 flex gap-4 border-b border-hairline">
        <NavigationMarker activeKey={status} variant="underline" />
        {(['all', 'unread'] as const).map((value) => (
          <Link key={value} href={href(1, value)} aria-current={status === value ? 'page' : undefined}
            className={`pf-tab-link relative z-10 inline-flex min-h-12 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${status === value ? 'border-pitch text-pitch' : 'border-transparent text-ink-secondary'}`}>
            {value === 'all' ? 'Tất cả' : 'Chưa đọc'}
            {value === 'unread' && !failed && <span className="rounded-pill bg-sunk px-2 py-0.5 text-xs tabular-nums">{unread.count ?? 0}</span>}
          </Link>
        ))}
      </nav>

      {failed ? (
        <div role="alert" className="mt-8 rounded-card border border-hairline p-6">
          <p className="font-semibold text-danger">Chưa tải được thông báo.</p>
          <p className="mt-2 text-sm text-ink-secondary">Kiểm tra kết nối và thử lại để xem thông tin mới nhất.</p>
          <a href={href(page)} className="mt-4 inline-flex min-h-11 items-center rounded-control border border-pitch px-4 text-sm font-semibold text-pitch">Thử lại</a>
        </div>
      ) : notifications.length === 0 ? (
        <section className="mt-8 rounded-card border border-hairline bg-card px-5 py-12 text-center">
          <BellCheck className="mx-auto size-9 text-pitch" strokeWidth={1.4} aria-hidden="true" />
          <h2 className="mt-4 font-display text-xl font-bold text-pitch">{status === 'unread' ? 'Bạn đã đọc hết thông báo.' : 'Chưa có thông báo nào.'}</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-ink-secondary">{status === 'unread' ? 'Các cập nhật mới sẽ xuất hiện ở đây. Bạn vẫn có thể xem lại những thông báo đã đọc.' : 'Khi có cập nhật về đơn đặt sân, giải đấu hoặc hồ sơ chủ sân, bạn sẽ nhận thông báo tại đây.'}</p>
          <Link href={status === 'unread' ? href(1, 'all') : '/tim-san'} className="pf-action mt-5 inline-flex min-h-11 items-center gap-2 rounded-control border border-strong px-4 text-sm font-semibold text-pitch">{status === 'unread' ? 'Xem tất cả thông báo' : 'Tìm sân để chơi'}<ArrowUpRight className="pf-arrow size-4" aria-hidden="true" /></Link>
        </section>
      ) : (
        <div className="mt-7 space-y-7">
        {[...groups].map(([date, items]) => <section key={date} aria-label={`Thông báo ngày ${date}`}>
          <h2 className="mb-3 flex items-center gap-3 text-xs font-semibold text-ink-secondary"><time dateTime={date}>{dayLabel(new Date(items[0].created_at))} / {date.slice(0, 4)}</time><span className="h-px flex-1 bg-hairline" aria-hidden="true" /><span>{items.length} thông báo</span></h2>
          <ul className="overflow-hidden rounded-card border border-hairline bg-card divide-y divide-hairline">
          {items.map((notification) => {
            const Icon = notification.tournament_id ? Trophy : notification.booking ? CalendarCheck2 : Bell;
            return (
            <li
              key={notification.id}
              data-motion-item data-notification-id={notification.id}
              className={`group p-4 sm:p-5 ${notification.read_at ? 'bg-card' : 'bg-free-fill'}`}
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <span className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-control border ${notification.read_at ? 'border-hairline text-ink-secondary' : 'border-free-line bg-card text-pitch'}`}><Icon className="size-5" strokeWidth={1.6} aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                <a
                  href={`/api/notifications/${notification.id}/open`}
                  className="min-w-0 flex-1 rounded-control outline-offset-4 focus-visible:outline-2 focus-visible:outline-pitch"
                  aria-label={`Mở thông báo: ${notification.title}`}
                >
                  <p className="break-words text-sm font-semibold leading-6 transition-colors group-hover:text-pitch">{notification.title}</p>
                  {notification.body && <p className="mt-1 break-words text-sm leading-7 text-ink-secondary">{notification.body}</p>}
                </a>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-secondary"><time dateTime={notification.created_at}>{hhmm(notification.created_at)}</time>{!notification.read_at && <span className="inline-flex items-center gap-1.5 font-semibold text-pitch"><span className="size-1.5 rounded-full bg-pitch" aria-hidden="true" />Chưa đọc</span>}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <div className="flex min-w-0 flex-wrap gap-3">
                    {notification.booking?.code && <Link href={`/dat-san/${notification.booking.code}`} className="pf-action inline-flex min-h-11 items-center gap-1.5 break-all text-xs font-semibold text-pitch">Xem đơn {notification.booking.code}<ArrowUpRight className="pf-arrow size-3.5 shrink-0" aria-hidden="true" /></Link>}
                    {notification.tournament_id && <Link href={`/giai-dau/${notification.tournament_id}`} className="pf-action inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-pitch">Xem giải đấu<ArrowUpRight className="pf-arrow size-3.5" aria-hidden="true" /></Link>}
                  </div>
                {!notification.read_at && (
                  <form action={`/api/notifications/${notification.id}/read`} method="post" className="min-w-0">
                    <input type="hidden" name="page" value={page} />
                    <input type="hidden" name="status" value={status} />
                    <NotificationReadButton id={notification.id} title={notification.title} />
                  </form>
                )}
              </div>
              </div></div>
            </li>
          ); })}
        </ul>
        </section>)}
        </div>
      )}
      {!failed && pages > 1 && (
        <nav aria-label="Phân trang thông báo" className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm">
          {page > 1 && <Link href={href(page - 1)} className="inline-flex min-h-11 items-center rounded-control border border-hairline px-4 font-semibold text-pitch">Trang trước</Link>}
          <span className="text-ink-secondary">Trang {page} / {pages}</span>
          {page < pages && <Link href={href(page + 1)} className="inline-flex min-h-11 items-center rounded-control border border-hairline px-4 font-semibold text-pitch">Trang sau</Link>}
        </nav>
      )}
    </main>
  );
}
