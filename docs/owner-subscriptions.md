# Phí sử dụng website của chủ sân

- Admin mở `/admin/phi-dich-vu`, bật **299.000đ/tháng** cho từng chủ sân đã
  duyệt. Mặc định miễn phí. Bật khi chưa có hạn đã đóng sẽ chặn ngay việc
  đăng sân, công khai sân nháp, thêm/mở sân con và nhận đơn mới.
- Chủ sân mở `/chu-san/phi-dich-vu`, lấy QR và chuyển đúng 299.000đ với mã
  `PHIxxxxxxxx`. Một tài khoản trả một phí cho tất cả cụm sân.
- SePay tự gia hạn khi đủ tiền trong một giao dịch. Gia hạn sớm cộng tiếp
  từ hạn cũ; hết hạn tính một tháng lịch từ lúc nhận tiền (giờ Việt Nam).
- Đơn cũ vẫn được xác nhận cọc, hủy, hoàn và xem lịch. Không tự hủy đơn hoặc
  thay tài khoản nhận cọc vì chủ sân hết hạn phí. Miễn phí không xóa số ngày
  đã đóng và không mở nhiều chủ sân vượt cờ nghiệm thu hiện tại.

`subscription_receiver` được chốt vào tài khoản SePay hiện tại khi áp dụng
migration. Mỗi kỳ phí sao chép ngân hàng, số tài khoản, người nhận và kết nối.
Không đổi tài khoản nhận phí bằng cách sửa người nhận cọc trong hồ sơ.
Chỉ đổi bằng SQL có kiểm soát sau khi đối soát các kỳ chờ; giữ webhook của
các kỳ cũ. Nút ngắt kết nối bị chặn với tài khoản đang nhận phí website.

Admin xem giao dịch thiếu, thừa hoặc chuyển trùng ở cuối trang phí chủ sân.
Hệ thống không cộng các khoản thiếu, không gia hạn lần hai cùng một kỳ phí,
không tự hoàn tiền. Đối soát và hoàn phần chuyển nhầm/thừa thủ công. Thông
báo webhook retry không tạo thêm giao dịch hay tăng thêm thời hạn.

Kiểm tra (SQL tạo dữ liệu thử rồi rollback):

```sh
npm run ci
node scripts/check-subscription-reference.mjs
npx supabase db query --linked --file scripts/check-owner-subscriptions.sql
npx supabase db query --linked --file scripts/check-booking-holds.sql
node scripts/check-sepay-webhook.mjs http://localhost:3000
```

Nghiệm thu chuyển khoản thật: admin bật thu phí cho tài khoản thử đã duyệt,
lấy QR, kiểm tra người nhận và mã phí rồi chuyển 299.000đ. Kiểm tra trang chủ
sân tự hiện hạn mới, admin thấy đúng giao dịch và chỉ gia hạn một lần. Kiểm
thử SQL/webhook giả lập không thay thế bước chuyển khoản thật này.
