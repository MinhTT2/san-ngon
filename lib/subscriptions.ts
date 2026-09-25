export type OwnerSubscription = {
  owner_id: string; fee_required: boolean; paid_until: string | null; active: boolean; amount: number;
};
export type SubscriptionInvoice = {
  id: string; owner_id: string; code: string; amount: number; status: 'pending' | 'paid';
  bank: string; account_number: string; account_name: string; created_at: string;
  paid_at: string | null; period_start: string | null; period_end: string | null;
};
export function subscriptionError(raw: string) {
  const messages: Record<string, string> = {
    FORBIDDEN: 'Bạn không có quyền thay đổi phí chủ sân.',
    OWNER_NOT_APPROVED: 'Chủ sân cần được duyệt hồ sơ trước.',
    FEE_NOT_REQUIRED: 'Tài khoản này đang được miễn phí sử dụng.',
    RECEIVER_NOT_CONFIGURED: 'Chưa thiết lập tài khoản nhận phí. Vui lòng liên hệ quản trị viên.',
    RECEIVER_NOT_READY: 'Tài khoản nhận phí đang mất kết nối. Vui lòng liên hệ quản trị viên.',
  };
  return Object.entries(messages).find(([code]) => raw.includes(code))?.[1] ?? 'Chưa xử lý được. Vui lòng thử lại.';
}
