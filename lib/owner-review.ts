/**
 * Bảng đối chiếu hồ sơ chủ sân.
 *
 * Ba mục dưới đây khớp đúng ba điều kiện `review_owner()` kiểm trước khi duyệt.
 * Đổi một bên thì phải đổi bên kia, nếu không admin sẽ thấy hồ sơ "đủ" rồi bấm
 * Duyệt mới ăn lỗi từ server — đúng cái trải nghiệm này sinh ra để tránh.
 */

export type OwnerApplicationStatus = 'pending' | 'active' | 'rejected';

export type OwnerApplication = {
  full_name: string | null;
  phone: string | null;
  business_license_path: string | null;
  business_license_name: string | null;
  payout_bank: string | null;
  payout_account: string | null;
};

export type CheckItem = {
  key: 'representative' | 'license' | 'payout';
  label: string;
  ok: boolean;
  /** Giá trị để admin đối chiếu với giấy tờ, hoặc lý do đang thiếu. */
  detail: string;
};

const PHONE = /^0\d{9}$/;
const ACCOUNT = /^\d{6,30}$/;

export function ownerChecklist(p: OwnerApplication): CheckItem[] {
  const name = (p.full_name ?? '').trim();
  const phone = (p.phone ?? '').trim();
  const bank = (p.payout_bank ?? '').trim();
  const account = (p.payout_account ?? '').trim();

  const nameOk = name.length >= 2 && name.length <= 120;
  const phoneOk = PHONE.test(phone);

  return [
    {
      key: 'representative',
      label: 'Người đại diện',
      ok: nameOk && phoneOk,
      detail: !nameOk
        ? 'Chưa có họ tên'
        : !phoneOk
          ? `Số điện thoại không hợp lệ${phone ? `: ${phone}` : ''}`
          : `${name} · ${phone}`,
    },
    {
      key: 'license',
      label: 'Giấy phép kinh doanh',
      ok: Boolean(p.business_license_path),
      detail: p.business_license_path
        ? (p.business_license_name ?? 'Đã tải lên')
        : 'Chưa tải lên',
    },
    {
      key: 'payout',
      label: 'Tài khoản nhận cọc',
      ok: bank !== '' && ACCOUNT.test(account),
      detail: bank === ''
        ? 'Chưa chọn ngân hàng'
        : !ACCOUNT.test(account)
          ? 'Số tài khoản không hợp lệ'
          : `${bank} · ${account}`,
    },
  ];
}

/** Thiếu một mục là chưa duyệt được. */
export function canApprove(p: OwnerApplication) {
  return ownerChecklist(p).every((item) => item.ok);
}

/** Lý do từ chối bấm một phát. Vẫn sửa được thành câu riêng. */
export const REJECT_REASONS = [
  'Giấy phép kinh doanh chụp mờ, không đọc được',
  'Tên trên giấy phép không khớp người đại diện',
  'Số tài khoản nhận cọc không đúng tên chủ hồ sơ',
  'Số điện thoại không liên lạc được',
] as const;

export const OWNER_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt',
  active: 'Đã duyệt',
  rejected: 'Bị từ chối',
};

export const OWNER_REVIEW_ERRORS: Record<string, string> = {
  FORBIDDEN: 'Bạn không có quyền duyệt hồ sơ.',
  OWNER_NOT_FOUND: 'Không tìm thấy hồ sơ chủ sân.',
  OWNER_ALREADY_REVIEWED: 'Hồ sơ đã được xử lý. Hãy tải lại trang.',
  REASON_REQUIRED: 'Nhập lý do từ chối để chủ sân biết cần sửa gì.',
  REPRESENTATIVE_REQUIRED: 'Hồ sơ thiếu họ tên hoặc số điện thoại hợp lệ.',
  BUSINESS_LICENSE_MISSING: 'Hồ sơ chưa có giấy phép kinh doanh.',
  PAYOUT_REQUIRED: 'Hồ sơ chưa có tài khoản nhận cọc hợp lệ.',
  INVALID_STATUS: 'Kết quả duyệt không hợp lệ.',
};

/** "3 ngày", "5 giờ" — hồ sơ chờ bao lâu rồi. */
export function waitingFor(iso: string, now = Date.now()) {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} phút`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ`;
  return `${Math.floor(hours / 24)} ngày`;
}
