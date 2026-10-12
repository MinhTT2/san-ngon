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

## A03 — sổ tiền vào theo tài khoản nhận

- `/chu-san/tien-vao` và `/admin/tien-vao` phân trang 30 giao dịch, tìm mã sân/giải/phí hoặc mã ngân hàng, lọc cần đối soát/đã khớp/tất cả. Số thực nhận tách khỏi cọc/phí theo mã; không gắn nhãn doanh thu hoặc khoản còn phải hoàn.
- Webhook đã xác thực lưu cả giao dịch không mã, nhiều mã, mã không tồn tại, thiếu/thừa, chuyển thêm và muộn qua `process_incoming_transfer`. RPC gọi các hàm xác nhận hiện tại trong cùng transaction, giữ chống dùng lại giao dịch giữa sân/giải/phí. Hai khoản thiếu không tự cộng để xác nhận; retry không gửi lại thông báo xác nhận.
- Số tiền, ngân hàng, tài khoản, mã giao dịch, mã nội dung và payload ban đầu được giữ nguyên bằng trigger. Retry đổi số tiền/mã/kết nối chỉ tăng cờ xung đột, không ghi đè giao dịch gốc hoặc tự gán tiền. Giấy tờ/payload/kết quả SQL không nằm trong projection đọc của trình duyệt.
- Các bảng sổ/ghi chú không mở quyền đọc/ghi trực tiếp cho browser. RPC kiểm tra tài khoản đang hoạt động và người nhận tiền hoặc admin; người đóng phí không được xem sổ của người nhận chỉ vì họ là người trả.
- Ghi chú 10–1.000 ký tự, lưu người/thời điểm, idempotent theo request UUID, kiểm tra cập nhật đồng thời. Ghi chú không xóa cờ cần đối soát, không phải chứng từ hoàn và không tự gán tiền vào đơn. Mất mạng/lưu lỗi giữ nội dung; bản gửi lại giữ UUID.
- Backfill chỉ các giao dịch cũ thực sự tồn tại ở sổ sân/giải/phí. Sổ SAN cũ không lưu outcome gốc nên ghi `historical`; không suy đoán đã khớp từ trạng thái đơn hiện nay. Không thể phục hồi những khoản không mã/mơ hồ đã bị bỏ qua trước đây.
- Luồng checkout vẫn dùng realtime, không thêm polling. Sổ tiền vào tải lại qua phiên người dùng khi quay lại/nối mạng và cơ chế refresh read view; bảng raw không được công khai cho realtime.

Kiểm tra đạt: SQL ứng viên rollback và SQL sau triển khai cho exact/short/two-short/short-then-full/over/duplicate/late/manual/no-code/ambiguous/unknown/conflict, cross-flow claims, OAuth/người nhận khác, giới hạn trang và tìm literal, quyền/ban và notes retry/stale. API mocks kiểm tra auth, SAN/PHI/GIAI, HTTP 200/401/500, che lỗi DB, không gửi thông báo lần hai và note validation. Build production cô lập có lint/typecheck; UI 390/1440 cho sổ và ghi chú đạt. Hồi quy origin, checkout 320–1440 và dashboard đạt. Bài browser đầu chọn nhầm control vì nhãn bọc textarea làm accessible name chứa nội dung; đã tách label/control, chặn nhập trước hydration và chạy lại đạt. Không dùng giao dịch/người nhận thật trong tests.

Migration `20261012000200_incoming_transfer_ledger.sql` đã áp dụng. **A03 đã có sổ nhận và đường đối soát; A10 chứng từ/số thực hoàn chưa hoàn thành.** Sổ này không cung cấp nút “đã giải quyết” thay cho nghiệp vụ hoàn tiền.

```sh
npx supabase db query --linked --file scripts/check-incoming-transfers.sql
node scripts/check-incoming-transfer-api.mjs
npm run check:ui -- --only=check-incoming-transfers-browser,check-policy-pages-browser
```

## A17 — quyền riêng tư và điều khoản

