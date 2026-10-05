# Kế hoạch cải thiện Sân Ngon — 05/10/2026

Ưu tiên hoàn thiện các luồng đang có. Mỗi mục có kiểm tra riêng, chạy lint,
typecheck và build, rồi commit/push `origin/main` trước khi chuyển mục tiếp.
Các thay đổi local có trước lượt rà soát này không tự động được coi là đã
kiểm tra hay bàn giao.

## Thứ tự thực hiện

| Thứ tự | Mục | Căn cứ trong code | Điều kiện hoàn thành | Trạng thái |
| --- | --- | --- | --- | --- |
| 1 | Hộp thông báo dễ theo dõi | `/thong-bao` đọc toàn bộ dữ liệu, thiếu lọc; bỏ qua lỗi query; đánh dấu đã đọc quay về đầu danh sách | 20 thông báo/trang; lọc chưa đọc; giữ bộ lọc/trang khi đánh dấu; phân biệt lỗi với danh sách trống; mở đúng đơn/giải | Đã hoàn thành |
| 2 | Phục hồi khi lỗi và đường dẫn sai | Chỉ chi tiết giải có `error.tsx`; chưa có trang 404 riêng | Thông báo tiếng Việt, thử lại, đường về tìm sân; không khuyến khích gửi lại tiền hoặc tạo lại đơn khi trạng thái chưa rõ | Đã hoàn thành |
| 3 | Thông tin trang công khai khi chia sẻ/tìm kiếm | Chi tiết sân chưa có metadata riêng; chưa có sitemap/robots | Tiêu đề/mô tả đúng sân, chỉ đưa sân công khai vào sitemap; trang tài khoản/checkout không lập chỉ mục; không lộ thông tin cá nhân | Đã hoàn thành |
| 4 | Rà thao tác vận hành của chủ sân | Đã có đơn/lịch/giá/hoàn cọc nhưng chưa có biên bản quan sát người dùng | Quan sát 3–5 người làm tác vụ thật; ưu tiên điểm họ mắc; chỉ thêm lọc, tìm mã đơn hoặc xuất dữ liệu nếu thao tác hiện có chưa đáp ứng | Chờ dữ liệu sử dụng |

## Nghiệm thu vận hành — cần làm song song

- Email đăng ký/khôi phục: xác minh SMTP, mẫu OTP và nhận thư trên domain thật;
  kiểm tra hiện có không chứng minh người dùng nhận được thư.
- SePay: OAuth, đúng người nhận trên QR, chuyển khoản thật, retry, tiền muộn,
  hoàn tiền thủ công; giữ `multi_owner_enabled = false` đến khi nghiệm thu.
- Đặt trùng: hai tài khoản đặt cùng khung, chỉ một đơn thành công; kiểm tra
  lịch mở lại sau hủy/hết giữ chỗ và cập nhật realtime khi nối lại mạng.
- Chốt mốc hoàn cọc đơn sân (hiện 2 giờ) và người chịu trách nhiệm chuyển hoàn.
- Dùng ảnh thật của sân đã onboard để thay minh họa khi có ảnh phù hợp.

Ghi kết quả theo [checklist MVP](mvp-acceptance.md),
[SePay](sepay-single-owner.md) và [giải đấu/kết nối](tournaments-community.md).
Không đổi chính sách tiền, mở nhiều chủ sân hoặc coi bước thử thật đã đạt
chỉ từ kiểm tra code.

## Mở rộng sau khi có nhu cầu

Có thể xem xét sân yêu thích/đặt lại nhanh khi người chơi quay lại nhiều;
xuất báo cáo khi chủ sân cần đối soát ngoài website; hỗ trợ lịch đặt định kỳ
khi có yêu cầu cụ thể và đã chốt cách cọc/hủy từng buổi. Đây là các ứng viên,
chưa phải hạng mục triển khai ngay.

Bản đồ, đánh giá, chat/ghép đối, ví, hoàn tự động và app native tiếp tục nằm
ngoài phạm vi hiện tại theo `AGENTS.md`. Không thêm thư viện, ORM hay chuyển
nghiệp vụ giá/lịch/thanh toán từ SQL sang TypeScript.

## Tiến độ mục 2

Đã thêm trang lỗi chung và 404 bằng tiếng Việt: thử lại, về tìm sân và kiểm tra đơn trước khi chuyển thêm tiền. Ngày 05/10/2026, WSL hoạt động lại; lint, typecheck và production build đạt trên Node.js 24. Chromium headless với phiên riêng kiểm tra HTTP 404, nội dung, không tràn ngang và điều hướng về tìm sân ở 390/1440 px. Màn hình lỗi chung dùng cơ chế reset và refresh hiện có ở chi tiết giải; chưa giả lập lỗi server trong trình duyệt.

## Tiến độ mục 3

Ngày 05/10/2026: metadata riêng cho sân hoạt động gồm tiêu đề, mô tả, canonical không phụ thuộc ngày đang chọn, Open Graph và ảnh thật đầu tiên nếu có. Sitemap đọc bằng anon, chỉ lấy sân active, phân trang 1.000 dòng và báo lỗi nếu truy vấn hỏng; không liệt kê hồ sơ cộng đồng cá nhân. Robots hướng dẫn crawler bỏ qua trang riêng tư; X-Robots-Tag noindex, nofollow áp dụng cho tài khoản, checkout, quản lý và API/auth. Những chỉ dẫn này không thay thế xác thực/RLS.

Lint, typecheck và production build đạt. Kiểm tra HTTP và Chromium headless riêng trên bản production local đạt: sitemap, robots, header noindex của sáu nhóm trang riêng tư; tiêu đề/mô tả/Open Graph đúng tên sân và canonical giữ nguyên khi đổi tham số ngày. Chưa xác nhận công cụ tìm kiếm đã lập chỉ mục hoặc ứng dụng mạng xã hội đã cập nhật cache. Môi trường deploy cần NEXT_PUBLIC_SITE_URL là domain thật.

## Bước tiếp theo

Mục 4 cần quan sát 3–5 người dùng thật: chủ sân tìm đơn theo mã, khóa/mở lịch, thay bảng giá và ghi nhận hoàn cọc; người chơi tìm sân, giữ chỗ và kiểm tra đơn. Ghi tác vụ, thời gian, điểm dừng/hỏi và khả năng hoàn thành; ưu tiên lỗi tái diễn trước khi thêm tính năng. Không dùng kết quả kiểm tra tự động để thay bằng chứng sử dụng thực tế. Nghiệm thu email/ngân hàng và chốt chính sách hoàn tiếp tục theo checklist vận hành phía trên.
