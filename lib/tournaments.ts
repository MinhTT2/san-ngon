import { z } from 'zod';
import type { Database } from './database.types';
export type Tournament = Database['public']['Tables']['tournaments']['Row'];
export type Registration = Database['public']['Tables']['tournament_registrations']['Row'];
export type TournamentPayment = Omit<Database['public']['Tables']['tournament_payment_events']['Row'], 'raw'>;
export const tournamentStatuses: Record<string, string> = { pending: 'Chờ admin duyệt', published: 'Đã công khai', rejected: 'Không được duyệt', cancelled: 'Đã hủy', completed: 'Đã kết thúc' };
export const registrationStatuses: Record<string, string> = { pending: 'Chờ duyệt', approved: 'Được tham gia', rejected: 'Không được duyệt', cancelled: 'Đã hủy', expired: 'Hết hạn' };
export const paymentOutcomes: Record<string, string> = { paid: 'Đã nhận đủ cọc', overpaid: 'Chuyển thừa', underpaid: 'Chuyển thiếu', duplicate_payment: 'Chuyển trùng', late_or_cancelled: 'Quá hạn / đăng ký đã hủy' };
export const sportSchema = z.enum(['football5', 'football7', 'football11', 'badminton', 'pickleball']);
const localTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
export const tournamentSchema = z.object({
  title: z.string().trim().min(3).max(150), description: z.string().trim().min(10).max(5000),
  sport: sportSchema, court_id: z.union([z.string().uuid(), z.literal('')]), address: z.string().trim().min(5).max(300),
  starts_at: localTime, ends_at: localTime, registration_deadline: localTime, payment_deadline: localTime, payment_hold_hours: z.coerce.number().int().min(1).max(72),
  capacity: z.coerce.number().int().min(2).max(1000), entry_fee: z.coerce.number().int().min(0).max(100000000),
  deposit_amount: z.coerce.number().int().min(0).max(100000000),
}).refine(d => d.deposit_amount <= d.entry_fee && d.ends_at > d.starts_at && d.registration_deadline <= d.payment_deadline && d.payment_deadline <= d.starts_at);
export const participantSchema = z.object({
  full_name: z.string().trim().min(2).max(100), phone: z.string().trim().min(10).max(25),
  address: z.string().trim().min(2).max(300), team_name: z.string().trim().max(100), note: z.string().trim().max(1000),
});
export function tournamentError(code: string) {
  const errors: Record<string, string> = {
    TERMS_REQUIRED: 'Nhập tiền thuê sân, nội dung thỏa thuận và xác nhận hai bên đã đồng ý.',
    TERMS_ALREADY_FIXED: 'Thỏa thuận đã được chốt, không thể ghi đè.',
    TOURNAMENT_NOT_EDITABLE: 'Chỉ sửa đề xuất đang chờ hoặc bị từ chối.',
    RECEIPT_REQUIRED: 'Nhập mã giao dịch hoặc ghi chú chứng từ (ít nhất 3 ký tự).',
    BALANCE_NOT_COLLECTIBLE: 'Chỉ ghi thu từ lúc giải bắt đầu, sau khi đã đủ cọc và chưa ghi thu/miễn trước đó.',
    BALANCE_ALREADY_RECORDED: 'Khoản này đã được xử lý hoặc không có tiền cần hoàn.',
    SETTLEMENT_CHANGED: 'Số dư đã đổi hoặc còn khoản thu/hoàn chưa xử lý. Tải lại và đối soát trước khi xác nhận.',
    TRANSFER_PENDING: 'Đang có khoản chuyển tiền chờ bên nhận xác nhận.',
    REFUND_CHANGED_OR_FORBIDDEN: 'Số tiền cần hoàn đã thay đổi hoặc bạn không có quyền. Tải lại trang và đối soát trước khi xác nhận.',
    FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.', AUTH_REQUIRED: 'Bạn cần đăng nhập.', ACCOUNT_BANNED: 'Tài khoản đang bị khóa.',
    TOURNAMENT_DATE_INVALID: 'Kiểm tra thời gian diễn ra, hạn đăng ký và trạng thái sân.', TOURNAMENT_NOT_PENDING: 'Giải này đã được xử lý.',
    COURT_REQUIRED: 'Chủ sân cần chọn sân của mình để công khai giải.',
    COURT_INVALID: 'Chọn sân đang hoạt động và đúng môn thi đấu.', SLOT_TAKEN: 'Khung giờ này đã có đơn đặt sân hoặc đã bị khóa.',
    RECEIVER_NOT_READY: 'Chủ sân chưa sẵn sàng nhận cọc qua SePay. Kiểm tra kết nối, phí dịch vụ và điều kiện mở nhận đơn.',
    REGISTRATION_CLOSED: 'Giải đã đóng đăng ký hoặc đã hủy.', TOURNAMENT_FULL: 'Giải đã đủ số người / đội được duyệt.',
    ALREADY_REGISTERED: 'Bạn đã gửi đăng ký cho giải này.', REGISTRATION_NOT_PENDING: 'Đăng ký này đã được xử lý.',
    TOURNAMENT_STARTED: 'Đã quá thời hạn được phép hủy. Liên hệ ban tổ chức để được hỗ trợ.', REVIEW_NOTE_REQUIRED: 'Nhập lý do không duyệt.',
  };
  return errors[code] ?? 'Thông tin chưa hợp lệ hoặc chưa lưu được. Vui lòng kiểm tra và thử lại.';
}

export type TournamentSettlement = {
  owner_id: string; manager_id: string; venue_fee: number | null; cancellation_venue_fee: number; effective_venue_fee: number | null;
  terms_note: string; due_at: string; bank_received: number; refund_due: number; balance_received: number;
  balance_refund_due: number; uncollected_count: number; transferred: number; pending_transfer: number;
  balance: number | null; can_settle: boolean;
};
