import { z } from 'zod';
import { safeNext } from './safe-next';

export const FEEDBACK_CATEGORIES = { bug: 'Báo lỗi', idea: 'Đề xuất cải thiện', support: 'Cần hỗ trợ' } as const;
export const FEEDBACK_STATUSES = { new: 'Đã tiếp nhận', reviewing: 'Đang xử lý', resolved: 'Đã giải quyết', closed: 'Đã đóng' } as const;
export const feedbackSearchParams = z.object({
  page: z.coerce.number().int().min(1).max(100000).catch(1),
  status: z.enum(['all','open','done']).catch('all'),
  trang: z.string().max(300).optional().catch(undefined),
});
export const feedbackSchema = z.object({
  id: z.string().uuid(), category: z.enum(['bug', 'idea', 'support']),
  title: z.string().trim().min(5).max(120), message: z.string().trim().min(20).max(3000),
  page_path: z.string().max(300).refine(value => safeNext(value) === value && !/[?#]/.test(value)).nullable().default(null),
});
export const feedbackReviewSchema = z.object({
  id: z.string().uuid(), status: z.enum(['new', 'reviewing', 'resolved', 'closed']),
  reply: z.string().trim().max(2000), updated_at: z.string().datetime({ offset: true }),
}).refine(data => !['resolved', 'closed'].includes(data.status) || data.reply.length >= 5);
export type Feedback = {
  id: string; category: keyof typeof FEEDBACK_CATEGORIES; title: string; message: string;
  booking_id?: string | null; receipt_path?: string | null;
  page_path: string | null; status: keyof typeof FEEDBACK_STATUSES; reply: string;
  created_at: string; updated_at: string;
};
export const feedbackErrors: Record<string, string> = {
  FEEDBACK_LIMIT: 'Bạn đã gửi đủ số góp ý cho phép. Hãy chờ xử lý các yêu cầu hiện có hoặc thử lại sau 24 giờ.',
  FEEDBACK_STALE: 'Góp ý vừa được cập nhật ở nơi khác. Tải lại trang để xem nội dung mới nhất.',
  FEEDBACK_CONFLICT: 'Nội dung lần gửi trước chưa khớp. Kiểm tra lịch sử trước khi gửi góp ý mới.',
  FORBIDDEN: 'Tài khoản không có quyền thực hiện thao tác này.',
};
