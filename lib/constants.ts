/** Hằng số nghiệp vụ. Mọi con số dùng ở nhiều chỗ đều nằm đây. */

export const TZ = 'Asia/Ho_Chi_Minh';

/** Giữ chỗ bao lâu để người chơi kịp chuyển khoản. Khớp với bookings.expires_at. */
export const HOLD_MINUTES = 15;

/** Số khung giờ liền nhau tối đa cho một lần đặt. */
export const MAX_SLOTS = 3;

/** Số đơn chờ thanh toán tối đa mỗi tài khoản. Khớp với create_booking. */
export const MAX_PENDING = 2;

/**
 * Thời hạn báo hủy để được hoàn cọc, tính bằng giờ.
 * TODO ngày 18/09: hỏi ba chủ sân rồi chốt. 2 tiếng chỉ là chỗ giữ tạm.
 */
export const CANCEL_WINDOW_HOURS = 2;

/** Khung giờ vàng, dùng để tô màu ô trong lưới. Giá thật do price_rules quyết định. */
export const PEAK_FROM_HOUR = 16;
export const PEAK_TO_HOUR = 21;

export const SPORT_LABELS: Record<string, string> = {
  football5: 'Bóng đá 5 người',
  football7: 'Bóng đá 7 người',
  football11: 'Bóng đá 11 người',
  badminton: 'Cầu lông',
  pickleball: 'Pickleball',
  tennis: 'Tennis',
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ chuyển khoản',
  confirmed: 'Đã xác nhận',
  completed: 'Đã đá xong',
  cancelled: 'Đã hủy',
  no_show: 'Không tới',
};

/** Lỗi từ create_booking, dịch sang câu người dùng đọc được. */
export const BOOKING_ERRORS: Record<string, string> = {
  AUTH_REQUIRED: 'Bạn cần đăng nhập để đặt sân.',
  SLOT_TAKEN: 'Khung giờ này vừa có người đặt. Chọn giờ khác giúp bạn nhé.',
  SLOT_IN_PAST: 'Khung giờ đã qua rồi.',
  INVALID_RANGE: 'Khoảng thời gian không hợp lệ.',
  PHONE_REQUIRED: 'Nhập số điện thoại để chủ sân liên hệ.',
  COURT_NOT_FOUND: 'Sân này đang tạm ngừng nhận đặt.',
  NO_PRICE_RULE: 'Sân chưa có bảng giá cho khung giờ này.',
  TOO_FAR_AHEAD: 'Sân chỉ nhận đặt trước trong vòng 30 ngày.',
  TOO_MANY_PENDING: `Bạn đang có ${MAX_PENDING} đơn chờ chuyển khoản. Thanh toán hoặc hủy bớt rồi đặt tiếp.`,
  CODE_COLLISION: 'Hệ thống đang bận. Thử lại sau vài giây.',
};

export function bookingErrorMessage(raw?: string) {
  if (!raw) return 'Không đặt được sân. Thử lại sau vài giây.';
  const key = Object.keys(BOOKING_ERRORS).find((k) => raw.includes(k));
  return key ? BOOKING_ERRORS[key] : 'Không đặt được sân. Thử lại sau vài giây.';
}
