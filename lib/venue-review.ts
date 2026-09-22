/** Quản lý cụm sân từ phía admin. */

export const VENUE_REVIEW_ERRORS: Record<string, string> = {
  FORBIDDEN: 'Bạn không có quyền quản lý cụm sân.',
  VENUE_NOT_FOUND: 'Không tìm thấy cụm sân này.',
  VENUE_DRAFT: 'Cụm sân còn là bản nháp của chủ sân, chưa gửi lên.',
  VENUE_NO_CHANGE: 'Cụm sân đã ở trạng thái đó rồi. Hãy tải lại trang.',
  REASON_REQUIRED: 'Nhập lý do để chủ sân biết cần sửa gì.',
  OWNER_NOT_APPROVED: 'Hồ sơ chủ sân chưa được duyệt hoặc đang bị khoá. Duyệt chủ sân trước đã.',
  INVALID_STATUS: 'Trạng thái không hợp lệ.',
};

export function venueReviewErrorMessage(raw?: string) {
  const key = raw ? Object.keys(VENUE_REVIEW_ERRORS).find((k) => raw.includes(k)) : undefined;
  return key ? VENUE_REVIEW_ERRORS[key] : 'Không lưu được. Thử lại sau vài giây.';
}

/** Lý do gỡ sân bấm một phát. Vẫn sửa được thành câu riêng. */
export const HIDE_REASONS = [
  'Địa chỉ sai, khách tới không thấy sân',
  'Ảnh và mô tả không đúng sân thật',
  'Nhiều khách báo đặt xong tới nơi không có sân',
  'Giá niêm yết khác giá thu tại sân',
] as const;
