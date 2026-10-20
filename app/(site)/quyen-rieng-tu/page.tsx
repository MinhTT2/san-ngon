import type { Metadata } from 'next';
import Link from 'next/link';
import { PolicyPage, PolicySection } from '@/components/policy-page';
import { siteUrl } from '@/lib/site-url';
export const metadata: Metadata = { title: 'Quyền riêng tư — Sân Ngon', description: 'Dữ liệu Sân Ngon sử dụng, quyền công khai hồ sơ và cách yêu cầu kiểm tra, sửa hoặc xóa dữ liệu.', alternates: { canonical: siteUrl('/quyen-rieng-tu').href } };
export default function Page() {
  return <PolicyPage title="Quyền riêng tư" introduction="Sân Ngon sử dụng thông tin để quản lý tài khoản, đặt sân, xác minh chủ sân, tổ chức giải và đối soát thanh toán. Bạn quyết định việc công khai hồ sơ Kết nối và từng kênh liên hệ.">
    <PolicySection title="Thông tin được lưu và mục đích sử dụng">
      <ul className="list-disc space-y-3 pl-5">
        <li><strong className="text-ink">Tài khoản:</strong> email, họ tên, số điện thoại và ảnh đại diện để đăng nhập, liên hệ và hiển thị thông tin phù hợp. Đăng nhập Google dùng thông tin tài khoản do Google cung cấp khi bạn cấp quyền.</li>
        <li><strong className="text-ink">Đặt sân:</strong> sân, thời gian, thông tin người đặt, ghi chú, giá và trạng thái đơn để giữ lịch, xác nhận cọc, hủy và hoàn tiền.</li>
        <li><strong className="text-ink">Chủ sân:</strong> thông tin đại diện, giấy tờ xác minh và tài khoản nhận tiền để xét hồ sơ và vận hành sân. Giấy tờ xác minh được lưu riêng tư, không xuất hiện trên trang sân công khai.</li>
        <li><strong className="text-ink">Thanh toán và hỗ trợ:</strong> mã giao dịch, số tiền, nội dung chuyển khoản, ghi chú và chứng từ bạn gửi để kiểm tra khoản thiếu, thừa, trùng hoặc muộn. Không gửi mật khẩu ngân hàng, mã OTP, mã PIN hay thông tin thẻ qua biểu mẫu.</li>
        <li><strong className="text-ink">Giải đấu:</strong> thông tin giải, người hoặc đội đăng ký, liên hệ, cọc và quyết toán để duyệt suất, tổ chức giải và xử lý tiền.</li>
        <li><strong className="text-ink">Kết nối:</strong> tên hiển thị, khu vực, môn chơi, trình độ, mô tả, thời gian thường chơi và các kênh liên hệ bạn nhập. Thời gian thường chơi là mô tả, không phải lịch trống hay lời hứa tham gia.</li>
      </ul>
    </PolicySection>
    <PolicySection title="Ai có thể xem thông tin?">
      <p>Bạn xem thông tin tài khoản, đơn và yêu cầu hỗ trợ của mình. Chủ sân xem thông tin khách liên quan đến sân và giao dịch nhận tiền của họ. Ban tổ chức có quyền xem đăng ký giải thuộc phạm vi quản lý. Admin xem thông tin cần thiết để duyệt hồ sơ, hỗ trợ và đối soát. Chứng từ hỗ trợ không nằm trong danh sách công khai.</p>
      <p className="mt-3">Trang sân và giải đã công khai có thể được xem khi chưa đăng nhập. Ảnh sân được công khai để người chơi chọn sân. Giấy tờ chủ sân, dữ liệu thanh toán chi tiết và thỏa thuận quyết toán được tách khỏi các trang công khai.</p>
    </PolicySection>
    <PolicySection title="Bạn kiểm soát hồ sơ Kết nối">
      <p>Hồ sơ mới mặc định ẩn. Khi chọn công khai, người chưa đăng nhập cũng có thể xem tên hiển thị, mô tả và ảnh đại diện. Điện thoại, Zalo và Facebook chỉ hiện theo từng công tắc bạn chọn. Có thể công khai hồ sơ và ẩn tất cả kênh liên hệ.</p>
      <p className="mt-3">Bỏ chọn công khai và lưu để ẩn hồ sơ. Việc này không xóa tài khoản, đơn, đăng ký giải hoặc giao dịch. Người đã xem có thể đã lưu thông tin; website không thể thu hồi bản sao ở bên ngoài.</p>
      <Link href="/ket-noi/ho-so" className="mt-3 inline-flex min-h-11 items-center font-semibold text-pitch underline underline-offset-4">Đổi thông tin và quyền công khai</Link>
    </PolicySection>
    <PolicySection title="Đăng nhập, kết nối ngân hàng và dịch vụ hạ tầng">
      <p>Cookie phiên giúp duy trì đăng nhập. Supabase cung cấp xác thực, dữ liệu và lưu trữ; Vercel cung cấp website. SePay xử lý kết nối tài khoản nhận tiền và gửi thông báo giao dịch khi chủ sân cấp quyền. Khóa kết nối ngân hàng được bảo vệ phía hệ thống và không hiển thị trong trình duyệt.</p>
      <p className="mt-3">Thông tin đơn cần thiết có thể được gửi qua Telegram hoặc email khi kênh thông báo được cấu hình. Email xác thực tài khoản dùng dịch vụ gửi thư được thiết lập cho đăng nhập. Các nhà cung cấp có chính sách dữ liệu riêng; việc ẩn hồ sơ Kết nối không ngắt các dịch vụ cần để xử lý đơn đang có.</p>
    </PolicySection>
    <PolicySection title="Đo lường lượt truy cập website">
      <p>Khi bạn đăng nhập, Sân Ngon ghi nhận thời lượng sử dụng ước tính và lần hoạt động gần nhất để quản trị viên theo dõi việc sử dụng hệ thống. Chỉ tính khi tab đang được xem và có tương tác trong 5 phút gần nhất; không cộng trùng nhiều tab. Phần này không lưu nội dung nhập, đường đi từng trang hay lịch sử thao tác, và không gửi định danh tài khoản sang Google Analytics.</p>
      <p className="mt-3">Sân Ngon sử dụng Google Analytics 4 trên website chính thức để thống kê lượt truy cập, nguồn truy cập, thiết bị, trình duyệt, vị trí tổng hợp do Google ước tính và các trang công khai được xem. Website cũng đếm số lần tìm sân, mở trang sân và tiếp tục sau chọn giờ bằng tên thao tác cố định. Google Analytics có thể lưu cookie đo lường để phân biệt lượt truy cập mới và quay lại. Việc đo lường này không dùng để cá nhân hóa quảng cáo.</p>
      <p className="mt-3">Website chỉ gửi địa chỉ trang công khai đã loại bỏ phần tham số và phần sau dấu #, cùng nguồn giới thiệu đã rút gọn. Không gửi thông tin tài khoản, nội dung biểu mẫu, mã đơn hoặc dữ liệu thanh toán. Trang tài khoản, checkout, quản trị và các trang quản lý không nằm trong phạm vi đo lường.</p>
      <p className="mt-3">Bạn có thể dùng công cụ chặn theo dõi hoặc <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="font-semibold text-pitch underline underline-offset-4">tiện ích từ chối Google Analytics</a>. Việc chặn đo lường không ngăn bạn tìm và đặt sân. Xem thêm <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-pitch underline underline-offset-4">chính sách quyền riêng tư của Google</a>.</p>
    </PolicySection>
    <PolicySection title="Lưu giữ, chỉnh sửa và yêu cầu xóa">
      <p>Bạn sửa thông tin tài khoản hoặc ẩn hồ sơ Kết nối ngay trên website. Đăng xuất không xóa dữ liệu. Hiện chưa công bố một thời hạn tự động xóa chung cho toàn bộ hồ sơ và giao dịch.</p>
      <p className="mt-3">Để yêu cầu xem, sửa hoặc xóa dữ liệu khác, gửi yêu cầu qua biểu mẫu hỗ trợ từ tài khoản của bạn, hoặc email nếu không đăng nhập được. Nêu loại dữ liệu và mã đơn liên quan; không gửi thêm giấy tờ nhạy cảm khi chưa được yêu cầu. Sân Ngon cần xác minh bạn là chủ dữ liệu trước khi xử lý.</p>
      <p className="mt-3">Đơn, giao dịch và chứng từ có thể cần giữ để đối soát, xử lý khoản hoàn hoặc tranh chấp. Việc xóa sẽ được xem xét theo phạm vi dữ liệu và nghĩa vụ còn mở; phản hồi cần làm rõ phần có thể xử lý và phần cần giữ. Yêu cầu không tự làm biến mất khoản thanh toán hoặc nghĩa vụ hoàn tiền.</p>
      <div className="mt-4 flex flex-wrap gap-3"><Link href="/gop-y?trang=%2Fquyen-rieng-tu" className="inline-flex min-h-11 items-center rounded-control bg-pitch px-4 font-semibold text-pitch-ink">Gửi yêu cầu về dữ liệu</Link><a href="mailto:sanngon.exe@gmail.com" className="inline-flex min-h-11 break-all items-center font-semibold text-pitch underline underline-offset-4">sanngon.exe@gmail.com</a></div>
    </PolicySection>
  </PolicyPage>;
}
