import Link from 'next/link';
import { FEEDBACK_CATEGORIES, FEEDBACK_STATUSES, type Feedback } from '@/lib/feedback';
import { dayLabel, hhmm, ymd } from '@/lib/format';
import { FeedbackReviewForm } from './feedback-review-form';
import { safeNext } from '@/lib/safe-next';

export function FeedbackList({ rows, admin = false }: { rows: (Feedback & { sender?: { full_name: string | null } | null })[]; admin?: boolean }) {
  if (!rows.length) return <p className="rounded-card border border-hairline bg-card p-7 text-sm text-ink-secondary">Chưa có góp ý trong danh sách này.</p>;
  return <div className="space-y-4">{rows.map(row => <article id={`gop-y-${row.id}`} key={row.id} className="scroll-mt-6 rounded-card border border-hairline bg-card p-5 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-ink-secondary">{FEEDBACK_CATEGORIES[row.category]} · {dayLabel(new Date(row.created_at))}/{ymd(new Date(row.created_at)).slice(0, 4)} · {hhmm(row.created_at)}</p><span className={`rounded-pill px-3 py-1 text-xs font-semibold ${row.status === 'new' || row.status === 'reviewing' ? 'bg-peak-fill text-peak-ink' : 'bg-sunk text-ink-secondary'}`}>{FEEDBACK_STATUSES[row.status]}</span></div>
    <h3 className="mt-3 break-words font-display text-xl font-bold text-pitch">{row.title}</h3>
    {admin && <p className="mt-2 text-xs text-ink-secondary">Người gửi: {row.sender?.full_name || 'Chưa đặt tên'}</p>}
    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{row.message}</p>
    {row.page_path && safeNext(row.page_path) === row.page_path && <Link href={row.page_path} className="mt-3 inline-flex min-h-11 items-center break-all text-sm font-semibold text-pitch underline">Mở trang liên quan</Link>}
    {!admin && row.reply && <div className="mt-4 rounded-control bg-free-fill p-4"><p className="text-sm font-semibold text-pitch">Phản hồi từ Sân Ngon</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{row.reply}</p></div>}
    {admin && <FeedbackReviewForm key={row.updated_at} feedback={row} />}
  </article>)}</div>;
}
