import Link from 'next/link';
import { ArrowUpRight, Paperclip } from 'lucide-react';
import { FEEDBACK_CATEGORIES } from '@/lib/feedback';
import type { AdminFeedbackSummary } from '@/lib/admin-feedback';
import { hhmm, ymd } from '@/lib/format';
import { FeedbackStatus } from './feedback-status';

export function AdminFeedbackList({ rows, returnTo }: { rows: AdminFeedbackSummary[]; returnTo: string }) {
  return <div className="overflow-hidden rounded-card border border-hairline bg-card">
    <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_140px_140px_120px_24px] items-center gap-4 border-b border-hairline bg-page px-5 py-3 text-xs font-semibold text-ink-secondary xl:grid">
      <span>Yêu cầu / Người gửi</span><span>Loại</span><span>Trạng thái</span><span>Ngày gửi</span><span />
    </div>
    <ul className="divide-y divide-hairline">{rows.map(row => {
      const date = ymd(new Date(row.created_at));
      return <li key={row.id}>
        <Link href={`/admin/gop-y/${row.id}?${new URLSearchParams({ back: returnTo })}`} className="grid min-w-0 gap-3 px-4 py-4 hover:bg-free-fill focus-visible:bg-free-fill focus-visible:outline-offset-[-3px] sm:px-5 xl:grid-cols-[minmax(0,1fr)_140px_140px_120px_24px] xl:items-center xl:gap-4">
          <div className="min-w-0"><h3 className="line-clamp-2 break-words text-sm font-semibold leading-6 text-pitch">{row.title}</h3><p className="mt-1 truncate text-xs text-ink-secondary">{row.sender?.full_name || 'Chưa đặt tên'}</p></div>
          <span className="flex flex-wrap items-center gap-2 text-xs text-ink-secondary">{FEEDBACK_CATEGORIES[row.category]}{row.receipt_path && <span aria-label="Có chứng từ"><Paperclip size={14} aria-hidden="true" /></span>}</span>
          <div className="flex flex-wrap items-center justify-between gap-2 xl:contents">
            <span><FeedbackStatus status={row.status} /></span>
            <time dateTime={row.created_at} className="text-xs leading-5 text-ink-secondary">{date.slice(8, 10)}/{date.slice(5, 7)}/{date.slice(0, 4)}<span className="ml-2 xl:ml-0 xl:block">{hhmm(row.created_at)}</span></time>
          </div>
          <ArrowUpRight size={17} aria-hidden="true" className="hidden text-pitch xl:block" />
          <span className="sr-only">Mở chi tiết</span>
        </Link>
      </li>;
    })}</ul>
  </div>;
}
