# Gửi thông báo bền vững

SQL tạo nhiệm vụ email/Telegram trong cùng transaction với thông báo đơn đã nhận
cọc, kể cả xác nhận tay; kết quả duyệt hồ sơ được đưa vào hàng đợi cùng bản ghi
`owner_application_reviews`. Không backfill đơn/hồ sơ lịch sử. Không gửi email
đặt sân cho người chơi. Webhook chỉ xử lý tiền và trả kết quả SQL, không gọi provider.

`notification_deliveries` là bảng riêng tư, browser không đọc/ghi trực tiếp. Payload
và liên hệ được giữ nguyên để thử lại; liên hệ đã đổi/tài khoản bị khóa bị bỏ qua.
Admin xem projection không chứa payload/email/chat tại `/admin/van-hanh`, thử lại
qua RPC kiểm quyền và thời điểm cập nhật, không dùng service role.

Worker `/api/sepay/notifications` kiểm Bearer secret trước khi mở client đặc quyền;
mỗi lượt nhận tối đa 3 tác vụ bằng `FOR UPDATE SKIP LOCKED`, lease 90 giây. Mỗi
provider timeout 10 giây. Lỗi tạm thời thử lại tối đa 6 lượt, giãn 2/4/8/16/32 phút;
lỗi cấu hình/quyền/đầu vào dừng để admin sửa rồi yêu cầu thử lại. Acknowledgement
cần đúng lease còn hiệu lực. Worker ngắt giữa chừng được nhận lại sau hạn lease.

Email dùng `Idempotency-Key: notification/<job UUID>` của Resend, hiệu lực 24 giờ.
Tác vụ email có kết quả không rõ vượt 23 giờ dừng để đối chiếu nhà cung cấp, không
tự gửi lại. Telegram không hỗ trợ khóa chống lặp: có thể nhận trùng nếu đã gửi
nhưng mất phản hồi; không hứa exactly-once. Log không ghi body provider, liên hệ,
payload hoặc URL chứa bot token. Inbox/thanh toán không phụ thuộc provider.

## Thiết lập production

1. Chạy `node scripts/configure-notification-worker.mjs --prepare` ở project đã
   đăng nhập Vercel. Script lưu secret ngẫu nhiên 256 bit ở
   `~/.local/state/san-ngon/notification-worker-secret` (0600), thêm biến Secret
   `NOTIFICATION_WORKER_SECRET` cho Production qua stdin. Sao lưu file này riêng.
2. Áp dụng migration `20261021000100_notification_delivery.sql` và deploy code đã
   kiểm tra. Không tự đưa thay đổi local của task khác vào bản deploy.
3. Chạy `node scripts/configure-notification-worker.mjs --activate --origin=https://san-ngon.vercel.app`.
   Script kiểm endpoint trả 401 khi không có key, bật `pg_net`, lưu cùng secret
   vào Supabase Vault, đặt cron `notification-delivery` mỗi phút. Secret không
   nằm trong command cron, tham số CLI hoặc output. Chạy lại giữ nguyên key.
4. Lần bật đầu, tác vụ đã có được giữ ở `failed/ROLLOUT_DELIVERY_REVIEW`: bản cũ
   có thể đã gửi trực tiếp, cần kiểm kênh nhận trước khi admin đưa lại vào hàng đợi.
   Tác vụ mới sau khi kích hoạt được gửi bình thường. Không thử worker có key chỉ
   để kiểm kết nối: lời gọi đó có thể gửi các tác vụ thật đang chờ.
5. Kiểm cron đang bật, `notification_worker_requests` có lượt gọi và trang Vận hành
   có kết quả gửi. SMTP Auth và nghiệm thu nhận email/Telegram thật vẫn là mục riêng.

Không tạo Vercel cron mỗi phút phụ thuộc gói trả phí. Supabase cron gọi worker
bằng `pg_net`; bảng request chỉ giữ ID/thời điểm, không lưu secret hay payload gửi.

## Kiểm tra

`check-notification-delivery.sql` chạy transaction rollback; kiểm nhiệm vụ/channel,
idempotency, lease/ack, backoff, tối đa số lượt, quyền, projection, đổi liên hệ và
reason hồ sơ. `check-notification-delivery.mjs` giả lập provider/worker, kiểm
timeout/header/auth/lỗi; không gửi thư hoặc Telegram thật. Bài browser dùng build
cô lập và Chromium headless, dữ liệu giả 390/1440, lỗi trạng thái và gửi lại có CAS.
