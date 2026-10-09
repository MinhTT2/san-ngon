'use client';

import { useEffect, useId, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient, subscribeWithSession } from '@/lib/supabase/client';
import { Bell, X } from 'lucide-react';
import { NotificationReadButton } from './notification-read-button';

type Notification = {
  id: string;
  title: string;
  body: string | null;
  read_at: string | null;
  booking_id: string | null;
  tournament_id: string | null;
  timeLabel: string;
};

/** Popover native hỗ trợ Escape, bấm bên ngoài và thứ tự focus bàn phím. */
export function NotificationPopover({ notifications, unreadCount, loadError }: {
  notifications: Notification[];
  unreadCount: number;
  loadError: boolean;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const close = () => { panel.current?.hidePopover(); trigger.current?.focus(); };
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !panel.current?.matches(':popover-open')) return;
      event.preventDefault(); event.stopPropagation();
      panel.current.hidePopover(); trigger.current?.focus();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, []);

  useEffect(() => {
    const db = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => router.refresh(), 150); };
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    const channel = db.channel('inbox-updates').on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, refresh);
    const stop = subscribeWithSession(db, channel, status => { if (status === 'SUBSCRIBED') refresh(); });
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => { stop(); clearTimeout(refreshTimer); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', visible); };
  }, [router]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        popoverTarget={id}
        onClick={() => router.refresh()}
        aria-label={unreadCount ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
        className="pf-action relative flex size-11 items-center justify-center rounded-control border border-hairline text-ink transition-colors hover:bg-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"
      >
        <Bell size={20} strokeWidth={1.8} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex min-w-4 translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-pill bg-pitch px-1 text-[10px] font-semibold leading-4 text-pitch-ink">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <div
        ref={panel}
        id={id}
        popover="auto"
        role="region"
        aria-labelledby={`${id}-title`}
        className="pf-popover fixed inset-auto right-4 top-20 m-0 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-[18px] border border-strong bg-card text-ink lg:right-[max(4rem,calc((100vw-1152px)/2))]"
      >
        <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
          <div>
            <h2 id={`${id}-title`} className="font-display text-lg font-bold text-pitch">Thông báo</h2>
            <p className="mt-1 text-xs text-ink-secondary">{unreadCount ? `${unreadCount} thông báo chưa đọc` : 'Bạn đã đọc hết thông báo'}</p>
          </div>
          <button type="button" popoverTarget={id} popoverTargetAction="hide" onClick={close} aria-label="Đóng thông báo" className="flex size-11 items-center justify-center rounded-control hover:bg-sunk">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[min(26rem,calc(100dvh-16rem))] overflow-y-auto overscroll-contain">
          {loadError ? (
            <div className="p-6"><p role="alert" className="text-sm leading-6 text-danger">Chưa tải được thông báo.</p><button type="button" onClick={() => router.refresh()} className="pf-action mt-3 min-h-11 rounded-control border border-hairline px-4 text-xs font-semibold text-pitch">Thử lại</button></div>
          ) : notifications.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Bell className="mx-auto mb-4 text-free-line" size={32} aria-hidden="true" />
              <p className="text-sm font-semibold">Chưa có thông báo nào</p>
              <p className="mt-2 text-xs leading-5 text-ink-secondary">Thông tin về đơn đặt sân và giải đấu sẽ xuất hiện ở đây.</p>
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {notifications.map((notification) => (
                <li key={notification.id} className={`px-5 py-4 ${notification.read_at ? '' : 'bg-free-fill'}`}>
                  <div className="flex items-start gap-3">
                    {!notification.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-pitch" aria-label="Chưa đọc" />}
                    <div className="min-w-0 flex-1">
                      {notification.booking_id || notification.tournament_id ? (
                        // Route mở đơn có cập nhật read_at, không prefetch link này.
                        <a href={`/api/notifications/${notification.id}/open`} className="block rounded-control outline-offset-4 focus-visible:outline-2 focus-visible:outline-pitch">
                          <p className="break-words text-sm font-semibold">{notification.title}</p>
                          {notification.body && <p className="mt-1 break-words text-sm leading-6 text-ink-secondary">{notification.body}</p>}
                        </a>
                      ) : (
                        <>
                          <p className="break-words text-sm font-semibold">{notification.title}</p>
                          {notification.body && <p className="mt-1 break-words text-sm leading-6 text-ink-secondary">{notification.body}</p>}
                        </>
                      )}
                      <p className="mt-2 text-xs text-ink-secondary">{notification.timeLabel}</p>
                      {!notification.read_at && (
                        <NotificationReadButton id={notification.id} title={notification.title} />
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link href="/thong-bao" onClick={() => panel.current?.hidePopover()} className="pf-action flex min-h-12 items-center justify-center border-t border-hairline text-sm font-semibold text-pitch hover:bg-free-fill">
          Xem tất cả thông báo <span aria-hidden="true" className="pf-arrow ml-2">↗</span>
        </Link>
      </div>
    </>
  );
}
