# Rà soát và phát triển tiếp — 12/10/2026

Tiếp nối [đánh giá 30 mục](website-assessment-2026-10-09.md), [các đợt đã bàn giao](development-progress-2026-10-09.md) và [nghiệm thu còn mở](test-results-d3-d9-2026-10-09.md). Không xem một file local hoặc một bài mock là nghiệm thu vận hành thật.

## Tính năng mới đã rà lại

- Lọc Hòa Lạc/Thạch Thất, địa chỉ và bộ lọc của chủ sân/admin dùng danh sách khu vực chung.
- Người tham gia giải mặc định chỉ gồm suất đã trả đủ cọc hoặc không cần cọc; giữ bộ lọc đăng ký chờ/hết hạn/hủy và tìm người/đội.
- Admin xóa giải không còn nghĩa vụ tài chính; không xóa mã cọc từng được cấp, giao dịch hay quyết toán có tiền. Thông báo được giữ, người liên quan được báo và lịch sân mở lại.
- Admin xóa cụm sân chưa có đơn/giải; SQL khóa cụm và sân con trước kiểm tra. Quyền chủ sân vẫn qua RPC riêng.
- Đã chạy lại `check-tournament-journey.mjs`, `check-admin-delete-tournament.sql`, `check-admin-delete-venue.sql`: đạt. Hai bài SQL rollback, không xóa dữ liệu thực. Nghiệm thu chuyển khoản thật vẫn mở.

## A04 — lưu chính sách theo từng đơn

- SQL đóng băng mốc hủy 2 giờ, thời hạn hoàn thủ công 3 ngày làm việc và phiên bản điều khoản `ordinary-2026-10-09` trên đơn mới. Thời hạn bắt đầu sau khi đủ thông tin đối soát/nhận tiền; không tự tạo ngày đến hạn khi chưa có thông tin này.
- Trigger bỏ qua giá trị chính sách giả mạo lúc insert và chặn sửa snapshot sau đó, kể cả qua client đặc quyền. Không cấp quyền update các cột mới cho trình duyệt.
- Đơn trước migration giữ mốc 2 giờ đang dùng trong SQL; thời hạn hoàn khi đó chưa được lưu nên để null, phiên bản `previous-unversioned`. UI nói rõ giới hạn dữ liệu thay vì dựng điều khoản lịch sử.
- `cancel_booking` quyết định hoàn bằng mốc của chính đơn. Retry tạo đơn trả chính sách cũ, không đổi theo chính sách mới. SQL trả thời điểm giới hạn hủy cho danh sách cá nhân, frontend chỉ so sánh UTC instant/format.
- Checkout và danh sách đơn hiển thị điều khoản riêng. Chính sách giải đấu 24 giờ tiếp tục tách biệt.

Kiểm tra đạt: SQL ứng viên + rollback và SQL sau triển khai; giá trị giả lúc insert, chặn sửa snapshot, retry, hai chính sách khác nhau, đúng ranh giới và trước ranh giới một giây; hồi quy giữ chỗ/nhận tiền/hủy; API đặt sân; production build với lint/typecheck của bản bàn giao; giao diện chính sách 390/1440, đặt sân, checkout 320–1440 và lịch sử phân trang. Bài giao diện chính sách lần đầu chọn nhầm đơn chờ thay vì đơn cũ, đã sửa selector theo mã đơn và chạy lại đạt trên cùng build cô lập. Không có thay đổi sản phẩm để che lỗi test.

Migration `20261012000100_booking_policy_snapshot.sql` đã áp dụng lên Supabase liên kết. Types phần thay đổi lấy từ database triển khai. **A04 hoàn thành về code và điều khoản đã chốt; vận hành hoàn tiền thật vẫn cần nghiệm thu.**

```sh
npx supabase db query --linked --file scripts/check-booking-policy.sql
npx supabase db query --linked --file scripts/check-booking-holds.sql
npm run check:ui -- --only=check-booking-policy-browser,check-booking-polish,check-player-booking-search,check-checkout-ux
```

## Bảng công việc còn lại sau rà soát

| Mục | Trạng thái và phần cần làm |
| --- | --- |
| A02/A09/A12/A13/A15/A16 | Code đã bàn giao; giữ các kiểm tra hồi quy và biên bản tương ứng. |
| A04 | Snapshot đã bàn giao đợt này; nghiệm thu trách nhiệm/hoàn tiền thật nằm trong A05/A10. |
| A03/A10 | Ưu tiên tiếp: sổ tiền vào thiếu/thừa/trùng/muộn/không mã và ghi hoàn với số thực tế, tham chiếu, người/thời điểm. CSV nghĩa vụ và form gửi biên lai hiện có chưa thay hai mục này. |
| A11/A14 | Hàng đợi gửi bền vững, retry/timeout và nhật ký thao tác/cảnh báo cần phát triển; không coi log hoặc inbox hiện tại là đã đủ. |
| A17/A18 | Trang riêng tư/điều khoản, yêu cầu dữ liệu và báo cáo nội dung công khai/ẩn nội dung có lịch sử cần hoàn thiện. |
| A07 | Runtime đã vá; công cụ phát triển còn advisory phải rà tính tương thích và ghi ngoại lệ. |
| A23 | SQL test đã có; chưa có môi trường DB thử riêng cho CI, không tự chạy CI lên project thật. |
| A24/A25 | Chưa có bằng chứng đo p75 hiệu năng và hành trình đủ trên domain thật. Kiểm kê cấu hình trước khi thêm công cụ. |
| A26/A27/A30 | Tiếp tục đồng bộ tài liệu, báo cáo thực nhận/hoàn và SEO public đúng dữ liệu; giữ bản bàn giao tách khỏi thay đổi local của công việc khác. |
| A01/A05/A06/A08 | Cần bằng chứng ngoài code: nhận OTP/email, OAuth và chuyển khoản/hoàn thật, ảnh/giá/lịch sân thật, backup Storage/DB/khóa và thử phục hồi riêng. |
| A19–A22 | UI và nhiều luồng đã có test; còn quan sát người thật, Safari/app ngân hàng/lịch, screen reader/zoom, deadline/realtime và nghiệm thu giải toàn vòng. D9-F01 cỡ chữ lớn vẫn cần kiểm lại khi sửa giao diện. |
| A28/A29 | Chỉ phát triển lịch tuần hoặc đơn offline sau quy tắc tiền/xung đột; hiện dùng nhiều đơn riêng và khóa lịch như MVP đã chốt. |

Không đánh dấu toàn website đã xong, không thay dữ liệu demo bằng dữ liệu dựng và không thực hiện chuyển tiền/gửi thông báo thật từ bài kiểm tra.
