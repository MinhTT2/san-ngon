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

## Bổ sung tài khoản theo phản hồi

Người dùng xác nhận tạo thêm 20 tài khoản mẫu khi chưa cung cấp danh sách
người dùng thật. Đã bổ sung 20 tên hư cấu với email đúng định dạng thuộc
`example.com`, không có số điện thoại, không gửi email, không đặt mật khẩu
được biết trước và không tự ghi nhận thời gian dùng web. Ngày tạo là thời
điểm chạy thực tế. Email giữ trạng thái chưa xác minh.

Tổng hiện tại là **196 tài khoản: 176 tài khoản sẵn có và 20 tài khoản mô
phỏng mới**. Không coi 20 tài khoản này là người dùng thật hoặc dùng để báo
đạt mục tiêu 200 người dùng thật. Metadata do SQL quản trị ghi
`account_kind=simulation`, `simulation_batch=docs-20261026-extra-users`;
RPC trả nhãn tài khoản và số mẫu trong kết quả, cả chữ ký bốn và năm tham số.
Giao diện admin ghi **Tài khoản mô phỏng** trên từng ô và nêu số mẫu trong
tổng kết quả. Chỉ đọc metadata ứng dụng đáng tin cậy, không nhận phân loại
từ metadata người dùng tự sửa.

Script `scripts/add-docs-demo-users-20261026.sql` mặc định rollback, từ chối
chạy lặp hoặc email trùng; kiểm tra giữ nguyên toàn bộ tài khoản/hồ sơ sẵn
có, đơn, thanh toán, thông báo và số đo thời lượng. Đã sao lưu riêng và chạy
thử rollback trước khi áp dụng. Migration `20261026000300` chỉ mở rộng RPC,
không tạo tài khoản khi triển khai.

## Phân bổ đơn cho sáu tài khoản trong ảnh

Theo phản hồi tiếp theo, chuyển sáu đơn đã ghi rõ mô phỏng sang sáu tài
khoản được chỉ định; mỗi tài khoản trước đó chưa có đơn và hiện có một đơn.
Ưu tiên chuyển từ các tên lặp nhiều. Chỉ sửa `user_id`, tên/số điện thoại
liên hệ và ghi chú nguồn; giữ nguyên mã, sân, lịch, ngày tạo, giá đã chốt,
chính sách và toàn bộ bản ghi thanh toán. Tổng kịch bản vẫn là 44 đơn tại
tám cụm, gắn với 44 tài khoản khác nhau.

| Tài khoản | Mã đơn mô phỏng | Ngày chơi tháng 10/2026 |
| --- | --- | --- |
| Giang Nguyễn | SANTG97RK | 25 |
| Hùng Trần | SANHGJLXB | 25 |
| Khánh đẹp trai | SANRLAWBM | 24 |
| Vũ | SANGMF7Y9 | 24 |
| Đỗ Phương | SANE3Z4EU | 24 |
| Hải Nam Nguyễn | SANYFQR3Z | 23 |

Đối chiếu tài khoản bằng ID và email trong ảnh. Tất cả đơn được tạo sau
ngày đăng ký cả Auth và hồ sơ; riêng Hùng Trần đăng ký chiều 25/10 nên chỉ
có một đơn phù hợp. Không bịa số điện thoại cho năm hồ sơ đang thiếu; trường
liên hệ trên đơn để trống thay vì giữ số của người đặt cũ. Giữ số đã có
trên hồ sơ Khánh đẹp trai. Không sửa hồ sơ, VIP hoặc thời lượng; sáu người
đã có số đo thực tế tối thiểu năm phút.

Script `scripts/redistribute-docs-bookers-20261026.sql` mặc định rollback,
chỉ nhận đơn hoàn tất của batch mô phỏng với đúng một khoản thanh toán mô
phỏng không có mã ngân hàng. Từ chối đơn có phụ thuộc trong luồng khác và
chạy lặp. Đã sao lưu riêng, chạy thử rollback, áp dụng và kiểm tra sau commit:
sáu tài khoản đọc được đúng mã đơn qua `search_my_bookings`; biểu đồ/doanh
thu, mọi khoản thanh toán, đơn ngoài phạm vi, hồ sơ, số đo hoạt động, sổ ngân
hàng và thông báo giữ nguyên. Không có thay đổi schema hoặc giao diện.

## Thời lượng và kiểm tra

45 tài khoản từng đặt sân có thời lượng trình bày 300–600 giây ở bảng riêng
`user_activity_simulations`; quản trị hiển thị **Thời lượng mô phỏng** cạnh
thời lượng đo thực tế. Sau phản hồi về khả năng nhìn thấy, số mô phỏng được
đưa lên đầu ô với nhãn **Thời gian sử dụng web (mô phỏng)** và giữ số đo thực
tế ở dòng riêng; trước lần phân bổ sáu tài khoản nói trên, kiểm tra lại RPC
production xác nhận đủ 44/44 tài khoản của 44 đơn trả về 300–600 giây. Sáu
tài khoản nhận đơn sau đó dùng số đo thực tế sẵn có, không thêm thời lượng
mô phỏng mới. Không sửa bộ đếm thật, phiên đang hoạt động, thời điểm
hoạt động gần nhất hoặc GA4. Trình duyệt không có quyền đọc/ghi trực tiếp
bảng mô phỏng; `admin_list_users` kiểm tra admin trước khi trả dữ liệu.

Script vận hành `scripts/apply-docs-scenario-20261026.sql` mặc định rollback,
khóa cohort 21 mã đơn, từ chối xóa khi có bất kỳ phụ thuộc, chặn chạy lặp và
kiểm tra dữ liệu không thuộc phạm vi. Không chạy trong migration/deploy.
Migrations `20261026000000_user_activity_simulations` và `20261026000200_user_activity_simulation_sort` đã áp dụng và ghi lịch sử. RPC năm tham số giữ nguyên VIP, giờ chơi và thứ tự theo thời lượng đo thực tế.
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

Bản cuối đã ghép với main có VIP và sắp xếp thời lượng mới: production build,
kiểm tra dashboard cùng luồng VIP đạt; lint bản ghép có 0 lỗi, 2 cảnh báo có sẵn.
