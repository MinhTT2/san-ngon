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

/** Mã liên kết Telegram chỉ sống đủ lâu để chủ sân bấm Start. */
export const TELEGRAM_LINK_MINUTES = 10;

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

/** Lỗi từ cancel_booking. */
export const CANCEL_ERRORS: Record<string, string> = {
  AUTH_REQUIRED: 'Bạn cần đăng nhập.',
  BOOKING_NOT_FOUND: 'Không tìm thấy đơn này.',
  NOT_CANCELLABLE: 'Đơn này không hủy được nữa.',
};

/** Lỗi từ register_venue. */
export const VENUE_ERRORS: Record<string, string> = {
  AUTH_REQUIRED: 'Bạn cần đăng nhập để đăng sân.',
  NAME_REQUIRED: 'Nhập tên cụm sân.',
  ADDRESS_REQUIRED: 'Nhập địa chỉ sân.',
  PHONE_REQUIRED: 'Nhập số điện thoại để khách liên hệ.',
  COURT_COUNT_RANGE: 'Số sân con phải từ 1 đến 20.',
  PRICE_REQUIRED: 'Nhập giá thuê một giờ.',
  SPORT_REQUIRED: 'Chọn ít nhất một môn thể thao.',
  SPORT_DUPLICATE: 'Mỗi môn thể thao chỉ chọn một lần.',
  SPORT_CONFIG_INVALID: 'Kiểm tra lại số sân và giá của từng môn.',
  INVALID_HOURS: 'Giờ đóng cửa phải sau giờ mở cửa.',
  VENUE_EXISTS: 'Tài khoản này đã đăng một cụm sân rồi.',
  SLUG_COLLISION: 'Tên sân bị trùng quá nhiều. Đổi tên khác giúp bạn nhé.',
};

/** Dò mã lỗi Postgres trong chuỗi message rồi đổi sang câu tiếng Việt. */
function translate(table: Record<string, string>, raw: string | undefined, fallback: string) {
  if (!raw) return fallback;
  const key = Object.keys(table).find((k) => raw.includes(k));
  return key ? table[key] : fallback;
}

export function cancelErrorMessage(raw?: string) {
  return translate(CANCEL_ERRORS, raw, 'Không hủy được đơn. Thử lại sau vài giây.');
}

export function venueErrorMessage(raw?: string) {
  return translate(VENUE_ERRORS, raw, 'Không gửi được hồ sơ. Thử lại sau vài giây.');
}

export function bookingErrorMessage(raw?: string) {
  return translate(BOOKING_ERRORS, raw, 'Không đặt được sân. Thử lại sau vài giây.');
}

export const VENUE_STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  active: 'Đang nhận đặt',
  rejected: 'Bị từ chối',
};

/** Quận/huyện nội thành, dùng cho ô chọn ở /dang-ky-san và bộ lọc /tim-san. */
export const DISTRICTS = [
  'Ba Đình', 'Hoàn Kiếm', 'Tây Hồ', 'Long Biên', 'Cầu Giấy', 'Đống Đa',
  'Hai Bà Trưng', 'Hoàng Mai', 'Thanh Xuân', 'Nam Từ Liêm', 'Bắc Từ Liêm',
  'Hà Đông', 'Thanh Trì', 'Gia Lâm', 'Đông Anh', 'Hoài Đức',
];
