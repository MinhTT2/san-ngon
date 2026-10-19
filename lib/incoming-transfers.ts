export type IncomingTransfer = {
  id: string; bank: string; account_number: string; bank_tx_id: string;
  amount: number; ref_codes: string[]; booking_id: string | null;
  source: 'booking' | 'tournament' | 'subscription' | 'unknown';
  expected_amount: number | null; outcome: string; reason: string;
  needs_review: boolean; payload_conflicts: number; created_at: string; updated_at: string;
  booking_received: number | null; notes: { note: string; created_at: string }[];
};
export type IncomingTransferPage = {
  total: number; page: number; pages: number; review_count: number; received_amount: number;
  rows: IncomingTransfer[];
};
export const TRANSFER_OUTCOMES: Record<string, string> = {
  exact: 'Đã khớp', underpaid: 'Thiếu tiền', overpaid: 'Có tiền thừa', duplicate: 'Chuyển thêm / trùng',
  late: 'Chuyển muộn / đơn đã hủy', unmatched: 'Chưa tìm thấy mã', ambiguous: 'Nhiều mã trong một giao dịch',
  wrong_receiver: 'Mã thuộc tài khoản nhận khác', prior_receipt: 'Đã có trong sổ cũ',
  historical: 'Giao dịch từ sổ cũ', manual_confirmed: 'Đơn đã được xác nhận tay', other: 'Cần kiểm tra',
};
