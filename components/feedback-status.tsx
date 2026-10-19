import { FEEDBACK_STATUSES, type Feedback } from '@/lib/feedback';

export function FeedbackStatus({ status }: { status: Feedback['status'] }) {
  return <span className={`inline-flex rounded-pill px-3 py-1 text-xs font-semibold ${status === 'new' || status === 'reviewing' ? 'bg-peak-fill text-peak-ink' : 'bg-sunk text-ink-secondary'}`}>{FEEDBACK_STATUSES[status]}</span>;
}