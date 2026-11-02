import { hhmm, ymd } from './format';
import { BOOKING_STATUS_LABELS } from './constants';
import { csvCell } from './reconciliation-csv';

// Excel tự đổi chuỗi chỉ có số/ngày giờ thành number/date: cột hẹp hiện ####, số điện thoại
// mất số 0 đầu, giờ bị đổi theo locale. Ép các giá trị đã định dạng sẵn thành ô text ="..." để
// giữ nguyên chuỗi hiển thị. Chỉ áp cho giá trị máy sinh (bắt đầu bằng chữ số, chỉ gồm số và
// dấu ngăn) nên không mở đường cho CSV injection từ dữ liệu nhập tay.
const PLAIN_TEXT = /^[0-9][0-9:./ -]*$/;
const TEXT_FORMULA = /^="[0-9][0-9:./ -]*"$/;

function csvText(value: unknown) {
  const text = String(value ?? '');
  return text && PLAIN_TEXT.test(text) ? `="${text}"` : text;
}

function csvValue(value: unknown) {
  if (typeof value === 'string' && TEXT_FORMULA.test(value)) {
    return '"' + value.replaceAll('"', '""') + '"';
  }
  return csvCell(value);
}

// Nhãn nội bộ của đợt dữ liệu mô phỏng ([docs-YYYYMMDD], [docs-bookers-YYYYMMDD]) không
// dành cho người đọc file xuất, nên ghi chú chỉ có nhãn đó không được đưa vào CSV.
const INTERNAL_NOTE = /\[docs[-a-z0-9]*\]/i;

function exportNote(note: string | null) {
  return note && !INTERNAL_NOTE.test(note) ? note : '';
}

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
    csvText(row.owner_phone),
    row.customer_name,
    csvText(row.customer_phone),
    csvText(ymd(new Date(row.starts_at))),
    csvText(hhmm(row.starts_at)),
    csvText(hhmm(row.ends_at)),
    status[row.status] ?? row.status,
    row.total_amount,
    row.deposit_amount,
    csvText(row.paid_at ? `${ymd(new Date(row.paid_at))} ${hhmm(row.paid_at)}` : ''),
    row.refund_status === 'done' ? 'Đã hoàn' : row.refund_status === 'needed' ? 'Cần hoàn' : '',
    csvText(`${ymd(new Date(row.created_at))} ${hhmm(row.created_at)}`),
    exportNote(row.note),
  ]);
  return '\uFEFF' + [headers, ...values].map((line) => line.map(csvValue).join(',')).join('\r\n');
}
