export type VipPurchase = {
  id: string; code: string; user_id: string; amount: number;
  bank: string; account_number: string; account_name: string;
  status: 'awaiting_payment' | 'pending' | 'approved' | 'rejected';
  created_at: string; submitted_at: string | null; review_due_at: string | null;
  rejection_reason: string | null; period_end: string | null;
};
export type MyVip = { active: boolean; paid_until: string | null; purchases: VipPurchase[] };
export const VIP_STATUS = { awaiting_payment: 'Chờ chuyển khoản', pending: 'Chờ admin duyệt', approved: 'Đã duyệt', rejected: 'Chưa được duyệt' };
export function vipError(message: string) {
  const errors: Record<string, string> = {
    AUTH_REQUIRED: 'Bạn cần đăng nhập.', ACCOUNT_BANNED: 'Tài khoản đang bị khóa.',
    FORBIDDEN: 'Bạn không có quyền duyệt VIP.', VIP_PURCHASE_NOT_FOUND: 'Không tìm thấy yêu cầu VIP.',
    VIP_ALREADY_REVIEWED: 'Yêu cầu đã được xử lý hoặc chưa được gửi duyệt. Hãy tải lại trang.',
    VIP_TRANSACTION_REQUIRED: 'Nhập ID giao dịch SePay đã đối soát, chỉ gồm chữ số.',
    VIP_TRANSACTION_USED: 'Giao dịch này đã dùng để thanh toán. Hãy kiểm tra lại.',
    VIP_PAYMENT_REQUIRED: 'Chỉ cấp VIP sau khi duyệt thanh toán mua VIP.',
    INVALID_INPUT: 'Kiểm tra lại thông tin; lý do từ chối cần 5–500 ký tự.',
  };
  return Object.entries(errors).find(([code]) => message.includes(code))?.[1] ?? 'Chưa xử lý được yêu cầu VIP. Vui lòng thử lại.';
}
