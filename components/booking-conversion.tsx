import { createClient } from '@/lib/supabase/server';
import { QueryError } from './query-error';
type Conversion = { from: string; to: string; created: number; paid: number; holding: number; ended: number; conversion_pct: number | null; daily: { date: string; created: number; paid: number }[] };
export async function BookingConversion({ days }: { days: number }) {
  const db = await createClient(); const { data, error } = await db.rpc('get_booking_conversion', { p_days: days });
  if (error || !data) return <QueryError className="my-6" title="Chưa tải được tỷ lệ chốt cọc" />;
  const result = data as unknown as Conversion;
  return <section className="my-6 rounded-card border border-hairline bg-card p-5 sm:p-6" aria-labelledby="booking-conversion-title">
    <h2 id="booking-conversion-title" className="font-display text-xl font-bold text-pitch">Từ tạo đơn đến xác nhận cọc</h2>
    <p className="mt-2 text-sm leading-6 text-ink-secondary">Các đơn được tạo từ {result.from} đến {result.to}, theo ngày Việt Nam; kiểm tra thanh toán hiện tại của chính nhóm đơn đó.</p>
    <dl className="my-5 grid grid-cols-2 gap-4 lg:grid-cols-4">{[['Đơn đã tạo', result.created], ['Đã xác nhận cọc', result.paid], ['Còn giữ chỗ, chưa cọc', result.holding], ['Đã kết thúc, chưa cọc', result.ended]].map(([title, count]) => <div key={title}><dt className="text-sm text-ink-secondary">{title}</dt><dd className="mt-2 font-display text-2xl font-bold text-pitch">{count}</dd></div>)}</dl>
    <p className="text-sm font-semibold text-pitch">Tỷ lệ đơn đã có cọc: {result.conversion_pct === null ? 'Chưa có đơn trong kỳ' : `${result.conversion_pct}%`}</p>
    <details className="mt-4"><summary className="cursor-pointer py-3 text-sm font-semibold text-pitch">Xem theo ngày tạo đơn</summary><div className="max-h-80 overflow-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Nhóm đơn theo ngày tạo và số đã xác nhận cọc</caption><thead><tr><th scope="col" className="py-2">Ngày tạo</th><th scope="col">Đã tạo</th><th scope="col">Đã có cọc</th></tr></thead><tbody>{result.daily.map(day => <tr key={day.date} className="border-t border-hairline"><th scope="row" className="py-2 font-normal">{day.date}</th><td>{day.created}</td><td>{day.paid}</td></tr>)}</tbody></table></div></details>
    <p className="mt-4 text-xs leading-6 text-ink-secondary">Dữ liệu đơn từ database, gồm xác nhận tay và tự động, loại thanh toán mô phỏng. Đơn có cọc rồi hủy/hoàn vẫn tính là đã đi qua bước cọc; đây không phải doanh thu. Không nối danh tính với GA4 hoặc chia số đơn cho số lượt tìm để suy ra tỷ lệ chuyển đổi. Số tìm/mở/chọn giờ trong báo cáo GA4 là số thao tác riêng, có thể thiếu hoặc lặp; số liệu đơn đã xóa không còn trong nhóm.</p>
  </section>;
}
