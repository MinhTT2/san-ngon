import { z } from 'zod';
import type { Feedback } from './feedback';

export type AdminFeedback = Feedback & { sender: { full_name: string | null } | null };
export type AdminFeedbackSummary = Pick<AdminFeedback, 'id' | 'category' | 'title' | 'status' | 'created_at' | 'receipt_path' | 'sender'>;

export const ADMIN_FEEDBACK_PAGE_SIZE = 20;
export const adminFeedbackSearchParams = z.object({
  q: z.string().trim().max(100).catch(''),
  status: z.enum(['open', 'all', 'done', 'new', 'reviewing', 'resolved', 'closed']).catch('open'),
  category: z.enum(['all', 'bug', 'idea', 'support']).catch('all'),
  sort: z.enum(['oldest', 'newest']).catch('oldest'),
  page: z.coerce.number().int().min(1).max(100000).catch(1),
});
export type AdminFeedbackFilters = z.infer<typeof adminFeedbackSearchParams>;

export function adminFeedbackHref(filters: AdminFeedbackFilters, changes: Partial<AdminFeedbackFilters> = {}) {
  return `/admin/gop-y?${new URLSearchParams(Object.entries({ ...filters, ...changes }).map(([key, value]) => [key, String(value)]))}`;
}

/** Quote PostgREST syntax and escape regex operators so search input stays literal. */
export function feedbackTextFilter(query: string) {
  const pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const quoted = JSON.stringify(pattern);
  return `title.imatch.${quoted},message.imatch.${quoted}`;
}

/** Detail pages may only return to this queue, with validated filters. */
export function feedbackReturnHref(raw?: unknown) {
  if (typeof raw !== 'string' || !raw.startsWith('/admin/gop-y?')) return '/admin/gop-y';
  const url = new URL(raw, 'https://local.invalid');
  if (url.pathname !== '/admin/gop-y') return '/admin/gop-y';
  return adminFeedbackHref(adminFeedbackSearchParams.parse(Object.fromEntries(url.searchParams)));
}
