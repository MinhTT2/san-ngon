# Ảnh và video phần giới thiệu

Media dưới đây minh họa không khí thể thao, không đại diện cho một cụm sân
đang nhận đặt. Thẻ tìm sân và gallery địa điểm tiếp tục dùng ảnh thật của chủ sân.
Ngày bổ sung/kiểm tra nội dung: 08/10/2026. Theo yêu cầu người dùng, sử dụng
media trên mạng thay vì gọi API tạo ảnh/video (phiên làm việc không có công cụ
media tích hợp hoặc API key).

| Tệp | Nguồn | Quyền sử dụng |
| --- | --- | --- |
| `public/media/football-editorial.webp` | [Ảnh bóng đá trên Unsplash](https://images.unsplash.com/photo-1574629810360-7efbbe195018) | [Unsplash License](https://unsplash.com/license), cho phép tải và dùng cho mục đích thương mại; không dùng để quảng cáo người trong ảnh bảo chứng sản phẩm. |
| `public/media/badminton-editorial.webp` | [Ảnh cầu lông trên Unsplash](https://images.unsplash.com/photo-1626224583764-f87db24ac4ea) | [Unsplash License](https://unsplash.com/license). |
| `public/media/pickleball-editorial.webp` | [Pickleball Pros — Picklerpeej](https://commons.wikimedia.org/w/index.php?curid=107275576) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Xác minh qua [Openverse API](https://api.openverse.org/v1/images/9fd4c22e-08c6-43e4-8ae0-519b97937e22/). Phiên bản WebP đổi kích thước và cắt khung hiển thị cũng theo CC BY-SA 4.0; ghi tác giả/giấy phép/thay đổi ở `/nguon-hinh-anh`, liên kết từ footer. |
| `public/videos/soccer-one-on-one.mp4` | [One on one in a soccer game — Mixkit](https://mixkit.co/free-stock-video/one-on-one-in-a-soccer-game-43483/) | Trang clip ghi [Mixkit Stock Video Free License](https://mixkit.co/license/#videoFree). Đổi bản 360p hiện có sang bản 720p cùng clip. |
| `public/media/soccer-poster.webp` | Thumbnail 720p từ trang clip Mixkit ở trên. | Cùng giấy phép clip. |

Ảnh đã đổi sang WebP và giới hạn chiều rộng để tải nhanh. Video lưu tại dự án,
chỉ tải khi khối giới thiệu vào màn hình, dừng khi đổi tab/rời khung nhìn, và
không tự chạy khi giảm chuyển động hoặc tiết kiệm dữ liệu. Video nền không có
nút dừng/phát, tự điều khiển theo khung nhìn và trạng thái tab.
Carousel có mũi tên chuyển thủ công; tự chuyển dừng khi rê chuột, focus hoặc
chọn ảnh bằng tay.

Cả ba môn dùng ảnh minh họa. Chỉ ảnh Wikimedia có giấy phép thương mại đã
xác minh qua Openverse được đưa vào sản phẩm.
Khi có bộ ảnh sân thật được chủ sân cho phép dùng ở trang chủ, có thể thay các
ảnh minh họa; không đổi ảnh xác thực của địa điểm bằng ảnh stock.

## Video đồ họa sân chuyển động

`public/videos/court-flow.webm` và poster `public/media/court-flow.webp` là
đồ họa gốc được vẽ cho Sân Ngon bằng canvas, không phải cảnh quay một cụm sân.
Video dài 12 giây, 960 × 540, 24 fps, không âm thanh và lặp liên tục. Đường
sân và quỹ đạo bóng dùng màu trong design system. Tạo lại bằng
`scripts/generate-court-film.mjs` trong Chromium headless riêng.

Dùng tại phần mở đầu tìm sân và kết nối trên desktop. Video chỉ tải khi vào
khung nhìn, dừng khi ra ngoài màn hình hoặc đổi tab; chế độ giảm chuyển động,
tiết kiệm dữ liệu và không có JavaScript dùng poster. Video nền không có nút
dừng/phát; tải lỗi vẫn giữ poster. Không cần API hoặc thêm thư viện animation.
