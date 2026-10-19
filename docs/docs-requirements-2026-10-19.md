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
