# Quyền RPC và hàm phụ trợ

Migration `20261028000200_rpc_security_boundaries.sql` thu hẹp quyền theo
từng chữ ký hàm. Không dùng số cảnh báo Advisors làm căn cứ thu hồi hàng loạt.

## Phạm vi

| Nhóm | Thay đổi | Lý do |
| --- | --- | --- |
| `gen_booking_code`, `unaccent_vi`, `slugify` | `search_path = pg_catalog`; slug gọi `public.unaccent_vi` rõ tên | Không lấy hàm trùng tên từ namespace của bên gọi; giữ kết quả và quyền hiện có |
| Đăng ký chủ sân, CRUD cụm/sân con, thống kê chủ sân (8 RPC) | Bỏ EXECUTE của PUBLIC/anon, giữ authenticated | Cần phiên đăng nhập; kiểm tra vai trò/quyền sở hữu bên trong vẫn chạy |
| 10 trigger còn quyền browser | Bỏ EXECUTE của PUBLIC/anon/authenticated | Được gọi qua trigger đã tạo; không phải API cho trình duyệt |

Giữ quyền đọc anonymous cho tìm sân/lịch trống, cộng đồng và các helper RLS.
`connect_telegram` có thiết kế riêng: bot chưa có phiên Supabase dùng mã liên
kết; không thu hồi quyền của endpoint này. Webhook/worker vẫn chỉ dùng các
RPC dành cho service role. Không đổi RLS, GiST, giá, trạng thái đơn, hạn cọc,
người nhận tiền hay cờ mở nhiều chủ sân.

Quyền authenticated để gọi một RPC admin không có nghĩa người chơi được
quản trị: hàm vẫn phải kiểm vai trò ở SQL. Trigger vốn không thể được gọi
như hàm SQL thường; bỏ EXECUTE là thu hẹp quyền thừa, không phải khẳng định
đã có cách gọi trực tiếp để vượt nghiệp vụ.

## Kiểm kê và sao lưu

`scripts/inspect-rpc-security.sql` chỉ đọc catalog: chữ ký hàm ứng dụng,
owner, search_path, quyền thực tế ba vai trò và quyền CREATE schema public.
Loại hàm thuộc extension; không đọc dữ liệu khách, body hàm hay Vault.

Trước cập nhật production, chạy `scripts/backup-rpc-security.sql` qua CLI
đã liên kết đúng project. Lưu JSON ở thư mục riêng ngoài Git, quyền thư mục
0700/tệp 0600; đối chiếu project ref và danh sách migrations trước khi dùng.
Nó sao lưu định nghĩa, owner, ACL và câu lệnh khôi phục của đúng **21 hàm**.
`restore_sql` khôi phục body và quyền PUBLIC/anon/authenticated; các quyền
khác và owner được CREATE OR REPLACE giữ nguyên. Ghép các câu này trong
một transaction với lock timeout; nếu phải phục hồi, lưu biên bản và tạo
migration sửa tiếp để lịch sử Git/DB khớp nhau.

Đây là bản sao lưu các đối tượng bị tác động, **không phải** backup toàn
database/Storage/khóa AES hoặc bằng chứng đã diễn tập phục hồi hệ thống.
Không đưa file backup hoặc bí mật vận hành lên CI.

## Kiểm chứng

`scripts/check-rpc-security.sql` chạy trên Supabase dùng một lần trong
workflow SQL isolation, với BEGIN/ROLLBACK. Bài kiểm tra:

- Quyền gọi owner/admin, RPC công khai, Telegram và webhook/worker không
  bị lẫn; tất cả hàm ứng dụng đã khóa search_path và trigger không mở browser.
- Tạo namespace giả có `translate`, `substr`, `unaccent_vi` trùng tên;
  kiểm tra bỏ dấu, slug, NULL/chuỗi rỗng và 100 mã đơn vẫn đúng.
- Trigger Auth vẫn tạo profile; authenticated vẫn tạo/xóa cụm nháp và sân
  con, đọc thống kê; trigger khóa tài khoản vẫn chặn ghi khi bị cấm.
- Các bộ nghiệp vụ hiện có tiếp tục kiểm giá/cọc/VIP, giữ chỗ, hủy/hoàn,
  thông báo, giải đấu và hai kết nối đặt trùng qua GiST.

Các fixture SQL là dữ liệu kiểm thử được rollback, không phải tài khoản
được bàn giao cho người dùng. Không chạy bài có fixture lên production
để thay thế kiểm thử CI; sau deploy dùng inventory chỉ đọc và kiểm tra
HTTP website. Nghiệm thu OTP, ngân hàng và Telegram thật vẫn là bước riêng.
