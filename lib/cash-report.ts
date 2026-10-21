import { csvCell } from './reconciliation-csv';
import { hhmm, ymd } from './format';
export type CashRow = { id: string; occurred_at: string; source: string; code: string; reference: string; received: number; refunded: number; needs_review: boolean };
export type CashReport = { from: string; to: string; checked_at: string; total: number; page: number; pages: number; received: number; refunded: number; review_count: number; booking_refund_due_now: number; legacy_refund_count: number; sources: { source: string; received: number }[]; rows: CashRow[] };
export const cashSources: Record<string, string> = { booking: 'Đặt sân', tournament: 'Giải đấu', subscription: 'Phí website' };
export function cashReportCsv(report: CashReport) {
  return '\uFEFF' + [
    ['Ngày giờ ghi nhận (Việt Nam)', 'Nguồn', 'Mã', 'Tham chiếu', 'Nhận vào (VND)', 'Hoàn sân đã ghi (VND)', 'Cần đối soát'],
    ...report.rows.map(row => [ymd(new Date(row.occurred_at)) + ' ' + hhmm(row.occurred_at), cashSources[row.source], row.code, row.reference, row.received, row.refunded, row.needs_review ? 'Có' : '']),
  ].map(row => row.map(csvCell).join(',')).join('\r\n');
}