- Bổ sung `/quyen-rieng-tu` và `/dieu-khoan-su-dung`, liên kết footer/sitemap. Nêu tài khoản/đơn/giấy tờ/giao dịch/chứng từ/giải/Kết nối; ai xem, lựa chọn công khai từng kênh, nhà cung cấp, cookie phiên và hỗ trợ.
- Hướng dẫn sửa/ẩn ngay trên website và gửi yêu cầu xem/sửa/xóa qua hỗ trợ có phiên hoặc email đã công bố. Không dựng nút xóa dữ liệu tài chính tự động, không hứa một thời hạn lưu/xóa chưa có quy trình. Nêu rõ đối soát/hoàn/tranh chấp còn mở cần được kiểm tra trước khi xử lý dữ liệu.
- Điều khoản khớp 15 phút giữ chỗ, 100% cọc đơn mới, người nhận theo đơn, hủy sân 2 giờ/giải 24 giờ và phí 299.000đ. Trách nhiệm sân/giải và hoàn thủ công được giải thích riêng.
- UI 390/1440, anonymous và no-JS, đường hỗ trợ/email và sitemap không thêm route riêng tư: đạt. Nội dung cần người vận hành rà soát và chốt thời hạn giữ dữ liệu thực tế; **A17 chưa phải nghiệm thu vận hành/chính sách hoàn tất**.

## Bảng công việc còn lại sau rà soát

| Mục | Trạng thái và phần cần làm |
| --- | --- |
| A02/A09/A12/A13/A15/A16 | Code đã bàn giao; giữ các kiểm tra hồi quy và biên bản tương ứng. |
| A04 | Snapshot đã bàn giao đợt này; nghiệm thu trách nhiệm/hoàn tiền thật nằm trong A05/A10. |
| A03/A10 | Sổ tiền vào A03 đã bàn giao. A10 tiếp tục cần ghi hoàn với số thực tế, tham chiếu, người/thời điểm; sổ nhận/CSV nghĩa vụ/biên lai hỗ trợ chưa thay chứng từ hoàn. |
| A11/A14 | Hàng đợi gửi bền vững, retry/timeout và nhật ký thao tác/cảnh báo cần phát triển; không coi log hoặc inbox hiện tại là đã đủ. |
| A17/A18 | Trang riêng tư/điều khoản và đường yêu cầu dữ liệu đã bổ sung; cần chốt quy trình/thời hạn lưu. Báo cáo đối tượng và ẩn nội dung có lịch sử A18 còn mở. |
| A07 | Runtime đã vá; công cụ phát triển còn advisory phải rà tính tương thích và ghi ngoại lệ. |
| A23 | SQL test đã có; chưa có môi trường DB thử riêng cho CI, không tự chạy CI lên project thật. |
| A24/A25 | Chưa có bằng chứng đo p75 hiệu năng và hành trình đủ trên domain thật. Kiểm kê cấu hình trước khi thêm công cụ. |
| A26/A27/A30 | Tiếp tục đồng bộ tài liệu, báo cáo thực nhận/hoàn và SEO public đúng dữ liệu; giữ bản bàn giao tách khỏi thay đổi local của công việc khác. |
| A01/A05/A06/A08 | Cần bằng chứng ngoài code: nhận OTP/email, OAuth và chuyển khoản/hoàn thật, ảnh/giá/lịch sân thật, backup Storage/DB/khóa và thử phục hồi riêng. |
| A19–A22 | UI và nhiều luồng đã có test; còn quan sát người thật, Safari/app ngân hàng/lịch, screen reader/zoom, deadline/realtime và nghiệm thu giải toàn vòng. D9-F01 cỡ chữ lớn vẫn cần kiểm lại khi sửa giao diện. |
| A28/A29 | Chỉ phát triển lịch tuần hoặc đơn offline sau quy tắc tiền/xung đột; hiện dùng nhiều đơn riêng và khóa lịch như MVP đã chốt. |

Không đánh dấu toàn website đã xong, không thay dữ liệu demo bằng dữ liệu dựng và không thực hiện chuyển tiền/gửi thông báo thật từ bài kiểm tra.
