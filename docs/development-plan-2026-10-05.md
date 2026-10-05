# Kế hoạch cải thiện Sân Ngon — 05/10/2026

Ưu tiên hoàn thiện các luồng đang có. Mỗi mục có kiểm tra riêng, chạy lint,
typecheck và build, rồi commit/push `origin/main` trước khi chuyển mục tiếp.
Các thay đổi local có trước lượt rà soát này không tự động được coi là đã
kiểm tra hay bàn giao.

## Thứ tự thực hiện

| Thứ tự | Mục | Căn cứ trong code | Điều kiện hoàn thành | Trạng thái |
| --- | --- | --- | --- | --- |
| 1 | Hộp thông báo dễ theo dõi | `/thong-bao` đọc toàn bộ dữ liệu, thiếu lọc; bỏ qua lỗi query; đánh dấu đã đọc quay về đầu danh sách | 20 thông báo/trang; lọc chưa đọc; giữ bộ lọc/trang khi đánh dấu; phân biệt lỗi với danh sách trống; mở đúng đơn/giải | Đã hoàn thành |
| 2 | Phục hồi khi lỗi và đường dẫn sai | Chỉ chi tiết giải có `error.tsx`; chưa có trang 404 riêng | Thông báo tiếng Việt, thử lại, đường về tìm sân; không khuyến khích gửi lại tiền hoặc tạo lại đơn khi trạng thái chưa rõ | Chờ |
| 3 | Thông tin trang công khai khi chia sẻ/tìm kiếm | Chi tiết sân chưa có metadata riêng; chưa có sitemap/robots | Tiêu đề/mô tả đúng sân, chỉ đưa sân công khai vào sitemap; trang tài khoản/checkout không lập chỉ mục; không lộ thông tin cá nhân | Chờ |
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
