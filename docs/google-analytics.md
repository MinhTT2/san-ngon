# Google Analytics 4

Mã đo lường của Sân Ngon: `G-0BN7KY5V59`. Đây là mã công khai, không phải khóa bí mật.

## Cấu hình Production

1. Trong Google Analytics, mở **Quản trị → Luồng dữ liệu → luồng website** và **tắt Tính năng đo lường nâng cao**. Website tự gửi lượt xem; đo tự động có thể đếm trùng hoặc thu thập URL/tương tác ngoài phạm vi đã chọn. Không thêm một Google tag hoặc Google Tag Manager khác vào website.
2. Trên Vercel, dự án `san-ngon`, thêm `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-0BN7KY5V59` cho **Production**, rồi triển khai lại. Biến `NEXT_PUBLIC_*` được đóng vào bản build; chỉ đổi biến mà không build lại chưa có hiệu lực.
3. Chỉ chạy khi `VERCEL_ENV=production`, mã hợp lệ và origin chính xác là `https://san-ngon.vercel.app`. Local, Preview, domain khác hoặc thiếu/sai mã đều không tải script.

## Dữ liệu và giới hạn

- Đo trang chủ, `/tim-san`, `/san/[slug]`, danh sách `/giai-dau`, `/ket-noi`, liên hệ, trợ giúp, chính sách, điều khoản và nguồn hình ảnh. Route mới mặc định không được đo.
- Không đo checkout, đăng nhập/đăng ký, tài khoản, đơn, hỗ trợ giao dịch, hồ sơ người chơi, chi tiết/quản lý giải, khu chủ sân và admin. Chuyển vào các route này đặt cờ `ga-disable-<ID>` kể cả khi SDK đã tải.
- Mỗi lần vào/chuyển pathname công khai gửi một `page_view`; Back/Forward được tính như chuyển trang. Đổi bộ lọc/query/hash không tính thêm lượt xem. SDK tải chậm chỉ ghi nhận trang hiện tại khi sẵn sàng, không gửi lại các trang đã rời đi.
- URL gửi đi không có query/hash; tiêu đề dùng nhãn cố định. Referrer ngoài chỉ giữ origin; referrer nội bộ chỉ giữ pathname thuộc danh sách công khai, còn lại chỉ giữ origin. Không có user ID, dữ liệu biểu mẫu, mã đơn hoặc sự kiện thanh toán. Không bật Google Signals/cá nhân hóa quảng cáo trong cấu hình code.
- GA4 có thể ghi nhận nguồn giới thiệu, thiết bị và cookie phân biệt lượt truy cập. Query UTM không được chuyển tiếp, nên bản này không cung cấp phân tích chiến dịch UTM. Dữ liệu GA4 không phải sổ đơn hàng hay nguồn doanh thu đối soát.

## Nghiệm thu

- Chạy lint, typecheck, build bằng Node 24 và `node scripts/check-google-analytics.mjs` theo hướng dẫn đầu script. Script dùng Chromium headless/context riêng; mọi endpoint thu thập Google phải được chặn hoặc giả lập.
- Kiểm tra tải trực tiếp, chuyển trang, Back/Forward, đổi query/hash, công khai → riêng tư → công khai, vào riêng tư trước khi SDK tải xong, local/Preview, thiếu/sai mã và Google bị chặn. Không dùng tài khoản hay trình duyệt cá nhân.
- Sau triển khai, dùng phiên thử trên website và xem **Báo cáo → Thời gian thực** trong đúng property GA4. Lượt xem phải xuất hiện với trang đã làm sạch. Báo cáo tổng hợp thường cần 24–48 giờ.
- Request/kiểm thử giả lập thành công chỉ chứng minh tích hợp phía website. Chỉ đánh dấu nghiệm thu GA4 thật khi đã thấy dữ liệu trong property; ghi riêng trạng thái này trong báo cáo bàn giao.

Để tắt: xóa biến Production và triển khai lại. Không cần migration hay sửa dữ liệu Supabase.

## Kết quả kiểm tra ngày 19/10/2026

- Bản chỉ chứa thay đổi GA4 trên nền `main` đạt lint (không cảnh báo), typecheck, production build bằng Node 24.18.0 và kiểm thử Chromium headless với SDK giả lập. Bản local đầy đủ cũng đạt lint/typecheck/build; lint local có 46 cảnh báo sẵn trong các kết quả kiểm thử cũ ở `output/`.
- Đã kiểm tra chuyển trang thật của Next.js, Back/Forward, reload, query/hash, vào trang riêng tư trước/sau khi SDK tải, quay lại trang công khai, Google bị chặn, hostname local/Preview và môi trường server Preview. Không gửi request thu thập thử đến GA4 thật.
- Kiểm tra SDK Google thật với request thu thập bị chặn phát hiện `page_referrer` vẫn có query do tính năng tự động của luồng đang hoạt động. Vì vậy **chưa nghiệm thu SDK thật và chưa nghiệm thu dữ liệu trong GA4**. Cần tắt toàn bộ Tính năng đo lường nâng cao rồi chạy lại với `GA4_TEST_REAL_SDK=1`.
- Production tạm để trống biến đo lường trong lúc chờ cấu hình GA4. Code sẵn sàng kích hoạt bằng biến Production và bản deploy mới sau khi kiểm tra SDK thật đạt. Không bật thu thập trước bước này.
