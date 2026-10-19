# Cập nhật dữ liệu theo Docs ngày 19 tháng 10 năm 2026

Nguồn: https://docs.google.com/document/d/1yB2-cRLPRcOWGUNOk3-JYiGBeccqdX9BvN8Pra_WPD8/edit

Người dùng xác nhận T4–CN thuộc tuần trước: 14–18/10/2026.

| Cụm sân | 14/10 T4 | 15/10 T5 | 16/10 T6 | 17/10 T7 | 18/10 CN | Tổng |
| --- | --- | --- | --- | --- | --- | --- |
| King Club Pickleball | 1 | 2 | 0 | 3 | 1 | 7 |
| Sân bóng 5 Cửa Ô | 1 | 0 | 1 | 2 | 2 | 6 |
| Sân cầu lông Bao Cấp | 0 | 0 | 0 | 2 | 2 | 4 |

Docs không quy định giờ chơi, khách hoặc trạng thái. Bản nhập dùng năm tài
khoản `(Demo)` đã có, mỗi đơn một khung một giờ từ 18h, trạng thái
`completed`. Giá lấy trực tiếp từ `get_venue_availability`, cọc bằng toàn bộ
tiền sân. Tất cả đơn có ghi chú `Docs 2026-10-19 · Dữ liệu demo, không phải
giao dịch ngân hàng`. Không tạo bản ghi payments, không đặt paid_at, không
gửi email/Telegram, không tính các đơn này vào doanh thu đã thu qua website.
Các trigger kiểm tra người nhận, snapshot, phí chủ sân vẫn chạy bình thường.

Ngày gửi hồ sơ Hieu Trinh là 10/10/2026, Bùi Thị Vân Anh là 11/10/2026.
`owner_application_submitted_at` tách ngày gửi hồ sơ khỏi ngày tạo tài khoản;
trigger ghi nhận ngày gửi lại khi trạng thái chuyển sang pending. Hồ sơ cũ
được backfill từ ngày tạo tài khoản do chưa có lịch sử ngày gửi riêng.

`admin_sort_at` chỉ dùng để sắp xếp `/admin/users`, không thay đổi ngày tạo
tài khoản trong profiles hoặc auth.users. Trần Ngọc Bảo, Bùi Thị Vân Anh và
Hieu Trinh được đặt ở giữa danh sách: trang 3/6 tại thời điểm cập nhật (106
tài khoản). Hai trường mới không cấp quyền UPDATE cho trình duyệt.

Áp dụng migration trước rồi chạy:

```powershell
npx supabase db query --linked --file scripts/apply-docs-data-20261019.sql
npx supabase db query --linked --file scripts/check-docs-data-20261019.sql
```

Script nhập khóa giao dịch và dùng UUID ổn định; chạy lại không thêm đơn
trùng. Nếu UUID đã tồn tại với nội dung khác hoặc khung sân bị chiếm, toàn
bộ giao dịch dừng. Đã chạy thử hai lần trong giao dịch rollback trước khi
áp dụng thật, sau đó chạy kiểm tra lại trên database liên kết.

Repo ban đầu thiếu migration `20260921000012_venue_slot_counts.sql` đã áp
dụng trên database. File được khôi phục nguyên văn từ lịch sử migration,
không sửa hay đánh dấu lại lịch sử trên server.
