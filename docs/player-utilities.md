# Góp ý và tiện ích người chơi — 05/10/2026

## Các tính năng

| Tính năng | Vị trí | Hành vi |
| --- | --- | --- |
| Góp ý / báo lỗi | `/gop-y`, menu tài khoản, footer, trang liên hệ | Đăng nhập để gửi báo lỗi, đề xuất hoặc yêu cầu hỗ trợ; xem lịch sử và phản hồi riêng |
| Xử lý góp ý | `/admin/gop-y`, sidebar admin | Lọc theo trạng thái/loại, 20 yêu cầu mỗi trang, phản hồi và chuyển trạng thái |
| Sân yêu thích | Nút Lưu sân ở trang sân; `/san-yeu-thich` | Lưu theo tài khoản, tối đa 100 sân, bỏ lưu và mở lịch hiện tại |
| Chia sẻ sân | Trang chi tiết sân | Chia sẻ qua thiết bị nếu có; còn lại sao chép liên kết; hiện liên kết để sao chép thủ công nếu trình duyệt từ chối |
| Trung tâm trợ giúp | `/tro-giup`, footer, trang liên hệ | 14 câu hỏi, lọc chủ đề, tìm nhiều từ không cần dấu, mở câu trả lời bằng bàn phím |
| Đặt lại sân | Đơn của tôi | Mở sân công khai đã từng đặt để chọn giờ mới; không tự giữ chỗ hoặc dùng lại giá cũ |
| Tải lịch buổi chơi | Đơn đã xác nhận/hoàn tất ở Đơn của tôi | Tải `.ics` vào ứng dụng lịch, chỉ người đặt được tải |

## Quyền và nghiệp vụ

`feedback` chỉ người gửi và admin có tài khoản hoạt động được đọc. Không mở quyền ghi bảng; `submit_feedback` và `review_feedback` kiểm tra trong SQL. Nội dung là góp ý riêng về website, không phải đánh giá sao hoặc bình luận công khai. Không có đính kèm hoặc chat. Không gửi email/Telegram; người dùng xem phản hồi trong lịch sử góp ý, dữ liệu tải lại khi quay về tab hoặc nối mạng.

Mỗi người gửi tối đa 5 yêu cầu trong 24 giờ và có tối đa 10 yêu cầu chưa xử lý. SQL khóa hồ sơ để giới hạn chịu được gửi đồng thời. UUID của lần gửi bảo vệ retry khi mất mạng; cùng mã và cùng nội dung trả lại yêu cầu cũ. Tiêu đề 5–120 ký tự, nội dung 20–3.000 ký tự, phản hồi tối đa 2.000 ký tự. Kết thúc/đóng cần phản hồi ít nhất 5 ký tự. `updated_at` chống ghi đè khi hai admin xử lý từ màn hình khác nhau. Mỗi yêu cầu giữ phản hồi mới nhất, không phải chuỗi hội thoại.

Trang liên quan chỉ giữ đường dẫn nội bộ, không giữ query, fragment hoặc thông tin thiết bị. Người gửi tự mô tả mã đơn nếu cần; góp ý không tự hủy đơn, ghi nhận cọc hoặc hoàn tiền. Người vận hành cần đọc danh sách góp ý định kỳ vì chưa có cảnh báo ngoài website.

`venue_favorites` chỉ chính người dùng được đọc. `set_venue_favorite` dùng trạng thái lưu/bỏ lưu rõ ràng để retry không đảo trạng thái; chỉ lưu sân `active`, giới hạn 100 sân trong SQL. `get_my_favorites` che tên/địa chỉ/ảnh/slug khi sân không còn công khai, vẫn cho người dùng bỏ lưu. Sân yêu thích không giữ giờ, không cố định giá và không mở quyền nhận đơn. Danh sách tải lại khi quay về tab/nối mạng.

`get_booking_calendar` kiểm tra người đặt, trạng thái tài khoản và đơn `confirmed`/`completed`. Mốc thời gian được định dạng UTC trong SQL, không đổi múi giờ bằng JavaScript. Tệp không chứa số điện thoại, tài khoản ngân hàng hoặc QR. Nội dung được escape và gấp dòng theo 75 byte UTF-8 để tương thích tiếng Việt/RFC 5545; phản hồi không cache và không lập chỉ mục. Sự kiện có UID cố định theo đơn. Đây là bản chụp tại lúc tải, không phải lịch đăng ký đồng bộ: hủy đơn trên website không tự xóa sự kiện trong ứng dụng lịch.

Các API ghi kiểm tra đăng nhập và cùng origin. RPC chặn tài khoản bị khóa ngay cả với phiên JWT cũ. Góp ý, yêu thích và trang quản trị có chỉ dẫn không lập chỉ mục; sitemap thêm trang trợ giúp công khai.

## Triển khai

Hai migration: `20261005000010_feedback.sql` và `20261005000020_player_utilities.sql`. Đã áp dụng lên Supabase liên kết ngày 05/10/2026. Không thay cờ nghiệm thu, tài khoản nhận tiền hoặc chính sách hoàn cọc. Các kiểu của hai bảng và năm RPC mới được sinh từ database; những thay đổi local có trước trong file types được giữ riêng.

## Kiểm tra

```sh
npm run ci
npx supabase db query --linked --file scripts/check-player-utilities.sql
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
  node scripts/check-player-utilities-browser.mjs --live http://localhost:3120
```

Chạy bản production local trước khi kiểm tra trình duyệt. Chromium chạy headless với các context riêng; không dùng Chrome/cookie cá nhân. Script browser cần Supabase CLI đã đăng nhập/link và `.env.local` của đúng dự án. Có thể đặt `CHROMIUM_EXECUTABLE` và `UX_SCREENSHOT_DIR`; mặc định ảnh/kết quả ở `../outputs/player-utilities`.

SQL tạo dữ liệu tạm trong transaction rồi rollback: quyền đọc/ghi, retry, giới hạn ngày/yêu cầu mở/sân lưu, bản ghi không công khai, phản hồi cũ, tài khoản bị khóa và lịch riêng tư. Thông tin operator chỉ thay tạm trong transaction thử và được rollback; không mở cờ nhiều chủ sân.

Script browser tạo 3 tài khoản thử, một sân con không hoạt động ở sân đang nhận đơn và một đơn đã hoàn tất trong quá khứ. Không giữ lịch trống, gửi thư, chuyển tiền hoặc sửa cờ nghiệm thu. Chỉ thử phản hồi có UUID do script tạo. Dữ liệu được dọn trong `finally`; nếu bị dừng cưỡng bức, dùng `cleanup.sql` trong thư mục kết quả để xóa đúng UUID đã tạo. File kết quả không chứa mật khẩu/token.

Đã đạt lint, typecheck, production build; SQL rollback; luồng thật UI/API/RPC cho cả sáu nhóm tiện ích, quyền riêng tư và retry; bố cục 390/1440 px; clipboard thực và tìm trợ giúp không dấu/bàn phím. Đã xem ảnh trang góp ý điện thoại, trợ giúp desktop và giao diện xử lý admin. API cũng đã kiểm tra người chưa đăng nhập, origin khác và header không lập chỉ mục. Tệp `.ics` được kiểm tra nội dung/định dạng/quyền tải, chưa nghiệm thu nhập tệp trên mọi ứng dụng lịch.
