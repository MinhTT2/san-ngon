# Biên bản D0 — nền kỹ thuật và trang công khai

Ngày kiểm tra: **09/10/2026**, khoảng **14:20–14:27 giờ Việt Nam**.

Kết quả: **8 case đạt trong phạm vi ghi dưới đây, 2 case không đạt**. Chưa có thay đổi sửa lỗi sản phẩm trong đợt này. Email thật của D1 có điểm chặn cấu hình; chưa gửi thư hoặc chuyển tiền để thử.

## Phạm vi và bản được kiểm tra

- Theo [kế hoạch 130 test case](test-plan-2026-10-09.md), bắt đầu đợt D0 sau khi người dùng đồng ý thực hiện dần.
- Người dùng đã chọn **project Supabase đang liên kết**, cho phép các đợt tích hợp tạo dữ liệu thử rồi dọn. D0 chỉ đọc database/config Auth; không tạo tài khoản, đơn, ảnh hoặc thay cấu hình.
- Local: Node **24.18.0**, npm **11.16.0**; chụp mã nguồn ở HEAD `7fca567c5da1941c8eaf6c2f51a191bc62c7aa86` cùng các thay đổi local có lúc chụp. Bản này được sao chép sang thư mục tạm rồi lint/typecheck/build và chạy production server riêng. Không dùng hoặc ghi đè `.next` của workspace.
- Bộ chụp lưu hash SHA-256 của từng file trong `output/d0-2026-10-09/results.json`. Workspace có công việc khác sửa song song; 15 file đã khác sau khi chạy, được ghi ở `source-drift.json`. Kết quả build chỉ áp dụng cho bản chụp, không tuyên bố bản workspace cuối cùng cũng đạt.
- Local chạy **105 lượt HTTP**: 11 trang công khai, 20 trang cần phiên, 8 đường không tồn tại/sai ID, 22 tổ hợp tham số tìm kiếm, 44 request API sai đầu vào hoặc không có phiên. Các request ghi đều bị từ chối trước nghiệp vụ; không gọi webhook để xác nhận tiền.
- Domain [san-ngon.vercel.app](https://san-ngon.vercel.app): thêm 19 lượt HTTP chỉ đọc, 20 liên kết nội bộ trang chủ và **13 lượt mở bằng Chromium headless 1440×1000**, context mới không có cookie cá nhân. Có một ảnh local đầu tiên. Chưa xác minh commit tương ứng của bản domain, vì vậy ghi kết quả domain riêng.
- Đây là kiểm tra nền và truy cập chưa đăng nhập. Chưa nghiệm thu giao diện mobile, quyền với phiên thật, đặt đồng thời hoặc ngân hàng; các phần đó thuộc đợt sau.

## Kết quả từng case

| Case | Kết quả | Bằng chứng và giới hạn |
| --- | --- | --- |
| D0-01 | Đạt | Chốt bản chụp/HEAD và hash nguồn, URL local/domain, project app khớp project CLI. Danh sách local/remote khớp khi rà ban đầu; truy vấn lại có 53 migrations, gồm `20261009000000_booking_input_guards` được công việc khác áp dụng trong lúc kiểm tra. Không tự áp dụng migration. Không gán commit local cho bản domain. |
| D0-02 | Đạt | Node 24.18.0; lint, typecheck, production build cùng exit 0 trên bản chụp. Có log riêng từng lệnh. |
| D0-03 | Đạt — local/cấu hình chỉ đọc | Supabase URL khớp project liên kết; biến SePay/OAuth/Telegram có mặt; khóa mã hóa đúng 64 ký tự hex; callback OAuth dùng HTTPS và `/api/sepay/callback` trên domain thật. Kiểm tra 124 file asset client không tìm thấy giá trị các khóa server local. Import admin client chỉ tới các route SePay qua helper server. Không xác nhận cấu hình/secret Vercel bằng kết quả local. |
| D0-04 | **Không đạt — P1** | Có đủ 3 cron active, 9 bảng realtime và GiST trên bookings. Tuy nhiên, `LivePageRefresh` đăng ký thêm `profiles`, `venues`, `courts`, `court_closures`, `feedback` mà publication hiện không có. Xem lỗi D0-B02. |
| D0-05 | Đạt | 11 trang public local trả 200 và có h1, 8 trang public domain trả 200. Chromium mở 8 trang public domain không có page exception. 20 liên kết nội bộ trang chủ đều trả trạng thái dưới 400 sau redirect. Chưa kiểm tất cả link của mọi trang. |
| D0-06 | Đạt — chưa đăng nhập | 20 trang riêng local chuyển về đăng nhập bằng redirect thường hoặc redirect streaming. Domain kiểm 6 trang riêng qua HTTP và 2 trang qua Chromium, đều tới đăng nhập. Đây chưa phải kiểm tra cách ly dữ liệu giữa hai người đã đăng nhập. |
| D0-07 | Đạt | 8 biến thể local gồm slug sân, ID giải/hồ sơ, mã checkout và URL không tồn tại đều trả 404, không trả stack trace. Domain cũng trả 404 cho ba biến thể đã chọn; Chromium hiện trang không tìm thấy có hướng dẫn. |
| D0-08 | **Không đạt — P1** | 21/22 biến thể HTTP local đạt. `/giai-dau?q=a&q=b` trả 500; tái hiện trên domain thật và Chromium. Xem lỗi D0-B01. |
| D0-09 | Đạt — không có phiên | 11 API × 4 body `{`/`null`/`{}`/ID sai, dùng đúng POST hoặc PATCH: tất cả trả 400/401 cùng thông báo lỗi, không 500. Với các API kiểm phiên trước, kết quả chứng minh yêu cầu chưa đăng nhập bị chặn, chưa chứng minh validation sau đăng nhập. Các route động/Storage và phiên thật kiểm ở các đợt liên quan. |
| D0-10 | Đạt — rà công cụ | Đã tách test mock/read-only/SQL rollback/live; xác nhận runner UI chỉ sao chép file được Git theo dõi. Tìm được fixture cọc 30.000đ lỗi thời trong script phí dịch vụ, chưa chạy script đó. Xem D0-T01. |

## Lỗi và điểm chặn

### D0-B01 — P1: tham số tìm giải bị lặp làm trang lỗi 500

- Case: **D0-08**, ảnh hưởng khám phá giải đấu **D7-01**.
- Tái hiện không cần đăng nhập: mở `/giai-dau?q=a&q=b`.
- Kỳ vọng: chuẩn hóa hoặc bỏ tham số sai rồi hiển thị trang hợp lệ; không lỗi server.
- Thực tế: local và [domain thật](https://san-ngon.vercel.app/giai-dau?q=a&q=b) trả **500**; trình duyệt hiện “Chưa tải được trang”. Log local: `TypeError: (a.q ?? "").trim is not a function`.
- Nguyên nhân trong `lib/tournament-discovery.ts:6`: hàm gọi `.trim()` với giá trị `q` được khai kiểu string, trong khi App Router có thể trả mảng khi tham số lặp. Trường `location` dòng 7 có cùng cách xử lý; biến thể này chưa thực thi trong đợt D0, cần bổ sung khi sửa.
- Hướng xử lý: chuẩn hóa kiểu tham số ở đầu vào, giữ cách xử lý nhất quán với tìm sân; thêm kiểm tra q/location lặp và dữ liệu hợp lệ. Chưa sửa trong task kiểm thử.
- Ảnh: [lỗi trên domain](../output/d0-2026-10-09/production-_giai_dau_q_a_q_b.png). Log: [server local](../output/d0-2026-10-09/server.log).

### D0-B02 — P1: publication thiếu bảng khu quản lý đang theo dõi

- Case: **D0-04**, liên quan D4/D8/D9 về đồng bộ khu quản lý.
- Đã truy vấn chỉ đọc `pg_publication_tables`, đối chiếu `components/live-page-refresh.tsx:9`.
- Publication có: `bookings`, `notifications`, `owner_subscriptions`, `subscription_invoices`, `tournaments`, `tournament_registrations`, `tournament_payment_events`, `tournament_settlements`, `tournament_transfers`.
- Thiếu so với subscriptions trong code: **profiles, venues, courts, court_closures, feedback**. Các event tương ứng không thể tới subscription này chỉ bằng cấu hình publication hiện tại.
- Có tải lại dự phòng mỗi 30 giây, focus/online; vì thế chưa kết luận giao diện hoàn toàn mất đồng bộ. Chưa tạo mutation để đo độ trễ thực tế trong đợt nền.
- Hướng xử lý: đồng bộ publication với subscriptions có chủ đích, kiểm lại RLS/phạm vi của từng vai trò. Không mở quyền đọc công khai `profiles` để làm realtime hoạt động. Chưa thay database.

### D1-C01 — P0: chưa đủ điều kiện nghiệm thu email người dùng

- Phát hiện bổ sung khi đọc Auth config; **D1-01 và phần nhận thư của D1-02/03/10/11 bị chặn**. Chưa tính là đã thực hiện toàn bộ D1.
- SMTP riêng: chưa cấu hình. Giới hạn gửi: **2 email/giờ**.
- Cấu hình hiện tại OTP **8 số, 3.600 giây**; cấu hình nghiệm thu trong script là **6 số, 600 giây**. Giao diện có hỗ trợ mã 6–8 số, nên không coi chỉ riêng độ dài 8 số là bằng chứng nhập OTP hỏng. Tuy nhiên, tiêu đề và mẫu confirmation chưa khớp mẫu dùng token của dự án.
- Email login được bật, tự xác nhận email tắt; Google provider được bật. Bật provider không chứng minh OAuth thực tế đã đạt.
- Auth site URL là domain thật; Redirect URLs có các domain triển khai và `http://localhost:3000/**`. Server D0 chạy cổng ngẫu nhiên để đọc trang, không dùng cổng này nghiệm thu callback đăng nhập.
- Local thiếu `RESEND_API_KEY` và `EMAIL_FROM`; chưa kiểm hai biến này trên Vercel.
- Cần cấu hình SMTP/domain/mẫu thư rồi kiểm tra hộp thư thật. Không đổi cấu hình hoặc gửi thư thử trong D0.

### D0-T01 — dữ liệu script test phí chưa theo kịp cọc 100%

- `scripts/check-owner-subscriptions.sql:19` tạo đơn một giờ giá 100.000đ; dòng 40 gửi `confirm_payment(...,30000,...)`, dòng 41 mong `CONFIRMED`.
- Với cọc mới 100%, fixture phải dùng số cọc đã đóng băng của chính đơn đó. Chưa chạy và chưa sửa script; cần xử lý trước **D6** để tránh báo sai lỗi sản phẩm.

### Thông tin vận hành cần giữ riêng

`booking_operator.multi_owner_enabled` đang **true** trên project liên kết. Đây là trạng thái đã có, không do đợt test bật. Chưa có bằng chứng nghiệm thu chuyển khoản thật trong đợt này; trạng thái true không được dùng thay cho biên bản ngân hàng. Không thay cờ hoặc người nhận tiền.

## Bằng chứng và cách diễn giải

Các tệp trong `output/d0-2026-10-09/` là bằng chứng local, không commit ảnh/log hoặc dữ liệu môi trường vào Git:

- [Kết quả local và hash nguồn](../output/d0-2026-10-09/results.json)
- [Cấu hình Auth/database đã lọc, không chứa secret](../output/d0-2026-10-09/config-summary.json)
- [HTTP domain](../output/d0-2026-10-09/production-public.json)
- [Chromium domain và liên kết trang chủ](../output/d0-2026-10-09/browser-followup.json)
- [File nguồn đã thay đổi sau bản chụp](../output/d0-2026-10-09/source-drift.json)
- [Lint](../output/d0-2026-10-09/lint.log), [typecheck](../output/d0-2026-10-09/typecheck.log), [build](../output/d0-2026-10-09/build.log)

Runner local có hai sai sót đã nhận diện: mong checkout mã sai trả 200 thay vì 404, và gọi `response.status()` với Fetch Response khi kiểm link. Vì vậy JSON thô có hai dòng FAIL D0-07 và `runner_error`; đây là lỗi công cụ, không phải lỗi sản phẩm. Đã sửa runner, không sửa kết quả thô; biên bản đối chiếu 404 với kỳ vọng case và chạy bổ sung HTTP/Chromium trên domain để hoàn tất bằng chứng. Build đã đạt trước lỗi runner; không chạy lại build chỉ để đổi phần thu thập ảnh. Bộ dữ liệu domain ghi rõ chưa xác minh build identity.

Ngoài D0, đã chạy kiểm tra riêng `check-request-inputs.mjs`, `check-password-reset.mjs`, `check-sepay-crypto.mjs`, `check-sepay-provider.mjs`: đều đạt tại bản nguồn lúc chạy. Các bài dùng mock/logic và không gửi email, không chuyển tiền; **không đánh dấu cả case D1/D5 đạt** từ những kết quả này. Do phần xác thực đang được công việc khác sửa, cần chụp bản mới và chạy lại kiểm tra liên quan ở D1.

## Bước tiếp theo

Tiếp tục D1 với phiên/tài khoản thử trên project đã được người dùng chọn; kiểm trước bản mới và dọn dữ liệu sau chạy. Phần nhận email/Google thật ghi riêng, không dùng mock thay thế. Giữ D1-C01 bị chặn cho đến khi cấu hình gửi thư đủ và nhận thư được nghiệm thu. Hai lỗi D0-B01/B02 cần được xử lý và chạy lại đúng case trước khi đóng lỗi.
