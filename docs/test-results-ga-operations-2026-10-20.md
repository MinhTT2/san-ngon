# Kết quả GA và kiểm tra vận hành — 20/10/2026

## Phần đã hoàn thành

Trang `/admin/thong-ke-truy-cap` có tổng quan và so sánh kỳ trước, biểu đồ ngày,
kênh/nguồn truy cập, trang/trang vào đầu tiên, thiết bị, trình duyệt, hệ điều hành,
ngôn ngữ, địa lý, giờ truy cập, phiên mới/quay lại và người hoạt động 30 phút.
Có ba sự kiện khám phá sân và gợi ý kiểm tra dựa trên mẫu truy cập.
Xem [cấu hình và giới hạn báo cáo](admin-traffic.md).

Sự kiện không gửi nội dung form, định danh, thông tin đơn hay thanh toán.
Số lần thao tác không phải phễu chuyển đổi hoặc bằng chứng thanh toán.
Sửa dữ liệu thử phí dịch vụ để dùng đúng `bookings.deposit_amount`, thay số cọc
30.000đ cố định đã cũ; không thay đổi logic sản phẩm.

## Kiểm tra đã đạt

- Node 24.18.0: typecheck, production build và ESLint các file task đạt.
  Lint toàn workspace không có lỗi, có 46 cảnh báo sẵn trong `output/`.
- `check-ga4-report.mjs`: chữ ký JWT, khoảng ngày, giới hạn batch/metrics,
  các nhóm báo cáo, realtime, dữ liệu thiếu và lỗi quyền/quota; mạng Google giả lập.
- `check-traffic-suite.mjs`: build riêng từ Git index, Chromium headless/context
  cô lập; báo cáo 7/30/90 ngày, rỗng/chưa kết nối/lỗi một phần/quyền/quota/ngưỡng,
  realtime lỗi, giao diện desktop/mobile và quyền truy cập admin.
- `check-google-analytics.mjs`: điều kiện Production/origin, URL/referrer sạch,
  chuyển trang công khai/riêng tư, ba sự kiện và Google bị chặn.
  Không gửi dữ liệu thử tới Google.
- Hồi quy trình duyệt: khôi phục đơn, chống bấm trùng, checkout 320–1440px,
  snapshot người nhận/chính sách, QR, mất mạng/nối lại, realtime và không polling
  thanh toán; dùng provider và QR giả lập.
- SQL trên Supabase liên kết trong transaction rollback: giữ chỗ, chính sách hủy,
  yêu cầu đặt sân, đầu vào, sổ tiền vào, phí chủ sân và thời lượng tài khoản.
- Kiểm tra JavaScript: email, mã hóa/provider SePay, hàng đợi refresh,
  API sổ tiền vào và đầu vào đặt sân. Email/provider dùng giả lập.

`scripts/check-operational-readiness.sql` chỉ đọc cờ vận hành, cron, publication
realtime và số tài khoản có tiền tố fixture. Sau kiểm tra không còn các tài khoản
fixture thuộc các bộ SQL nêu trên. Ba cron hoàn tất đơn, hết giữ chỗ và hạn giải
đang bật; các bảng đặt sân/thông báo/phí/giải có publication realtime.

## Phụ thuộc bên ngoài còn lại

### Quyền đọc GA thật

Người vận hành xác nhận GA đã có dữ liệu thật, nhưng property Sân Ngon do người
khác giữ quyền. Production có mã đo `G-0BN7KY5V59`; chưa có `GA4_PROPERTY_ID`,
`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`.
Chưa kiểm chứng đọc báo cáo Data API thật. Trang admin hiển thị chưa kết nối.

Đã tạo Cloud project `san-ngon-analytics` để chuẩn bị. Chưa bật Data API,
chưa tạo tài khoản dịch vụ hoặc khóa. Người giữ GA cần cung cấp Property ID
dạng số và cấp Viewer cho tài khoản dịch vụ sau khi tài khoản đó được tạo.
Không thể suy ra Property ID từ mã đo; không cần gửi mật khẩu Google.

### Email thật

Kiểm tra chỉ đọc cấu hình Supabase Auth cho thấy chưa có SMTP riêng, hạn mức
2 email/giờ; độ dài/hạn OTP, tiêu đề và nội dung thư xác nhận chưa khớp cấu hình
mong đợi trong `scripts/configure-auth-email.mjs`.
Production có biến Resend/email người gửi nhưng là Sensitive; không lấy lại
được khóa để cấu hình SMTP từ bản env pull. Cần cấu hình nhà cung cấp/domain
gửi đã xác minh rồi nghiệm thu đăng ký, OTP và thư thông báo với người nhận thử.
Chưa gửi email thật trong đợt này.

### Chuyển khoản và hoàn tiền thật

Các kiểm tra SQL/provider/checkout đạt không thay thế chuyển tiền thật qua SePay
và thao tác hoàn cọc thủ công. Cần đối chiếu một đơn thực tế: QR đúng người nhận,
tiền vào, webhook, trạng thái đơn, thông báo và hoàn tiền theo chính sách.

Tại thời điểm kiểm tra, `booking_operator.multi_owner_enabled = true` và
`accepts_new_bookings = false`. Đây là trạng thái có sẵn, không được thay đổi
trong task này; phiên làm việc không có bằng chứng nghiệm thu chuyển khoản thật
để xác nhận việc mở nhiều chủ sân đã đủ điều kiện.
