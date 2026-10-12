import type { BookingPolicy } from '@/lib/types';

export function BookingPolicySummary({ policy }: { policy: BookingPolicy }) {
  return <div className="space-y-2 text-xs leading-6 text-ink-secondary">
    <p>Hủy trước giờ chơi ít nhất <strong>{policy.cancel_window_hours} giờ</strong> được hoàn toàn bộ cọc. Hủy muộn hơn không được hoàn cọc. Chủ sân hủy thì hoàn toàn bộ cọc.</p>
    {policy.refund_working_days ? <p>Chủ sân nhận cọc hoàn thủ công trong <strong>{policy.refund_working_days} ngày làm việc</strong> sau khi đủ thông tin đối soát và nhận tiền. Thứ Hai–thứ Sáu, không gồm ngày lễ.</p> : <p>Đơn cũ chưa lưu thời hạn xử lý hoàn tiền. Liên hệ chủ sân để đối soát theo điều khoản lúc đặt.</p>}
    <p>Điều khoản được giữ riêng cho đơn này; chuyển khoản muộn được đối soát để hoàn, không khôi phục giữ chỗ.</p>
  </div>;
}
