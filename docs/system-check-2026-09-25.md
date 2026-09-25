# Kiểm tra hệ thống — 25/09/2026

Phạm vi: bản build production chạy local với Supabase từ xa. Các bài SQL dùng
fixture trong transaction rồi rollback. Không gửi email/Telegram, không chuyển
khoản thật và không tạo đơn qua giao diện trong lượt kiểm tra này.

## Các lỗi đã sửa

- URL tìm sân có ngày sai, trang thập phân/quá lớn, môn không hợp lệ hoặc
  tham số lặp làm lỗi render: xác thực bằng Zod trước khi gọi RPC.
- `next` sau đăng nhập email/OTP chưa được giới hạn: dùng chung bộ kiểm tra
  đường dẫn nội bộ với callback OAuth.
- Mất mạng khi đặt sân làm nút gửi bị khóa: hiển thị lỗi và cho thử lại.
- Quay lại từ đăng nhập mất ngày đang xem, draft có thể hiện ở cụm khác:
  giữ query ngày và ràng buộc draft với đường dẫn cụm sân.
- Chuyển desktop/mobile mất lựa chọn: hai bố cục dùng chung một hook lịch.
- Webhook lấy mã đơn đầu tiên khi nội dung có nhiều mã, hoặc lấy tiền tố của
  mã quá dài: chỉ chấp nhận một mã hợp lệ, bỏ qua trường hợp mơ hồ.
- Chủ sân bị khóa vẫn gọi được RPC đóng/mở lịch và tạo kỳ phí: bổ sung
  trigger và RLS cho các bảng được thêm sau tính năng khóa tài khoản.
- Kiểm tra origin của phí dịch vụ/đăng xuất dùng địa chỉ listen nội bộ:
  đối chiếu với Host trình duyệt đang dùng, vẫn chặn origin bên ngoài.
- Next.js kéo PostCSS 8.4.31 có advisory: dùng bản 8.5.28 đã có trong cây
  dependency, không nâng major Next.js.

## Kiểm tra chạy lại

```bash
npm run lint
npm run typecheck
npm run build
npm audit --omit=dev
node scripts/check-request-inputs.mjs
node scripts/check-sepay-crypto.mjs
node scripts/check-sepay-provider.mjs
node scripts/check-subscription-reference.mjs
node scripts/check-realtime-session.mjs
node scripts/check-public-routes.mjs http://localhost:3000
node scripts/check-sepay-webhook.mjs http://localhost:3000
```

Các file SQL đã chạy trên database với rollback:
`check-booking-holds.sql`, `check-owner-subscriptions.sql`,
`check-sepay-registration.sql`, `check-required-venue-photos.sql`,
`check-venue-review.sql`, `check-admin-users.sql`, `check-court-prices.sql`,
`check-banned-owner-writes.sql` trong `scripts/`.

Kiểm tra Playwright có thể dùng page hiện có, không cần cài framework vào repo:

```js
const { default: checkBooking } = await import('./scripts/check-booking-browser.mjs');
await checkBooking(page, 'http://localhost:3000');
```

Bài này cần một cụm đang nhận đặt, kiểm tra chọn giờ qua hai kích thước màn
hình, lỗi mạng, redirect đăng nhập và khôi phục liên hệ. Request tạo đơn được
chặn bằng Playwright nên không ghi đơn vào database.

Đã kiểm tra cron hết hạn mỗi phút, cron hoàn tất đơn và publication realtime
cho bookings, notifications, owner_subscriptions, subscription_invoices.
Migration `20260925000005_banned_owner_writes.sql` đã áp dụng trên Supabase.

## Còn cần nghiệm thu thực tế

- Môi trường hiện thiếu RESEND_API_KEY/EMAIL_FROM. Supabase chưa có SMTP riêng;
  mẫu thư, độ dài và hạn OTP chưa khớp cấu hình 6 số/10 phút của giao diện.
  Không xác nhận luồng nhận email, đăng ký OTP hay khôi phục mật khẩu đã chạy
  end-to-end. Không tự tạo thông tin SMTP hoặc gửi thư tới người thật.
- Chưa thực hiện Google/SePay OAuth bằng tài khoản thật, chuyển khoản ngân
  hàng, nhận Telegram/email hay hoàn cọc thật. Kiểm tra SQL/webhook không thay
  thế bước nghiệm thu này; giữ nguyên cờ giới hạn nhiều chủ sân.
- Quyền chủ sân/admin được kiểm tra qua SQL và chặn truy cập HTTP; chưa duyệt
  từng màn hình quản trị bằng phiên đăng nhập của ba vai trò.
- Audit toàn bộ dependency còn cảnh báo ở công cụ phát triển/triển khai;
  không nâng major các CLI trong task sửa luồng sản phẩm.
