# Kết quả D5 — SePay và thanh toán sân

Ngày 09/10/2026. Người dùng yêu cầu kiểm đến hết D9; project liên kết, dữ liệu thử, Chromium headless/context riêng. Các khoản tiền và chứng từ trong test đều giả.

**11 đạt / 0 không đạt / 2 một phần / 1 bị chặn.** Case nhiều biến thể chỉ tính đạt khi phần bắt buộc trong môi trường đã nêu đủ bằng chứng. Một phần không phải nghiệm thu xong.

Bản chụp mã/schema, index bằng chứng, lỗi harness và dọn dữ liệu xem [biên bản tổng hợp](test-results-d3-d9-2026-10-09.md). Các thay đổi sản phẩm của công việc khác không được gộp vào task kiểm thử này.

| Case | Kết quả | Bằng chứng, phạm vi và phần còn mở |
| --- | --- | --- |
| D5-01 | một phần | 15 callback guard mock: thiếu/sai/cookie/state expired/replay/other owner/return allowlist/denied/token error; SQL pending giữ role. Cấp quyền SePay thật chưa nghiệm thu. |
| D5-02 | đạt | 13 test actual helper/route với provider/DB mock: token hết hạn, 401 refresh/retry, 403/429/500/timeout/unlock, busy; tạo rồi đọc xác minh, timeout sau tạo tái sử dụng không POST trùng, mismatch không activate. Không gọi provider thật. |
| D5-03 | đạt | D2 checkout thật + fixture snapshot receiver + crypto QR: tiền/mã/người nhận đóng băng; lỗi QR có nội dung chuyển thay thế, receiver thiếu không đưa QR. |
| D5-04 | đạt | Local webhook thật: key sai 401; tiền ra/0/âm/lẻ/vượt int/ID sai 200 skipped; 11 biến thể guard không đổi đơn. |
| D5-05 | một phần | Local sai bank/account bị bỏ qua; SQL confirm sai connection và cross-flow claims đạt. Chưa đủ ma trận cùng ID ở mọi kết nối/cả legacy và OAuth. |
| D5-06 | đạt | Regex/reference contract và local ambiguous SAN/PHI, mã dài, không mã; mã hợp lệ của booking và giải được xử lý qua local webhook. |
| D5-07 | đạt | Local synthetic SAN xác nhận; payment nghĩa vụ giữ đúng snapshot, inbox/realtime SQL/phiên thật và fixture ba màn. Không có chuyển khoản ngân hàng. |
| D5-08 | đạt | Hai khoản 50.000 + 50.500 không xác nhận đơn 100.500; retry sửa tiền không nhận lại. Khoản 110.500 xác nhận: payments.amount vẫn 100.500 nghĩa vụ, sepay_events.amount giữ 110.500 thực nhận. SQL rollback kiểm lại độc lập. |
| D5-09 | đạt | Local retry ba request cùng giao dịch không CONFIRMED lần hai và một payment; SQL claims SAN/GIAI/PHI; giải retry năm request một PAID/four ALREADY_PROCESSED. |
| D5-10 | đạt | Năm race JWT cancel vs HTTP RPC confirm_payment: đủ cả hai thứ tự thắng; cuối cancelled/refund needed, một event/một payment, retry không nhận lại. Payment failed nếu tiền tới sau hủy, paid nếu nhận trước rồi hủy. expires_at=now bị từ chối trước cron; D2 replacement không bị hồi phục. Khoản tiền giả. |
| D5-11 | đạt | JWT manual pending đúng owner; đã confirmed/hết hạn/khác owner bị chặn; owner hủy/mark refund retry không đổi nghĩa vụ. Thao tác hoàn chỉ ghi nhận thử. |
| D5-12 | đạt | Fixture checkout năm kích thước: không polling, offline/reconnect/focus, response cũ/realtime, QR lỗi; phiên thật cập nhật hủy và giải cập nhật paid. |
| D5-13 | đạt | SQL rollback legacy→OAuth→disconnect: đơn cũ giữ legacy và vẫn nhận cọc sau ngắt; đơn mới snapshot OAuth, không tự quay về legacy. O2 miễn/còn hạn vẫn bị gate false chặn; gate true mới cho nhận. QR sân/giải pending và tài khoản nhận phí chặn ngắt trong các suite SQL. |
| D5-14 | bị chặn | Chưa được phép thực hiện chuyển khoản thật/domain thật; cần người giữ tài khoản thao tác và đối soát riêng. |

Dữ liệu thử đã dọn, kiểm lại cùng audit cuối; các phần thử qua dịch vụ thật còn mở như ghi trong bảng. Không kết luận sẵn sàng nhận tiền thật từ kết quả giả lập.
