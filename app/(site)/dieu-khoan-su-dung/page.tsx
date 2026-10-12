import type { Metadata } from 'next';
import Link from 'next/link';
import { PolicyPage, PolicySection } from '@/components/policy-page';
import { siteUrl } from '@/lib/site-url';
export const metadata: Metadata = { title: 'Điều khoản sử dụng — Sân Ngon', description: 'Trách nhiệm người chơi, chủ sân, ban tổ chức và cách đặt sân, thanh toán, hủy hoặc yêu cầu hỗ trợ.', alternates: { canonical: siteUrl('/dieu-khoan-su-dung').href } };
export default function Page() {
  return <PolicyPage title="Điều khoản sử dụng" introduction="Sân Ngon là website kết nối người chơi với sân thể thao tại Hà Nội, đồng thời hỗ trợ giải đấu và danh bạ người chơi. Chủ sân cung cấp sân, nhận tiền và thực hiện khoản hoàn; website hỗ trợ lịch, ghi nhận và đối soát.">
    <PolicySection title="Tài khoản và thông tin bạn cung cấp">
      <p>Dùng thông tin liên hệ chính xác và thông tin, hình ảnh bạn có quyền cung cấp. Bảo vệ mật khẩu và phiên đăng nhập; không chia sẻ mã xác thực. Không giả mạo chủ sân, người chơi hoặc giao dịch; không khai thác lỗi để sửa giá, trạng thái thanh toán hay xem dữ liệu của người khác.</p>
      <p className="mt-3">Khi thấy thông tin sai, nội dung gây hại hoặc tài khoản có dấu hiệu bị sử dụng trái phép, gửi yêu cầu hỗ trợ kèm trang liên quan. Admin có thể kiểm tra và hạn chế tài khoản theo tình huống; nghĩa vụ đối soát đơn và tiền đã nhận vẫn cần được xử lý.</p>
    </PolicySection>
    <PolicySection title="Đặt sân và chuyển cọc">
      <p>Mỗi đơn đặt đúng một sân con. Kiểm tra địa điểm, môn chơi, sân, giờ bắt đầu, thời lượng, tổng tiền và điều kiện hủy trước khi xác nhận. Giá trên đơn do hệ thống tính và được giữ theo thời điểm đặt.</p>
      <p className="mt-3">Đơn chờ giữ chỗ 15 phút. Cọc cho đơn mới bằng 100% tiền sân. Chuyển đúng tài khoản, số tiền và mã hiển thị trên chính đơn đó; không lấy tài khoản của đơn khác. Đơn được xác nhận sau khi hệ thống nhận đủ giao dịch hợp lệ hoặc chủ sân xác nhận tay sau khi đối soát ngân hàng.</p>
      <p className="mt-3">Chuyển thiếu, thừa, trùng, sai mã hoặc muộn cần đối soát. Hai khoản thiếu không tự cộng thành một khoản cọc đủ. Tiền đến sau khi hết hạn không khôi phục giữ chỗ; không tự tạo đơn khác. Về trang chủ không hủy giữ chỗ đang có.</p>
    </PolicySection>
    <PolicySection title="Hủy và hoàn tiền">
      <p>Đơn sân thông thường mới được hoàn cọc khi người chơi hủy trước giờ chơi ít nhất 2 giờ; hủy muộn hơn không được hoàn theo chính sách hiện tại. Chủ sân hủy đơn đã nhận cọc thì phải hoàn cọc. Chủ sân hoàn thủ công trong 3 ngày làm việc sau khi đủ giao dịch đối soát và thông tin nhận tiền.</p>
      <p className="mt-3">Đánh dấu cần hoàn không có nghĩa tiền đã về tài khoản. Theo dõi đơn và liên hệ chủ sân bằng mã đơn. Nếu sân không chơi được vì thời tiết, liên hệ chủ sân để thống nhất; website không tự đổi giờ hoặc chuyển cọc sang đơn mới. Đơn cũ giữ điều khoản tại lúc đặt; đọc phần chính sách trên đơn và trang chính sách hủy.</p>
      <Link href="/chinh-sach-huy" className="mt-3 inline-flex min-h-11 items-center font-semibold text-pitch underline underline-offset-4">Xem chính sách hủy đầy đủ</Link>
    </PolicySection>
    <PolicySection title="Trách nhiệm của chủ sân">
      <p>Chủ sân chịu trách nhiệm về thông tin, ảnh thật, giá, lịch mở cửa và khả năng cung cấp sân. Hồ sơ tài khoản phải được duyệt trước khi tạo và công khai sân theo luồng của website. Chủ sân quản lý tài khoản nhận cọc của mình, kiểm tra các giao dịch cần đối soát và hoàn tiền đủ điều kiện.</p>
      <p className="mt-3">Phí sử dụng website mặc định được miễn. Khi admin áp dụng phí, mức hiện tại là 299.000đ/tháng cho tất cả cụm sân của một chủ sân. Hết hạn phí dừng đăng sân và nhận đơn mới; xử lý đơn cũ, cọc, hủy và hoàn vẫn được thực hiện. Cấu hình kết nối hoặc đóng phí không tự cho phép mở nhận đơn nếu tài khoản chưa đáp ứng điều kiện vận hành.</p>
    </PolicySection>
    <PolicySection title="Giải đấu và danh bạ Kết nối">
      <p>Đọc thể lệ, khoản phí, điều kiện tham gia và hạn thanh toán riêng trên từng giải. Ban tổ chức duyệt suất, tổ chức giải và xử lý các khoản cần hoàn. Chính sách giải mới dùng mốc tự hủy trước ít nhất 24 giờ để hoàn cọc; ban tổ chức hủy suất hoặc hủy giải thì hoàn toàn bộ tiền đã nhận. Giải cũ giữ chính sách đã công bố. Mốc 24 giờ của giải không thay mốc 2 giờ của đơn sân thường.</p>
      <p className="mt-3">Kết nối là danh bạ tự liên hệ, không có chat hay cam kết ghép kèo. Công khai hồ sơ và từng kênh liên hệ là lựa chọn của bạn. Tôn trọng quyền riêng tư của người khác, không thu thập thông tin để quấy rối hoặc sử dụng sai mục đích.</p>
    </PolicySection>
    <PolicySection title="Hỗ trợ và xử lý vướng mắc">
      <p>Với lịch sân hoặc khoản hoàn, liên hệ chủ sân trước và cung cấp mã đơn. Với đăng ký giải, liên hệ ban tổ chức. Nếu cần hỗ trợ thêm, gửi yêu cầu riêng tư qua website hoặc email Sân Ngon. Kèm mã và chứng từ cần thiết; không gửi mật khẩu, OTP hay thông tin ngân hàng nhạy cảm.</p>
      <div className="mt-4 flex flex-wrap gap-3"><Link href="/ho-tro-giao-dich" className="inline-flex min-h-11 items-center rounded-control border border-pitch px-4 font-semibold text-pitch">Hỗ trợ giao dịch</Link><Link href="/gop-y?trang=%2Fdieu-khoan-su-dung" className="inline-flex min-h-11 items-center rounded-control bg-pitch px-4 font-semibold text-pitch-ink">Gửi yêu cầu hỗ trợ</Link><a href="mailto:sanngon.exe@gmail.com" className="inline-flex min-h-11 break-all items-center font-semibold text-pitch underline underline-offset-4">sanngon.exe@gmail.com</a></div>
    </PolicySection>
  </PolicyPage>;
}
