# Cải thiện giao diện và chất lượng — 12/10/2026

Phạm vi là 20 hạng mục người dùng đã chấp thuận. Giữ giá/quyền/lịch/thanh toán trong SQL, checkout realtime và phong cách nền phẳng của Sân Ngon. Thay đổi local có trước task được giữ ngoài các commit bàn giao.

## Mốc 1 — ảnh, trang chủ và chữ

- Carousel ưu tiên ảnh của cụm sân đang active, có sân con active đúng môn; dẫn đến lịch của địa điểm và ghi rõ tên cụm. Ảnh ở cấp cụm, không gán thành ảnh một sân con. Khi thiếu ảnh, giữ media giới thiệu đã có và ghi rõ ảnh minh họa; không thêm ảnh stock.
- Thẻ sân, gallery và thumbnail dùng kích thước ảnh phù hợp qua bộ tối ưu hiện có. Ảnh gốc vẫn dùng khi mở trình xem/phóng to. Ảnh preview lỗi có hướng dẫn mở ảnh gốc.
- Allowlist tối ưu chỉ bucket venue-photos công khai của project đã cấu hình, không nhận giấy tờ hoặc URL có token.
- Hai font hiện tại được phục vụ từ website, có bộ dấu tiếng Việt/Latin và giấy phép SIL OFL. Không gọi Google Fonts khi xem trang hoặc build.
- Footer mobile chia liên kết hỗ trợ thành hai cột, vùng bấm 44px; desktop giữ bố cục gọn.
- Đạt: lint/typecheck, build production cô lập; trang chủ 320/390/768/1024/1440px và no-JS; tối ưu ảnh thật, chặn bucket riêng/URL ký; chọn môn, gallery zoom/focus và giảm chuyển động. Bài trang chủ phát hiện footer quá cao, đã sửa bố cục và chạy lại đạt.

## Mốc 2 — lịch, biểu mẫu và trạng thái tải

- Chú giải lịch có chữ và ký hiệu cho còn sân/đang chọn/không thể đặt/giờ vàng; giữ token hiện tại. Thanh chọn nhanh trên mobile có cả tên sân con.
- Lỗi số điện thoại nằm cạnh ô nhập, liên kết với screen reader và trả focus; thông tin khác giữ nguyên. Không gửi API nếu số không hợp lệ. Khi đang gửi hoặc chưa rõ kết quả, giữ nguyên nội dung đã gửi để khôi phục đúng lần đặt.
- Skeleton có cấu trúc tương ứng với trang sân, lịch và dashboard; chỉ thông báo tải, không dựng dữ liệu/nút tương tác giả. Chế độ giảm chuyển động không nhấp nháy.
- Tiêu đề ngắt dòng cân đối, văn bản dài xuống dòng; ô nhập mobile tối thiểu 16px, vẫn tôn trọng chữ lớn theo cấu hình người dùng.
- Tìm sân giữ kết quả cũ khi đang tải bộ lọc mới; keyed fieldset áp dụng mặc định URL, bỏ reset sau hydration để tránh xóa thao tác mới nhập.
- Đạt: production build lint/typecheck; lựa chọn lịch/gallery/motion; lỗi liên hệ và khôi phục UUID đơn; tìm sân/lưu sân/giữ bộ lọc/no-JS; checkout 320–1440px, realtime/read race, QR lỗi, mất mạng và không polling. Mọi ghi/QR được giả lập.
- Bài tìm sân phát hiện loading boundary mới ở /tim-san làm yêu cầu RSC bị hủy khi chuyển bộ lọc có phản hồi chậm. Bỏ boundary đó và chạy lại toàn bộ check-player-discovery trên cùng production build cô lập: đạt. Skeleton không được dùng để đánh đổi khả năng tìm kiếm.
