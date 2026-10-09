# Kết quả D9 — Giao diện, đồng bộ, thông báo

Ngày 09/10/2026. Người dùng yêu cầu kiểm đến hết D9; project liên kết, dữ liệu thử, Chromium headless/context riêng. Các khoản tiền và chứng từ trong test đều giả.

**3 đạt / 1 không đạt / 4 một phần / 0 bị chặn.** Case nhiều biến thể chỉ tính đạt khi phần bắt buộc trong môi trường đã nêu đủ bằng chứng. Một phần không phải nghiệm thu xong.

Bản chụp mã/schema, index bằng chứng, lỗi harness và dọn dữ liệu xem [biên bản tổng hợp](test-results-d3-d9-2026-10-09.md). Các thay đổi sản phẩm của công việc khác không được gộp vào task kiểm thử này.

| Case | Kết quả | Bằng chứng, phạm vi và phần còn mở |
| --- | --- | --- |
| D9-01 | không đạt | D9-F01: 25 trang ×360/1440 ×cỡ chữ1/2 =100 mẫu. Cỡ thường50/50 đạt; desktop chữ200%25/25 đạt; mobile chữ200% có9 trang tràn378–553px. Mô phỏng đổi root font16→32px, không phải zoom trình duyệt native. Đã xem ảnh checkout/liên hệ; không có pageerror. |
| D9-02 | một phần | Checkout riêng/no footer, QR/gallery lỗi, format snapshot và screenshot Việt đã xem. Chưa kiểm thủ công hết font/token/trang; quan sát nút thanh toán giải top612 so với ngưỡng500 của script, vẫn nằm trước thông tin dài. |
| D9-03 | đạt | Fixture modal/menu/crop/navigation keyboard: Tab/ShiftTab/Enter/Escape, focus trap/restore, mở/đóng không ghi, duplicate-submit được chặn. |
| D9-04 | đạt | No-JS landing/content/search GET; reduced motion/data saver/video failure và đổi setting khi animation chạy đạt fixture. |
| D9-05 | một phần | Fixture stale/event burst/offline/reconnect/return tab; JWT realtime own booking và giải approve/paid/refund thật. Publication phí/tiện ích chưa đủ ở D0; chưa tất cả bảng/expired session thật. |
| D9-06 | một phần | Fixture dirty form deferral/resume và đảo response chọn ngày/lọc đạt. D2-O01 tìm mã ~44s chưa đo lại latency riêng/reproduce và D9 chưa test mọi dạng modal trên phiên thật. |
| D9-07 | đạt | Fixture inbox/popover/keyboard/lỗi/duplicate-read; notification JWT A/B mark không ảnh hưởng B; own inbox/read/XSS escape thật và links/filter contract. |
| D9-08 | một phần | Email/notify mocks đạt. Bổ sung9 Telegram route contracts mock secret/private/start/DB error/config/link10phút/hash; SQL anon token sai, one-use và exact expiry đạt rollback. Không gửi email/Telegram thật; nhận thư/bot thật còn mở. |

Dữ liệu thử đã dọn, kiểm lại cùng audit cuối; các phần thử qua dịch vụ thật còn mở như ghi trong bảng. Không kết luận sẵn sàng nhận tiền thật từ kết quả giả lập.
