export type BookingRefund = {
  code: string;
  customer_name: string | null;
  customer_phone: string;
  court_name: string | null;
  status: 'none' | 'needed' | 'done' | null;
  received: number;
  refunded: number;
  remaining: number;
  retained: number;
  local_now: string;
  legacy: boolean;
  can_record: boolean;
  records: { id: string; amount: number; reference: string; transferred_at: string; recorded_at: string; actor_name: string | null }[];
};

export function refundError(message: string): { status: number; error: string } {
  const errors: Record<string, [number, string]> = {
    FORBIDDEN: [403, 'Bạn không có quyền xử lý khoản hoàn này.'],
    BOOKING_NOT_FOUND: [404, 'Không tìm thấy đơn trong phạm vi tài khoản.'],
    INVALID_REFUND: [400, 'Kiểm tra số tiền, mã tham chiếu và thời gian chuyển hoàn theo giờ Việt Nam.'],
    REFUND_CONFLICT: [409, 'Mã tham chiếu hoặc yêu cầu này đã được dùng. Kiểm tra lịch sử trước khi ghi tiếp.'],
    LEGACY_REFUND_REVIEW: [409, 'Đơn đã đánh dấu hoàn từ trước khi có sổ chứng từ. Cần đối soát lịch sử riêng.'],
    REFUND_NOT_NEEDED: [409, 'Đơn không còn khoản hoàn đang chờ xử lý.'],
    REFUND_EXCEEDS_REMAINING: [409, 'Số tiền vượt khoản còn phải hoàn đã đối soát. Tải lại lịch sử trước khi ghi tiếp.'],
  };
  const match = Object.entries(errors).find(([code]) => message.includes(code));
  return match ? { status: match[1][0], error: match[1][1] } : { status: 503, error: 'Chưa xác nhận được kết quả lưu. Giữ thông tin và thử lại cùng yêu cầu sau khi kiểm tra lịch sử.' };
}
