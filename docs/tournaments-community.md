# Giải đấu và kết nối cộng đồng

Yêu cầu: [tài liệu ngày 29/09/2026](https://docs.google.com/document/d/10FhNFapsJhfFWYYydJ3TvabxzZEqmAOfQGoMoB1nMuA/edit).

## Giải đấu

- `/giai-dau`: xem, lọc môn, phân trang, theo dõi các giải đã đề xuất và đăng ký.
- `/giai-dau/tao`: chủ sân chọn sân của mình; người chơi mô tả địa điểm mong muốn để admin bố trí.
- `/admin/giai-dau`: admin mở đề xuất, chọn sân đúng môn, duyệt hoặc từ chối kèm lý do. Duyệt khóa lịch sân bằng `court_closures`; không thể duyệt trùng đơn đặt hoặc khung đã khóa. Người đề xuất nhận quyền quản lý giải, không được đổi role tài khoản.
- `/chu-san/giai-dau`: chủ sân thấy giải ở sân mình và giải mình đề xuất. Trang chi tiết dùng chung cho chủ sân, người tổ chức, admin và người tham gia; SQL quyết định quyền.
- Mỗi tài khoản đăng ký một suất, có họ tên, điện thoại, địa chỉ, tên đội và ghi chú. Thể lệ ghi rõ suất là một người hay một đội. Duyệt đăng ký giữ một suất đến hạn đóng cọc; số suất đã duyệt không vượt quy mô.
- Sau khi duyệt tham gia, hệ thống cấp QR nếu giải yêu cầu cọc. Cọc và lệ phí lấy từ giải đã được admin duyệt; không nhận số tiền do người tham gia gửi lên. Phần còn lại thu tại giải.
- Hủy giải trước giờ bắt đầu trả lịch sân và ghi nhận cần hoàn các khoản đã nhận. Hủy suất trước giờ bắt đầu cũng ghi nhận hoàn cọc. Chủ sân thực hiện hoàn qua ngân hàng rồi đánh dấu; người tổ chức được admin giao quản lý không thể tự xác nhận chủ sân đã hoàn tiền.

## Cọc SePay

Mã `GIAI` + 12 ký tự hex, tách biệt mã `SAN` và `PHI`. `tournament_registrations` đóng băng lệ phí, cọc, kết nối, ngân hàng, số tài khoản và tên người nhận khi duyệt. Người nhận là chủ sân tổ chức, kể cả người đề xuất là người chơi. Dùng kết nối SePay sẵn có, giữ nguyên cờ nghiệm thu nhiều chủ sân và kiểm tra phí sử dụng website.

`confirm_tournament_payment` chỉ service role gọi được, qua webhook hiện tại. Phải đúng kết nối/tài khoản và đủ cọc trong một giao dịch trước hạn; không cộng dồn khoản thiếu. Tiền thiếu, thừa, trùng, chuyển sau hạn hoặc sau hủy đều có sổ giao dịch và số tiền cần hoàn. Hoàn một phần dư rồi hủy suất vẫn tính đúng phần cọc còn cần hoàn.

`sepay_transfer_claims` chống dùng lại cùng giao dịch cho ba luồng cọc sân, cọc giải và phí dịch vụ. Retry không ghi nhận tiền hai lần. Không thể ngắt SePay khi còn QR giải được duyệt và còn hạn thanh toán. Trang giải nghe realtime, đồng bộ khi quay lại tab, có mạng hoặc tới hạn đăng ký.

Thông tin người đăng ký chỉ được đọc bởi chính họ, người quản lý, chủ sân liên quan và admin. Không công khai số điện thoại danh sách tham gia. Payload ngân hàng thô không cấp quyền đọc cho trình duyệt.

## Kết nối

`/ket-noi` cho xem hồ sơ, lọc môn/khu vực và phân trang. Mở hồ sơ để thấy điện thoại, Zalo, Facebook, vị trí, trình độ và giới thiệu. Ảnh dùng ảnh đại diện tài khoản.

`/ket-noi/ho-so` lưu thông tin công khai riêng với `profiles`. Mặc định ẩn; người dùng phải chọn đồng ý công khai. Bỏ chọn là ẩn ngay, tài khoản bị khóa cũng bị ẩn. Không có chat nội bộ, tự ghép đối hoặc bản đồ.

## Đăng nhập, OTP và thống kê

Đăng nhập/xác thực thành công tải lại trang đích để header đọc phiên mới. Người đã đăng nhập được chuyển khỏi `/dang-nhap` và `/dang-ky`. Form phục hồi sau lỗi mạng, trim email, chấp nhận mã 6–8 chữ số theo email; server vẫn kiểm tra mã.

OTP cần SMTP Supabase riêng. Kiểm tra bằng `node scripts/configure-auth-email.mjs`; cấu hình `RESEND_API_KEY` và `EMAIL_FROM` thuộc tên miền đã xác minh rồi chạy `node scripts/configure-auth-email.mjs --apply`. Khóa Secret trên Vercel không được tải về bằng `vercel env pull`. Cấu hình SMTP thực tế và nghiệm thu nhận email vẫn cần thông tin gửi thư. Không coi việc có form OTP là đã sửa xong gửi thư.

Bộ lọc thống kê giữ tham số `venue` khi thêm `period`. `get_owner_period_stats` tính ngày Việt Nam trong SQL và gọi thống kê cũ; 7/30/90 ngày thực sự đổi khoảng truy vấn.

## Kiểm tra

```sh
npm run lint
npm run typecheck
npm run build
node scripts/check-doc-requirements.mjs
npx supabase db query --linked --file scripts/check-tournaments.sql
npx supabase db query --linked --file scripts/check-community.sql
node scripts/check-public-routes.mjs http://localhost:3100
node scripts/check-sepay-webhook.mjs http://localhost:3100
```

Các kiểm tra SQL dùng dữ liệu tạm rồi rollback. Kiểm tra luồng cọc qua webhook giả không thay thế nghiệm thu một giao dịch ngân hàng thật trước khi mở nhận tiền.
