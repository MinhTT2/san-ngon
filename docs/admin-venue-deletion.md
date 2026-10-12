# Admin xóa cụm sân

Ngày 12/10/2026: sân bóng Mỹ Đình không xóa được vì RPC cũ chặn mọi cụm từng có đơn, kể cả đơn đã hủy. Migration `20261012000500_admin_venue_delete_permissions.sql` cho admin xóa vĩnh viễn cụm sân có đơn và giải, thống nhất với quyền xóa giải của admin.

Hộp xác nhận nêu rõ: xóa cụm, sân con, đơn đặt, thanh toán gắn với đơn, giải và dữ liệu đăng ký/quyết toán liên quan. Không tự hoàn tiền. Admin cần xử lý đơn sắp tới và khoản cần hoàn trước khi xác nhận.

SQL kiểm tra admin đang hoạt động, khóa cụm/sân con/đơn, gọi `delete_tournament` để xử lý giải và lịch khóa, rồi dọn quan hệ phụ thuộc trong cùng giao dịch. Chủ sân và người chơi không gọi được RPC admin; `delete_venue` của chủ sân tiếp tục giữ điều kiện chặn lịch sử.

Sổ tiền vào, mã chống dùng lại giao dịch, ghi chú đối soát, thông báo và yêu cầu hỗ trợ cùng ảnh chứng từ được giữ. `feedback.deleted_booking_code` giữ mã đơn sau khi gỡ liên kết; chứng từ tiếp tục được bảo vệ bằng RLS và signed URL. Chủ sân và người đặt nhận thông báo xóa, nhắc không chuyển thêm theo mã cũ.

Đã kiểm tra SQL rollback với tất cả trạng thái đơn, đơn có tiền/cần hoàn, giải công khai và quyết toán; quyền owner/player/admin bị khóa, cụm không tồn tại, dọn quan hệ và giữ sổ/chứng từ. Kiểm tra trình duyệt dùng Chromium headless, context và tài khoản thử riêng: 1440/390px, đóng xác nhận, xóa và tải lại danh sách, xóa sân có lịch sử, chặn sai quyền/origin/ID. Lint không lỗi (cảnh báo có sẵn trong `output/`), typecheck và production build đạt. Dữ liệu thử được dọn; không xóa sân Mỹ Đình trong lúc kiểm thử.
