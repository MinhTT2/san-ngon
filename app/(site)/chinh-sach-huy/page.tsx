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
 * Mốc hủy giữ nguyên và khớp cancel_booking(). Hoàn tiền vẫn thủ công.
 */
export default function Page() {
  const rules: [string, string][] = [
    [
      `Hủy trước giờ chơi từ ${CANCEL_WINDOW_HOURS} tiếng trở lên`,
      'Đơn được đánh dấu cần hoàn cọc. Liên hệ chủ sân kèm mã đơn để đối soát và xác nhận thông tin nhận lại tiền. Chủ sân thực hiện hoàn thủ công trong 3 ngày làm việc sau khi đối soát đủ giao dịch và thông tin nhận tiền.',
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

      <h2 className="mt-9 font-display text-2xl font-bold text-pitch">Đặt sân thông thường</h2>
      <dl className="mt-5 flex flex-col">
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
        Chủ sân chịu trách nhiệm đối soát và hoàn tiền. Ngày làm việc tính từ thứ Hai đến thứ Sáu, không gồm ngày lễ. Nếu quá 3 ngày làm việc sau khi cung cấp đủ thông tin mà chưa nhận tiền, liên hệ Sân Ngon kèm mã đơn và biên lai để được hỗ trợ. Đơn cũ giữ chính sách tại lúc đặt; thay đổi chỉ áp dụng cho đơn mới sau ngày công bố.
      </p>
      <section className="mt-10 rounded-card border border-strong bg-free-fill p-6">
        <h2 className="font-display text-2xl font-bold text-pitch">Đăng ký giải đấu</h2>
        <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-7">
          <li>Người chơi tự hủy trước giờ thi đấu ít nhất 24 giờ được hoàn 100% cọc. Hủy muộn hơn không hoàn cọc; sau giờ bắt đầu, liên hệ ban tổ chức.</li>
          <li>Ban tổ chức hủy suất hoặc hủy cả giải: hoàn toàn bộ tiền đã nhận, gồm cọc và phần lệ phí còn lại đã thu.</li>
          <li>Hạn cọc tính từ lúc được duyệt, theo số giờ ghi trên giải và không vượt hạn thanh toán cuối cùng. Hết hạn chưa đủ cọc thì suất được trả lại.</li>
          <li>Chuyển vào mã đăng ký cũ, chuyển thiếu, thừa hoặc trùng được ghi để đối soát. Mỗi lần đăng ký lại có mã chuyển khoản mới.</li>
          <li>Chủ sân thực hiện hoàn tiền thủ công. Mở chi tiết giải để xem giao dịch và trạng thái hoàn. Giải cũ giữ chính sách đã công bố; mốc cụ thể hiển thị trên từng đăng ký.</li>
        </ul>
      </section>
    </main>
  );
}
