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

/** Lỗi từ create_venue. */
export const VENUE_ERRORS: Record<string, string> = {
  AUTH_REQUIRED: 'Bạn cần đăng nhập để đăng sân.',
  OWNER_NOT_APPROVED: 'Tài khoản chủ sân chưa được duyệt.',
  NAME_REQUIRED: 'Nhập tên cụm sân.',
  ADDRESS_REQUIRED: 'Nhập địa chỉ sân.',
  PHONE_REQUIRED: 'Nhập số điện thoại để khách liên hệ.',
  PHONE_INVALID: 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.',
  COURT_COUNT_RANGE: 'Số sân con phải từ 1 đến 20.',
  PRICE_REQUIRED: 'Nhập giá thuê một giờ.',
  SPORT_REQUIRED: 'Chọn ít nhất một môn thể thao.',
  SPORT_DUPLICATE: 'Mỗi môn thể thao chỉ chọn một lần.',
  SPORT_CONFIG_INVALID: 'Kiểm tra lại số sân và giá của từng môn.',
  INVALID_HOURS: 'Giờ đóng cửa phải sau giờ mở cửa.',
  BUSINESS_LICENSE_REQUIRED: 'Bạn cần tải lên giấy tờ kinh doanh.',
  BUSINESS_LICENSE_INVALID: 'Giấy tờ kinh doanh không hợp lệ.',
  BUSINESS_LICENSE_MISSING: 'Không tìm thấy giấy tờ kinh doanh đã tải lên.',
  PAYOUT_REQUIRED: 'Bạn cần nhập tài khoản nhận tiền để nhận tiền cọc.',
  PAYOUT_INVALID: 'Số tài khoản phải gồm 6 đến 30 chữ số.',
  SLUG_COLLISION: 'Tên sân bị trùng quá nhiều. Đổi tên khác giúp bạn nhé.',
  VENUE_NOT_FOUND: 'Không tìm thấy cụm sân.',
  VENUE_HAS_BOOKINGS: 'Không thể xóa cụm sân đã có đơn đặt. Hãy tắt sân trước.',
  VENUE_NOT_EDITABLE: 'Cụm sân này đang bị từ chối và chưa thể chỉnh sửa.',
  NAME_TOO_LONG: 'Tên cụm sân không quá 120 ký tự.',
  ADDRESS_TOO_LONG: 'Địa chỉ không quá 200 ký tự.',
  DISTRICT_REQUIRED: 'Chọn quận/huyện của cụm sân.',
  DEPOSIT_INVALID: 'Tỷ lệ cọc phải từ 0 đến 100%.',
  HORIZON_INVALID: 'Thời hạn đặt trước phải từ 1 đến 180 ngày.',
};

export const COURT_ERRORS: Record<string, string> = {
  AUTH_REQUIRED: 'Bạn cần đăng nhập để quản lý sân.',
  VENUE_NOT_FOUND: 'Không tìm thấy cụm sân.',
  COURT_NOT_FOUND: 'Không tìm thấy sân con.',
  VENUE_NOT_EDITABLE: 'Cụm sân này đang bị từ chối và chưa thể chỉnh sửa.',
  COURT_NAME_REQUIRED: 'Nhập tên sân con.',
  COURT_NAME_TOO_LONG: 'Tên sân con không quá 80 ký tự.',
  COURT_NAME_EXISTS: 'Tên sân con đã tồn tại trong cụm sân.',
  SLOT_MINUTES_INVALID: 'Thời lượng khung phải là 30, 60, 90 hoặc 120 phút.',
  PRICE_INVALID: 'Giá thuê phải từ 1.000 đến 10.000.000 đồng/giờ.',
  COURT_HOURS_PAIR_REQUIRED: 'Giờ mở và đóng của sân con phải nhập cùng nhau.',
  COURT_HOURS_OUTSIDE_VENUE: 'Giờ sân con phải nằm trong giờ mở cửa cụm sân.',
  INVALID_HOURS: 'Giờ đóng cửa phải sau giờ mở cửa.',
  COURT_HAS_BOOKINGS: 'Không thể xóa sân đã có đơn đặt. Hãy tắt sân trước.',
};

export const OWNER_ERRORS: Record<string, string> = {
  AUTH_REQUIRED: 'Bạn cần đăng nhập để đăng ký chủ sân.',
  REPRESENTATIVE_REQUIRED: 'Nhập họ tên người đại diện hợp lệ.',
  PHONE_INVALID: 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.',
  BUSINESS_LICENSE_REQUIRED: 'Bạn cần tải lên giấy tờ kinh doanh.',
  BUSINESS_LICENSE_INVALID: 'Giấy tờ kinh doanh không hợp lệ.',
  BUSINESS_LICENSE_MISSING: 'Không tìm thấy giấy tờ kinh doanh đã tải lên.',
  PAYOUT_REQUIRED: 'Bạn cần nhập tài khoản nhận tiền để nhận tiền cọc.',
  PAYOUT_INVALID: 'Số tài khoản phải gồm 6 đến 30 chữ số.',
  OWNER_APPLICATION_EXISTS: 'Hồ sơ chủ sân của bạn đang chờ duyệt.',
  OWNER_ALREADY_APPROVED: 'Tài khoản của bạn đã được duyệt chủ sân.',
  PROFILE_REQUIRED: 'Không tìm thấy hồ sơ tài khoản.',
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

export function courtErrorMessage(raw?: string) {
  return translate(COURT_ERRORS, raw, 'Không lưu được sân con. Thử lại sau vài giây.');
}

export function ownerErrorMessage(raw?: string) {
  return translate(OWNER_ERRORS, raw, 'Không gửi được hồ sơ chủ sân. Thử lại sau vài giây.');
}

export function bookingErrorMessage(raw?: string) {
  return translate(BOOKING_ERRORS, raw, 'Không đặt được sân. Thử lại sau vài giây.');
}

export const ROLE_LABELS: Record<string, string> = {
  player: 'Người chơi',
  owner: 'Chủ sân',
  admin: 'Quản trị',
};

/** Lỗi từ các hàm admin_*. */
export const ADMIN_ERRORS: Record<string, string> = {
  NOT_ADMIN: 'Bạn không có quyền quản trị.',
  USER_NOT_FOUND: 'Không tìm thấy tài khoản này.',
  ROLE_INVALID: 'Vai trò không hợp lệ.',
  LAST_ADMIN: 'Đây là quản trị viên cuối cùng. Cấp quyền cho người khác trước đã.',
  CANNOT_BAN_SELF: 'Không tự khoá tài khoản của mình được.',
  CANNOT_DELETE_SELF: 'Không tự xoá tài khoản của mình được.',
  REASON_REQUIRED: 'Nhập lý do khoá để còn tra lại về sau.',
  HAS_BOOKINGS: 'Tài khoản này đã có đơn đặt sân nên không xoá được — khoá lại thay vì xoá, để chủ sân giữ được lịch sử đơn.',
  ACCOUNT_BANNED: 'Tài khoản của bạn đang bị khoá.',
};

export function adminErrorMessage(raw?: string) {
  return translate(ADMIN_ERRORS, raw, 'Thao tác không thực hiện được. Thử lại sau vài giây.');
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
