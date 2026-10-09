# Kết quả D3 — Phân quyền và bảo vệ dữ liệu

Ngày 09/10/2026. Người dùng yêu cầu kiểm đến hết D9; project liên kết, dữ liệu thử, Chromium headless/context riêng. Các khoản tiền và chứng từ trong test đều giả.

**5 đạt / 0 không đạt / 5 một phần / 0 bị chặn.** Case nhiều biến thể chỉ tính đạt khi phần bắt buộc trong môi trường đã nêu đủ bằng chứng. Một phần không phải nghiệm thu xong.

Bản chụp mã/schema, index bằng chứng, lỗi harness và dọn dữ liệu xem [biên bản tổng hợp](test-results-d3-d9-2026-10-09.md). Các thay đổi sản phẩm của công việc khác không được gộp vào task kiểm thử này.

| Case | Kết quả | Bằng chứng, phạm vi và phần còn mở |
| --- | --- | --- |
| D3-01 | đạt | JWT A/B thật: checkout của người khác 404; read có giới hạn cột không trả đơn; realtime của A nhận hủy, B không nhận event. |
| D3-02 | đạt | PATCH trực tiếp trạng thái/giá/user/sân không đổi dữ liệu; người chơi bị chặn xác nhận/hoàn; hủy RPC đúng chủ đơn. |
| D3-03 | một phần | O2 bị chặn xóa cụm/sân, ảnh, lịch và thống kê; direct ownership không đổi. Chưa phủ toàn bộ PATCH giá/đơn và mọi biến thể with check bằng JWT. |
| D3-04 | một phần | Người chơi/chủ sân bị chặn review_owner, thống kê admin, bật phí và API duyệt. Admin user CRUD đạt SQL; chưa chạy mọi API quản trị bằng JWT. |
| D3-05 | đạt | Tải PDF thử thật vào bucket riêng; khách/O2 không đọc; admin lấy signed URL; signed URL 1 giây hết hạn bị từ chối. |
| D3-06 | một phần | JWT/anon không đọc token/key/raw/claims/ledger; crypto owner/tamper đạt. Bundle browser snapshot đã quét, không thấy tham chiếu biến secret server. Chưa quét bundle/log deployment thật; không đưa giá trị secret vào báo cáo. |
| D3-07 | một phần | SQL chặn tự duyệt/tự paid_at/thu/hoàn/quyết toán; participant không thấy liên hệ khác. Browser bốn vai trò đạt luồng chính; chưa phủ mọi cross-tournament JWT. |
| D3-08 | đạt | SQL mặc định ẩn, consent/ban; 8 tổ hợp kênh chạy RPC anon thật, kênh tắt không có giá trị; profiles công khai bị chặn. |
| D3-09 | đạt | D3-F01 từng tái hiện 201/200 với Origin ngoài trên snapshot trước. Snapshot local mới từ công việc khác đã retest:48 write có cookie fixture và Origin ngoài/null/thiếu đều403, same-origin API/native fetch/logout đạt; webhook sai key401. HTML checkout/inbox escape. Chưa kiểm deployment hoặc chứng minh khai thác CSRF bằng trình duyệt ngoài. |
| D3-10 | một phần | Ảnh sân cross-user overwrite/remove không tác động; ảnh bìa/avatar thật đổi/xóa đạt; favorite/feedback riêng tư đạt. Chưa phủ hết đọc/sửa/xóa của từng bucket bằng từng vai trò. |

Dữ liệu thử đã dọn, kiểm lại cùng audit cuối; các phần thử qua dịch vụ thật còn mở như ghi trong bảng. Không kết luận sẵn sàng nhận tiền thật từ kết quả giả lập.
