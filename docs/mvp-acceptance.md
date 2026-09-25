# Nghiệm thu MVP ngày 25/09/2026

## Đã kiểm tra

- Lint, typecheck và build đạt trên workspace khi hoàn thiện bảng giá.
- `scripts/check-court-prices.sql`: thêm/sửa/xóa mức giá theo ngày/giờ,
  bảo vệ giá chung, từ chối người không sở hữu sân và đầu vào không hợp lệ.
- `scripts/check-admin-users.sql`: chặn người chơi gọi quản trị, bảo vệ
  thao tác tự khóa, tạo/sửa/khóa/mở/xóa tài khoản thử, chặn ghi từ JWT cũ.
- `scripts/check-booking-holds.sql`: giá server, giữ chỗ, chống trùng bằng
  GiST, hết hạn, webhook muộn và retry.
- `scripts/check-owner-subscriptions.sql`: phí tháng, gia hạn, retry,
  sai người nhận, thiếu tiền và xử lý đơn cũ khi hết hạn phí.
- `scripts/check-sepay-registration.sql`: kết nối trong hồ sơ pending,
  quyền truy cập và điều kiện duyệt chủ sân.
- `node scripts/check-email.mjs`: payload, thiếu cấu hình, lỗi nhà cung cấp,
  timeout và escape HTML; không gửi email thật.

Các script SQL chạy trong transaction rồi rollback. Các kết quả này không
thay thế kiểm thử trình duyệt hoặc chuyển khoản thật.

## Điểm chặn bên ngoài code

Kiểm tra bằng `node scripts/configure-auth-email.mjs` ngày 25/09 cho thấy
Supabase liên kết chưa có SMTP riêng; giới hạn gửi 2 email/giờ. OTP và mẫu
thư xác nhận chưa khớp giao diện. Môi trường local cũng chưa có
`RESEND_API_KEY` và `EMAIL_FROM`. Không suy ra cấu hình Vercel từ local.

Người vận hành cần cấu hình tên miền gửi email đã xác minh và khai báo hai
biến trên trong môi trường local/Vercel, không gửi khóa qua chat hoặc Git.
Sau đó chạy `node scripts/configure-auth-email.mjs --apply`, rồi chạy lại
lệnh không có `--apply` để kiểm tra. Xác nhận email đăng ký dùng mã OTP 6 số;
email khôi phục mật khẩu dùng liên kết xác thực (giữ `ConfirmationURL` trong
mẫu recovery). Cho phép `/auth/callback` trên domain thật trong Supabase
Redirect URLs. Kiểm tra nhận thư bằng tài khoản của người nghiệm thu.

Chốt với chủ sân mốc hoàn cọc (hiện 2 giờ) và người thực hiện chuyển hoàn
cho từng tài khoản nhận cọc. Chưa thay đổi mốc SQL khi chưa có quyết định.

## Kịch bản nghiệm thu trên domain thật

Ghi người thử, ngày giờ và mã đơn/giao dịch vào biên bản riêng. Không ghi
mật khẩu, token hoặc giấy tờ vào repo.

1. Đăng ký → nhận OTP → đăng nhập → đăng xuất; thử quên mật khẩu, liên kết
   hết hạn và mật khẩu nhập lại sai. Đăng nhập lại bằng mật khẩu mới.
2. Gửi hồ sơ chủ sân → OAuth → chọn tài khoản → admin đọc giấy tờ và duyệt.
   Người pending không tạo sân hoặc nhận đơn được.
3. Tạo cụm nháp → thêm sân → lưu 3–8 ảnh thật → tìm thấy sân công khai.
   Thêm giá ngày/giờ, sửa, xóa; kiểm tra giá hiển thị và tiền cọc của đơn mới.
4. Hai tài khoản cùng đặt một khung: chỉ một đơn thành công. Hủy hoặc chờ
   hết 15 phút: khung mở lại. Kiểm tra trên desktop và điện thoại.
5. Người giữ tài khoản tự kiểm tra QR/tên người nhận và chuyển đúng số cọc,
   đúng mã đơn. Checkout, đơn người chơi và chủ sân tự cập nhật. Thử mất mạng
   rồi kết nối lại. Đối soát webhook retry không ghi thanh toán trùng.
6. Hủy trước/sau mốc hoàn cọc; chủ sân hủy; tiền vào muộn. Khoản cần hoàn
   chỉ được đánh dấu đã hoàn sau khi người vận hành thực sự chuyển tiền.
7. Khóa/mở lịch; thử đặt vào khoảng khóa; kiểm tra thông báo và Telegram.
8. Nếu bật thu phí trong demo: tạo kỳ phí 299.000đ, kiểm tra người nhận rồi
   người giữ tài khoản chuyển tiền. Xác nhận hạn mới ở chủ sân/admin và
   retry không gia hạn lặp. Nếu chưa nghiệm thu, giữ tài khoản miễn phí.

Giữ `multi_owner_enabled = false` cho đến khi nghiệm thu OAuth, QR và chuyển
khoản thật theo [vận hành SePay](sepay-single-owner.md). Không coi HTTP 200
của webhook là bằng chứng thanh toán: phải đối chiếu `reason`, trạng thái đơn
và tiền vào ngân hàng.
