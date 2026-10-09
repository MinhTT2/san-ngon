# Kết quả D7 — Giải đấu và quyết toán

Ngày 09/10/2026. Người dùng yêu cầu kiểm đến hết D9; project liên kết, dữ liệu thử, Chromium headless/context riêng. Các khoản tiền và chứng từ trong test đều giả.

**16 đạt / 0 không đạt / 8 một phần / 0 bị chặn.** Case nhiều biến thể chỉ tính đạt khi phần bắt buộc trong môi trường đã nêu đủ bằng chứng. Một phần không phải nghiệm thu xong.

Bản chụp mã/schema, index bằng chứng, lỗi harness và dọn dữ liệu xem [biên bản tổng hợp](test-results-d3-d9-2026-10-09.md). Các thay đổi sản phẩm của công việc khác không được gộp vào task kiểm thử này.

| Case | Kết quả | Bằng chứng, phạm vi và phần còn mở |
| --- | --- | --- |
| D7-01 | một phần | Khám phá/public/admin/owner và chi tiết browser thật đạt; fixture filter/draft/empty. Chưa đủ toàn bộ tổ hợp thời điểm/phân trang hai tab cá nhân; lỗi repeated q từ D0 còn mở. |
| D7-02 | một phần | SQL thời gian/past/capacity1/1001/cọc vượt/hold0/73 và browser validation/network giữ form đạt. Chưa kiểm hết whitespace và mọi đầu vào biên từng field. |
| D7-03 | đạt | Browser owner chọn sân/đổi môn/no court và công khai ngay; SQL wrong sport/foreign/inactive/unready/unverified/banned, atomic closure và role đúng. |
| D7-04 | một phần | Browser player đề xuất→admin thuê/terms→publish đạt; SQL quyền/terms/cancellation fee. Chưa đủ từ chối chỉ lý do, thiếu từng điều kiện và sai môn qua API thật. |
| D7-05 | đạt | SQL booking/closure overlap bị chặn, không partial publish; ba race submit_tournament/create_booking đều một thành công (đã đi qua assertions trong confirmed/core trước fail harness ở bước capacity). |
| D7-06 | đạt | SQL resubmit cùng ID/pending/rejected, published immutable; ảnh đang dùng có guard; image browser sửa bìa đề xuất đạt. |
| D7-07 | đạt | Upload Storage thật: crop16:9/contain poster/keyboard/focus/drag/cancel/MIME/size/broken image/retry/save/resubmit/old file; 320–1440px. Cleanup được kiểm lại riêng. |
| D7-08 | một phần | Browser đăng ký có cọc/agree; SQL private/self paid/duplicate và zero-deposit approved không receiver. Chưa đủ guest/thiếu từng contact/free deposit UI. |
| D7-09 | đạt | Browser thật tên không dấu/đội/filter pending→approve; SQL contact private và review. Lỗi filter không có kết quả hiển thị đúng. |
| D7-10 | đạt | Hai người quản lý JWT đồng thời còn một suất: 204 và TOURNAMENT_FULL; count approved=2; SQL expired không chiếm suất, pending không chiếm trước duyệt. |
| D7-11 | đạt | SQL free/có cọc, receiver snapshot, deadline min hold/payment deadline, before-cron guards; browser QR/pending sau duyệt đúng. |
| D7-12 | đạt | Local GIAI webhook/retry và realtime browser; năm RPC HTTP payment cùng mã/giao dịch: một PAID, bốn ALREADY_PROCESSED; một money event. |
| D7-13 | một phần | SQL wrong receiver/short/excess/new duplicate/late/cross SAN-PHI và hai short HTTP không sum đạt. Chưa hết mọi biến thể sau hủy trước paid_at với từng luồng. |
| D7-14 | một phần | SQL refresh/deadline trước cron và browser starts_at timer đạt; cron configuration đọc ở D0. Chưa quan sát đủ một vòng cron thật expiry/reminder/completion cho fixture. |
| D7-15 | đạt | SQL retry expired/rejected/cancel tạo ID/code mới, old code không trả lần mới; browser tab lịch sử và thông tin hoàn đúng. |
| D7-16 | đạt | SQL before/exact/after refund_deadline ±1 microsecond; manager tự hủy vẫn theo self. Giải cũ cancel_window_hours=0 đóng băng refund_deadline=starts_at; đổi policy giải sang24 không đổi snapshot. Kiểm snapshot hết hạn bằng fixture, toàn bộ rollback. |
| D7-17 | đạt | SQL organizer cancel/whole cancel phục hồi cả cọc forfeited và phần còn lại; browser release closure/refund đạt. |
| D7-18 | đạt | SQL excess→partial refund→cancel tính phần thiếu; stale amount/retry/khác owner bị chặn; browser owner refund cập nhật player. |
| D7-19 | đạt | SQL early/duplicate/unpaid/organizer thu bị chặn; browser starts_at timer rồi owner ghi 100.000 còn lại; SQL tính tiền/chứng từ. |
| D7-20 | đạt | SQL thiếu lý do miễn/vắng mặt bị BALANCE_NOT_COLLECTIBLE; ghi chú hợp lệ lưu waived_at và chưa thu; miễn lặp và thu sau miễn bị chặn. SQL/browser trước đó kiểm hủy sau thu và hoàn phần còn lại. |
| D7-21 | đạt | SQL bộ 600k+200k-100k-50k-300k-100k=250k, số âm/0, tự tổ chức balance0; browser quyết toán hai bên xong. |
| D7-22 | đạt | SQL organizer hủy phí thuê theo thỏa thuận 25k, owner hủy thuê0; player refund độc lập phí thuê. |
| D7-23 | một phần | SQL private/điều kiện sau kết thúc/chưa hoàn và browser payer→receiver confirmed đạt. Chưa đủ hai khoản pending/màn hình cũ đồng thời mọi phía. |
| D7-24 | một phần | SQL inbox đúng giải và browser realtime approve/paid/refund/settlement đạt. Cọc GIAI/ngân hàng/thu-hoàn-quyết toán thật chưa được phép. |

Dữ liệu thử đã dọn, kiểm lại cùng audit cuối; các phần thử qua dịch vụ thật còn mở như ghi trong bảng. Không kết luận sẵn sàng nhận tiền thật từ kết quả giả lập.
