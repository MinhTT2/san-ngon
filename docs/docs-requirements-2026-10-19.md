# Yêu cầu Google Docs ngày 19/10/2026

Nguồn: https://docs.google.com/document/d/1yB2-cRLPRcOWGUNOk3-JYiGBeccqdX9BvN8Pra_WPD8/edit

Người dùng xác nhận tuần bổ sung là **12–18/10/2026** và cần sửa cả biểu đồ/giao diện tổng quan.

## Đối chiếu dữ liệu

17 đơn demo đã tồn tại khi bắt đầu task; không tạo thêm bản sao:

| Cụm sân | T4 14/10 | T5 15/10 | T6 16/10 | T7 17/10 | CN 18/10 | Tổng |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| King Club Pickleball | 1 | 2 | 0 | 3 | 1 | 7 |
| Sân bóng 5 Cửa Ô | 1 | 0 | 1 | 2 | 2 | 6 |
| Sân cầu lông Bao Cấp | 0 | 0 | 0 | 2 | 2 | 4 |

Các đơn này có ghi chú dữ liệu demo và chưa có thanh toán xác nhận. Chúng
được tính vào hoạt động đặt sân, không được tính vào doanh thu. Tuần đó
còn một đơn hủy có sẵn: tổng 18 đơn, 17 đơn hoàn tất, 1 đơn hủy, 0 đơn
đã nhận cọc. Không tạo giao dịch SePay hoặc sửa lịch sử thanh toán.

Hai ngày gửi hồ sơ 10/10 và 11/10 đã được lưu ở
`owner_application_submitted_at`, nhưng giao diện cũ đọc `created_at`.
Danh sách hồ sơ và trang chi tiết nay đọc ngày gửi riêng; tài khoản giữ
nguyên ngày tạo. Ba tài khoản được yêu cầu đã có `admin_sort_at`, đứng
liền nhau tại vị trí 56–58 khi kiểm tra. Phân trang và tìm kiếm vẫn ở SQL.

Migration `20261019000000_owner_submission_user_order` đã có trên Supabase
nhưng thiếu trong Git. File trong repo được khôi phục từ chính lịch sử
migration của project, không chạy lại. Migration mới
`20261019000100_dashboard_booking_activity` đã được áp dụng lên project liên kết.

## Giao diện và thống kê

- Thêm số đơn đã xác nhận/hoàn tất theo ngày chơi và xếp hạng cụm sân theo số đơn.
- Giữ doanh thu theo ngày nhận tiền; đơn demo chưa nhận tiền không tạo doanh thu.
- Biểu đồ có thang giá trị, ngày dạng ngày/tháng, cuộn ngang trên mobile
  khi nhiều ngày, mặc định nhìn thấy các ngày mới nhất và bảng số liệu mở
  được bằng bàn phím. Giá trị 0 có chiều cao 0, không vẽ cột giả.
- Báo cáo chủ sân chỉ chứa sân của họ. Các trường sắp xếp và ngày gửi
  không có quyền ghi từ trình duyệt.

## Kiểm tra

- `npm run lint` (không lỗi; cảnh báo có sẵn trong thư mục output local).
- Build và typecheck trên bản staged cô lập qua
  `npm run check:ui -- --staged --only=check-dashboard-ui`.
- Chromium headless với dữ liệu giả, context riêng, tại 320/390/768/1024/1440px.
- `scripts/check-dashboard-booking-activity.sql`: transaction rollback kiểm tra
  tách ngày chơi/ngày nhận tiền, số tiền thực nhận, quyền truy cập, trigger
  ngày gửi và thứ tự trước phân trang.
- Đọc lại RPC trên project liên kết: các cụm 7/6/4 đơn, các ngày 2/2/1/7/5,
  hai ngày gửi đúng và ba tài khoản nằm giữa danh sách.

## Điều chỉnh dữ liệu theo yêu cầu tiếp theo (19/10)

Người dùng yêu cầu dùng tài khoản người chơi hiện có, xóa tài khoản demo
và phân bổ các đơn xen kẽ giữa các sân. Đã áp dụng trực tiếp trên project:

- 17 đơn dùng 9 tài khoản người chơi hiện có; tên/số điện thoại trên đơn
  lấy từ hồ sơ, không sửa hồ sơ thật hoặc tạo số điện thoại giả.
- Rải giờ chơi và thời điểm tạo đơn, luôn sau khi tài khoản đã được tạo và
  trước giờ chơi. Thứ tự đơn mới nhất có 13 lần chuyển cụm giữa 17 đơn.
