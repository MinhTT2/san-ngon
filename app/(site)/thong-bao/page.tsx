import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { dayLabel, hhmm } from '@/lib/format';
import { NotificationSearchParams } from '@/lib/search-params';

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

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 lg:px-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-pitch">Thông báo</h1>
      <p className="mt-3 text-sm leading-6 text-ink-secondary">Theo dõi đơn đặt sân, giải đấu và hồ sơ chủ sân của bạn.</p>
      <nav aria-label="Lọc thông báo" className="mt-6 flex gap-4 border-b border-hairline">
        {(['all', 'unread'] as const).map((value) => (
          <Link key={value} href={href(1, value)} aria-current={status === value ? 'page' : undefined}
            className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-2 text-sm font-semibold ${status === value ? 'border-pitch text-pitch' : 'border-transparent text-ink-secondary'}`}>
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
        <p className="mt-8 rounded-card border border-hairline p-10 text-center text-sm text-ink-secondary">
          {status === 'unread' ? 'Bạn đã đọc hết thông báo.' : 'Chưa có thông báo nào.'}
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-2">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`group rounded-card border p-4 ${notification.read_at ? 'border-hairline bg-card' : 'border-strong bg-free-fill'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <a
                  href={`/api/notifications/${notification.id}/open`}
                  className="min-w-0 flex-1 rounded-control outline-offset-4 focus-visible:outline-2 focus-visible:outline-pitch"
                  aria-label={`Mở thông báo: ${notification.title}`}
                >
                  <p className="font-semibold transition-colors group-hover:text-pitch">{notification.title}</p>
                  {notification.body && <p className="mt-1 text-sm text-ink-secondary">{notification.body}</p>}
                  <p className="mt-2 text-xs text-ink-secondary">
                    {dayLabel(new Date(notification.created_at))} · {hhmm(notification.created_at)}
                  </p>
                </a>
                {!notification.read_at && (
                  <form action={`/api/notifications/${notification.id}/read`} method="post" className="flex-none">
                    <input type="hidden" name="page" value={page} />
                    <input type="hidden" name="status" value={status} />
                    <button type="submit" className="min-h-11 text-xs font-semibold text-pitch underline underline-offset-2">
                      Đã đọc
                    </button>
                  </form>
                )}
              </div>
              {notification.booking?.code && (
                <Link href={`/dat-san/${notification.booking.code}`} className="mt-3 inline-block text-xs font-semibold text-pitch underline underline-offset-2">
                  Xem đơn {notification.booking.code}
                </Link>
              )}
              {notification.tournament_id && (
                <Link href={`/giai-dau/${notification.tournament_id}`} className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold text-pitch underline underline-offset-2">Xem giải đấu</Link>
              )}
            </li>
          ))}
        </ul>
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
