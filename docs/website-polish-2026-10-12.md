# Cải thiện giao diện và chất lượng — 12/10/2026

Phạm vi là 20 hạng mục người dùng đã chấp thuận. Giữ giá/quyền/lịch/thanh toán trong SQL, checkout realtime và phong cách nền phẳng của Sân Ngon. Thay đổi local có trước task được giữ ngoài các commit bàn giao.

## Mốc 1 — ảnh, trang chủ và chữ

- Carousel ưu tiên ảnh của cụm sân đang active, có sân con active đúng môn; dẫn đến lịch của địa điểm và ghi rõ tên cụm. Ảnh ở cấp cụm, không gán thành ảnh một sân con. Khi thiếu ảnh, giữ media giới thiệu đã có và ghi rõ ảnh minh họa; không thêm ảnh stock.
- Thẻ sân, gallery và thumbnail dùng kích thước ảnh phù hợp qua bộ tối ưu hiện có. Ảnh gốc vẫn dùng khi mở trình xem/phóng to. Ảnh preview lỗi có hướng dẫn mở ảnh gốc.
- Allowlist tối ưu chỉ bucket venue-photos công khai của project đã cấu hình, không nhận giấy tờ hoặc URL có token.
- Hai font hiện tại được phục vụ từ website, có bộ dấu tiếng Việt/Latin và giấy phép SIL OFL. Không gọi Google Fonts khi xem trang hoặc build.
- Footer mobile chia liên kết hỗ trợ thành hai cột, vùng bấm 44px; desktop giữ bố cục gọn.
- Đạt: lint/typecheck, build production cô lập; trang chủ 320/390/768/1024/1440px và no-JS; tối ưu ảnh thật, chặn bucket riêng/URL ký; chọn môn, gallery zoom/focus và giảm chuyển động. Bài trang chủ phát hiện footer quá cao, đã sửa bố cục và chạy lại đạt.