- King Club phân bổ 3/2/2 đơn trên 3 sân con; Bao Cấp 1/1/1/1 trên 4 sân con;
  5 Cửa Ô có một sân con, giữ 6 đơn. Không trùng lịch khách/sân hoặc lịch khóa.
- Giữ nguyên mã đơn, số đơn theo từng cụm/ngày, tổng tiền, người nhận và ghi
  chú dữ liệu mô phỏng. Đơn hủy có sẵn và dữ liệu người dùng thật giữ nguyên.
- Xóa 7 tài khoản thử nghiệm có cả tên demo và email `example.invalid`
  (5 người chơi, 1 chủ sân, 1 admin), cùng 2 cụm demo nháp chưa có lịch sử,
  thông báo thuộc các tài khoản bị xóa và một bản ghi miễn phí chưa đóng tiền.
- Không tạo/xóa giao dịch thanh toán, sự kiện SePay hoặc sổ tiền vào;
  doanh thu vẫn theo khoản tiền đã nhận.

Đã sao lưu riêng bên ngoài repository trước khi thao tác. Script
`scripts/redistribute-docs-demo-bookings.sql` mặc định rollback, có kiểm tra
cohort, phụ thuộc, xung đột lịch, giá SQL và các bất biến trước khi commit.
Không tắt trigger hoặc ràng buộc. Vì snapshot sân không được sửa, chỉ các
đơn mô phỏng chưa có thanh toán/phụ thuộc được tái tạo trong cùng transaction,
giữ nguyên ID/mã đơn và đi qua đầy đủ trigger hiện có.

Kiểm tra sau áp dụng: 18 đơn tổng cộng, 17 đơn mô phỏng, 0 tài khoản demo,
0 cụm nháp demo, 0 tên khách chứa Demo, 0 tên/điện thoại lệch hồ sơ, 0 đơn
được tạo trước ngày tạo tài khoản. RPC thống kê vẫn trả đúng 7/6/4 đơn.
RPC danh sách quản trị được kiểm tra lại tên khách, sân con và ghi chú.
Đây là thay đổi dữ liệu và tài liệu/SQL vận hành; không sửa giao diện/schema.

## Kịch bản 17 đơn đã thanh toán (yêu cầu tiếp theo ngày 19/10)

Sau khi được giải thích vì sao doanh thu bằng 0, người dùng yêu cầu coi 17
đơn này là đơn thật trong kịch bản báo cáo. Đã bổ sung thanh toán mô phỏng
cho đúng 17 đơn nói trên; các kết quả chưa thanh toán ở các mục trước là
trạng thái trước yêu cầu này.

- Tổng doanh thu kịch bản: **3.430.000đ**, 17 đơn đã thanh toán.
- 5 Cửa Ô: 6 đơn / 2.400.000đ; King Club: 7 đơn / 630.000đ;
  Bao Cấp: 4 đơn / 400.000đ.
- Mỗi đơn có một `payments` đã trả đúng tiền cọc, `provider = 'simulation'`,
  metadata `simulation: true`, `bank_transfer: false`, không có mã giao dịch
  ngân hàng. Giữ nguyên ghi chú mô phỏng trên đơn.
- Ngày thanh toán mô phỏng bằng ngày tạo cộng 5 phút, trong hạn giữ chỗ
  và trước giờ chơi. Tiền vẫn được thống kê theo ngày thanh toán, lịch chơi
  vẫn theo ngày chơi; toàn bộ các ngày nằm trong tuần 12–18/10/2026.
- Không thay đổi quy tắc tính doanh thu, schema hoặc giao diện. Không gọi
  webhook, không tạo sự kiện SePay, sổ tiền vào, quyền nhận giao dịch hoặc
  thông báo. Không sửa đơn hủy, hồ sơ người dùng hay các snapshot của đơn.

Đã sao lưu riêng trước khi áp dụng. Script vận hành
`scripts/simulate-docs-booking-payments.sql` mặc định rollback, khóa cohort,
kiểm tra tổng tiền và các bất biến trước khi commit; không chạy tự động.
Đã chạy thử rollback, áp dụng và đọc lại sau commit: báo cáo admin 30 ngày,
báo cáo tuần và báo cáo từng chủ sân đều khớp số đơn/tổng tiền. Tổng biểu đồ
ngày và bảng xếp hạng cụm sân đều bằng 3.430.000đ. Đây là số liệu mô phỏng,
không chứng minh có tiền chuyển vào ngân hàng.
