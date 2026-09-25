import type { Metadata } from 'next';
import { CANCEL_WINDOW_HOURS, HOLD_MINUTES } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Chính sách hủy — Sân Ngon',
  description: 'Khi nào được hoàn cọc, khi nào mất cọc, và mưa thì tính sao.',
};

/**
 * Trang này là thứ khách mở ra khi trời chuyển mưa lúc 4 giờ chiều.
 * Viết bằng câu họ hỏi, không bằng ngôn ngữ điều khoản.
 *
 * TODO: mốc {CANCEL_WINDOW_HOURS} tiếng CHƯA CHỐT với chủ sân. Đổi ở
 * lib/constants.ts và trong hàm cancel_booking() cùng lúc.
 */
export default function Page() {
  const rules: [string, string][] = [
    [
      `Hủy trước giờ chơi từ ${CANCEL_WINDOW_HOURS} tiếng trở lên`,
      'Đơn được đánh dấu cần hoàn cọc. Liên hệ chủ sân kèm mã đơn để đối soát và xác nhận thông tin nhận lại tiền. Việc hoàn tiền được xử lý thủ công.',
    ],
    [
      `Hủy muộn hơn ${CANCEL_WINDOW_HOURS} tiếng`,
      'Mất cọc. Giờ đó gần như không bán lại được cho nhóm khác nữa, chủ sân đã từ chối khách để giữ chỗ cho bạn.',
    ],
    [
      'Chưa chuyển khoản mà bỏ đơn',
      `Không mất gì. Đơn tự hủy sau ${HOLD_MINUTES} phút và khung giờ mở lại cho người khác.`,
    ],
    [
      'Trời mưa, sân không chơi được',
      'Liên hệ chủ sân theo số trên trang sân để thống nhất cách xử lý. Website không tự đổi giờ hoặc chuyển cọc sang đơn mới. Nếu chủ sân hủy đơn đã nhận cọc, đơn được đánh dấu cần hoàn.',
    ],
    [
      'Chủ sân hủy đơn của bạn',
      'Luôn được hoàn cọc, bất kể còn bao nhiêu thời gian.',
    ],
    [
      'Đã chuyển khoản nhưng đơn hết hạn giữ chỗ',
      'Tiền vào sau khi đơn hết hạn sẽ được đánh dấu cần hoàn. Liên hệ chủ sân kèm mã đơn.',
    ],
  ];

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 lg:px-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-pitch lg:text-4xl">
        Chính sách hủy
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-secondary">
        Chuyển cọc theo đúng tài khoản, số tiền và nội dung trên trang thanh toán của đơn.
        Khi đủ điều kiện hoàn cọc, đơn được đánh dấu cần hoàn để đối soát; tiền không tự động
        chuyển về tài khoản. Bạn có thể theo dõi trong Đơn của tôi và liên hệ chủ sân kèm mã đơn.
      </p>

      <dl className="mt-9 flex flex-col">
        {rules.map(([q, a], i) => (
          <div
            key={q}
            className={`flex flex-col gap-2 border-t border-hairline py-5 ${i === rules.length - 1 ? 'border-b' : ''}`}
          >
            <dt className="text-[17px] font-semibold">{q}</dt>
            <dd className="text-[15px] leading-relaxed text-ink-secondary">{a}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-8 rounded-card bg-sunk p-5 text-sm leading-relaxed text-ink-secondary">
        Mốc {CANCEL_WINDOW_HOURS} tiếng đang được thống nhất lại với các chủ sân đầu tiên. Nếu có
        thay đổi, chính sách áp dụng cho đơn đặt sau ngày công bố, không hồi tố.
      </p>
    </main>
  );
}
