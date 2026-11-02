import { hhmm, ymd } from './format';
import { BOOKING_STATUS_LABELS } from './constants';
import { csvCell } from './reconciliation-csv';

export type AdminBookingExportRow = {
  code: string;
  venue_name: string;
  court_name: string;
  owner_name: string | null;
  owner_phone: string | null;
  customer_name: string | null;
  customer_phone: string;
  starts_at: string;
  ends_at: string;
  status: string;
  total_amount: number;
  deposit_amount: number;
  paid_at: string | null;
  refund_status: string | null;
  created_at: string;
  note: string | null;
};

export function adminBookingCsv(rows: AdminBookingExportRow[]) {
  const headers = ['Mã đơn', 'Cụm sân', 'Sân', 'Chủ sân', 'SĐT chủ sân', 'Tên khách', 'SĐT khách', 'Ngày chơi (Việt Nam)', 'Bắt đầu', 'Kết thúc', 'Trạng thái', 'Tổng tiền sân (VND)', 'Cọc trên đơn (VND)', 'Ghi nhận thanh toán (Việt Nam)', 'Hoàn cọc', 'Tạo đơn (Việt Nam)', 'Ghi chú'];
  const status = BOOKING_STATUS_LABELS as Record<string, string>;
  const values = rows.map((row) => [
    row.code,
    row.venue_name,
    row.court_name,
    row.owner_name,
    row.owner_phone,
    row.customer_name,
    row.customer_phone,
    ymd(new Date(row.starts_at)),
    hhmm(row.starts_at),
    hhmm(row.ends_at),
    status[row.status] ?? row.status,
    row.total_amount,
    row.deposit_amount,
    row.paid_at ? `${ymd(new Date(row.paid_at))} ${hhmm(row.paid_at)}` : '',
    row.refund_status === 'done' ? 'Đã hoàn' : row.refund_status === 'needed' ? 'Cần hoàn' : '',
    `${ymd(new Date(row.created_at))} ${hhmm(row.created_at)}`,
    row.note,
  ]);
  return '\uFEFF' + [headers, ...values].map((line) => line.map(csvCell).join(',')).join('\r\n');
}
