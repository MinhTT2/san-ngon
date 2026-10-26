# Áp dụng yêu cầu Google Docs ngày 26 tháng 10 năm 2026

Nguồn: https://docs.google.com/document/d/1e8lwDMZ9bVid2LIsm4zJnt7S5NTQrV3hxilGBrEpkuU/edit

Người dùng yêu cầu áp dụng trực tiếp trên website hiện tại. Đã sao lưu riêng
ngoài repository trước khi thay đổi, chạy thử transaction rollback rồi áp dụng
và đọc lại trên Supabase liên kết. Các đơn và khoản thanh toán tạo thêm có dấu
mô phỏng; không phải bằng chứng chuyển tiền hoặc hoạt động người dùng thực tế.

## Ngày gửi hồ sơ và ngày tạo cụm sân

Đối chiếu bằng ID chủ sân, số điện thoại trong ảnh và cụm sở hữu để tránh
tài khoản trùng tên. Ngày gửi hồ sơ và ngày tạo cụm được điều chỉnh như sau;
cụm được tạo sau giờ gửi hồ sơ 30 phút. Giữ nguyên ngày tạo tài khoản Auth.

| Chủ sân | Ngày gửi hồ sơ | Ngày tạo cụm |
| --- | --- | --- |
| Nguyễn Quý Ngọc | 12/10/2026 | 12/10/2026 |
| Trần Ngọc Bảo | 13/10/2026 | 13/10/2026 |
| Phạm Hùng | 14/10/2026 | 14/10/2026 |
| Phong Thanh | 16/10/2026 | 16/10/2026 |
| Nguyễn Duy Quang | 18/10/2026 | 18/10/2026 |

## Phân bổ đơn và doanh thu

Thay đúng 21 đơn hoàn tất chưa có thanh toán ngày 20/10 bằng 44 đơn có ghi chú
`[docs-20261026]`. Các đơn cũ khác, kể cả đơn hủy, giữ nguyên. Vì vậy danh sách
tuần có thể có thêm đơn hủy ngoài 44 đơn mới.

| Ngày chơi tháng 10 năm 2026 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | Tổng |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Đơn mới | 7 | 7 | 6 | 6 | 6 | 6 | 6 | 44 |

| Cụm sân | Số đơn mới | Tiền mô phỏng |
| --- | ---: | ---: |
| King Club Pickleball | 6 | 540.000đ |
| Sân bóng 5 Cửa Ô | 6 | 2.400.000đ |
| Sân bóng Cafe Bao Cấp | 6 | 2.400.000đ |
| Sân bóng Đại Dương | 6 | 2.100.000đ |
| Sân cầu lông Bao Cấp | 5 | 500.000đ |
| Sân cầu lông Kim Bông | 5 | 500.000đ |
| Sân Pickleball Bảo Kim | 5 | 450.000đ |
| Pickleball Tân Xã | 5 | 450.000đ |
| Tổng | 44 | 9.340.000đ |

35/44 đơn được tạo trước ngày chơi một ngày; 9 đơn đặt trước giờ chơi hai giờ.
Dùng 44 tài khoản người chơi hiện có, tên/số điện thoại lấy từ hồ sơ. Không có
đơn trước ngày tạo tài khoản, trùng lịch khách/sân hoặc chồng lịch khóa.
Giá tra `price_rules` trong SQL; mỗi đơn có một khoản `payments` với
`provider = 'simulation'`, metadata nguồn và không có mã giao dịch ngân hàng.
Thanh toán mô phỏng cách thời điểm tạo 2–8 phút, trong hạn giữ chỗ 15 phút.
Các trigger, GiST và snapshot người nhận vẫn chạy đầy đủ.

Kỳ 19–25/10 có **8.560.000đ từ 39 đơn**, vì năm đơn chơi ngày 19/10 đã thanh
toán mô phỏng ngày 18/10. Kỳ 30 ngày tại ngày nghiệm thu 26/10 có tổng
**12.770.000đ từ 61 đơn**, gồm 3.430.000đ mô phỏng của đợt trước. Tổng biểu đồ
theo ngày, bảng cụm sân và báo cáo từng chủ sân đã đối chiếu khớp SQL.
Giữ quy tắc doanh thu theo ngày nhận tiền ở múi giờ Việt Nam.

## Thời lượng và kiểm tra

45 tài khoản từng đặt sân có thời lượng trình bày 300–600 giây ở bảng riêng
`user_activity_simulations`; quản trị hiển thị **Thời lượng mô phỏng** cạnh
thời lượng đo thực tế. Không sửa bộ đếm thật, phiên đang hoạt động, thời điểm
hoạt động gần nhất hoặc GA4. Trình duyệt không có quyền đọc/ghi trực tiếp
bảng mô phỏng; `admin_list_users` kiểm tra admin trước khi trả dữ liệu.

Script vận hành `scripts/apply-docs-scenario-20261026.sql` mặc định rollback,
khóa cohort 21 mã đơn, từ chối xóa khi có bất kỳ phụ thuộc, chặn chạy lặp và
kiểm tra dữ liệu không thuộc phạm vi. Không chạy trong migration/deploy.
Migration `20261026000000_user_activity_simulations` đã áp dụng và ghi lịch sử.
Giữ nguyên cờ vận hành, SePay, sổ tiền vào và thông báo; không gọi webhook.

Kiểm tra đã đạt:

- SQL chạy thử rollback và xác minh sau commit: 44 đơn, ngày hồ sơ/cụm, giá,
  thời gian, xung đột lịch, thanh toán cũ, sổ ngân hàng và dữ liệu ngoài phạm vi.
- `check-user-activity-simulations.sql` và `check-user-activity.sql`: quyền truy
  cập, ranh giới thời lượng, tách số đo thật/mô phỏng, heartbeat và xóa tài khoản;
  toàn bộ fixture rollback, đã xác minh không còn tài khoản thử.
- Production build và typecheck từ index riêng; Chromium headless/context
  cô lập kiểm tra dashboard ở 320/390/768/1024/1440px, cột biểu đồ và nhãn thời
  lượng mô phỏng; dữ liệu trình duyệt giả lập, không dùng phiên cá nhân.
- Typecheck workspace đạt; lint không có lỗi, còn 48 cảnh báo ở output local.
