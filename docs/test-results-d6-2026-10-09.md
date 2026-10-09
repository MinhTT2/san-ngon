# Kết quả D6 — Phí dịch vụ

Ngày 09/10/2026. Người dùng yêu cầu kiểm đến hết D9; project liên kết, dữ liệu thử, Chromium headless/context riêng. Các khoản tiền và chứng từ trong test đều giả.

**8 đạt / 0 không đạt / 3 một phần / 1 bị chặn.** Case nhiều biến thể chỉ tính đạt khi phần bắt buộc trong môi trường đã nêu đủ bằng chứng. Một phần không phải nghiệm thu xong.

Bản chụp mã/schema, index bằng chứng, lỗi harness và dọn dữ liệu xem [biên bản tổng hợp](test-results-d3-d9-2026-10-09.md). Các thay đổi sản phẩm của công việc khác không được gộp vào task kiểm thử này.

| Case | Kết quả | Bằng chứng, phạm vi và phần còn mở |
| --- | --- | --- |
| D6-01 | đạt | Mặc định miễn phí SQL; JWT owner bị chặn bật phí, admin bật thành công, không tự tăng hạn; quyền trực tiếp SQL bị chặn. |
| D6-02 | đạt | Năm JWT request đồng thời trả cùng một invoice pending; 299.000 và PHI+8 hex; client không ghi invoice. |
| D6-03 | đạt | SQL đổi subscription_receiver bên trong rollback sau tạo kỳ: invoice giữ bank/account/name cũ; cọc sân không quyết định receiver phí. |
| D6-04 | đạt | SQL đủ tiền trả SUBSCRIPTION_PAID; retry ALREADY_PROCESSED, giao dịch khác ALREADY_PAID; hạn không cộng thêm. |
| D6-05 | đạt | SQL hai khoản thiếu 150.000+149.000 không cộng; sửa retry không tăng; overpaid được ghi; sai account/connection và claim đã dùng bị chặn. |
| D6-06 | đạt | SQL 31/01→29/02/2096 và →28/02/2097, giữ giờ Việt Nam; tháng lịch, không cộng 30 ngày. |
| D6-07 | một phần | SQL kỳ trễ bắt đầu now và thời hạn trong SQL đạt. Chưa nghiệm thu giao diện phí từ trình duyệt múi giờ khác. |
| D6-08 | đạt | SQL exact expiry/unpaid chặn nhận đơn, tạo cụm/sân, công khai draft; không chờ cron. |
| D6-09 | một phần | SQL bổ sung khi hết hạn phí: update_venue, get_owner_court_schedule, mark_refund_done cho đơn cũ đạt; retry hoàn báo REFUND_NOT_NEEDED, nghĩa vụ không đổi. Chưa phủ toàn bộ thao tác này bằng JWT/UI ở trạng thái hết hạn. |
| D6-10 | đạt | Miễn/bật lại giữ paid_until trong rollback. O2 ready với fee exempt và fee paid đều không nhận đơn khi multi_owner_enabled=false; bật gate chỉ trong rollback mới cho nhận. Phí không tự bật gate. |
| D6-11 | một phần | Dashboard/phí hiển thị và lỗi query fixture đạt; SQL đối soát, disconnect guard có kiểm. Realtime fee giữa hai phiên thật chưa đủ publication và chưa nghiệm thu reconnect. |
| D6-12 | bị chặn | Chưa chuyển kỳ 299.000đ thật; cần người giữ tài khoản và đối soát ngân hàng/webhook/domain. |

Dữ liệu thử đã dọn, kiểm lại cùng audit cuối; các phần thử qua dịch vụ thật còn mở như ghi trong bảng. Không kết luận sẵn sàng nhận tiền thật từ kết quả giả lập.
