import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { dayLabel, hhmm } from '@/lib/format';

export const dynamic = 'force-dynamic';

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
  booking: { code: string } | null;
};

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/thong-bao');

  const { data } = await supabase
    .from('notifications')
    .select('id, title, body, created_at, read_at, booking:bookings(code)')
    .order('created_at', { ascending: false });
  const notifications = (data ?? []) as unknown as NotificationRow[];

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 lg:px-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-pitch">Thông báo</h1>

      {notifications.length === 0 ? (
        <p className="mt-8 rounded-card border border-hairline p-10 text-center text-sm text-ink-secondary">
          Chưa có thông báo nào.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-2">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`rounded-card border p-4 ${notification.read_at ? 'border-hairline bg-card' : 'border-strong bg-free-fill'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold">{notification.title}</p>
                  {notification.body && <p className="mt-1 text-sm text-ink-secondary">{notification.body}</p>}
                  <p className="mt-2 text-xs text-ink-secondary">
                    {dayLabel(new Date(notification.created_at))} · {hhmm(notification.created_at)}
                  </p>
                </div>
                {!notification.read_at && (
                  <form action={`/api/notifications/${notification.id}/read`} method="post" className="flex-none">
                    <button type="submit" className="text-xs font-semibold text-pitch underline underline-offset-2">
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
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
