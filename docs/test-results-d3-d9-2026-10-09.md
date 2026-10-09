# Kết quả kiểm thử đến D9 — 09/10/2026

Đã thực hiện các lượt kiểm và đối chiếu **toàn bộ 92 case D3–D9**. Kết quả còn các biến thể chưa nghiệm thu; không coi việc đã chạy bộ script là tất cả case đạt. Phạm vi của người dùng là project Supabase liên kết, dữ liệu thử và dọn sau chạy. Không sửa sản phẩm trong task này.

## Kết quả từng mốc

| Đợt | Đạt | Không đạt | Một phần | Bị chặn | Biên bản |
| --- | ---: | ---: | ---: | ---: | --- |
| D3 | 5 | 0 | 5 | 0 | [Chi tiết](test-results-d3-2026-10-09.md) |
| D4 | 7 | 0 | 7 | 0 | [Chi tiết](test-results-d4-2026-10-09.md) |
| D5 | 11 | 0 | 2 | 1 | [Chi tiết](test-results-d5-2026-10-09.md) |
| D6 | 8 | 0 | 3 | 1 | [Chi tiết](test-results-d6-2026-10-09.md) |
| D7 | 16 | 0 | 8 | 0 | [Chi tiết](test-results-d7-2026-10-09.md) |
| D8 | 8 | 0 | 2 | 0 | [Chi tiết](test-results-d8-2026-10-09.md) |
| D9 | 3 | 1 | 4 | 0 | [Chi tiết](test-results-d9-2026-10-09.md) |
| **D3–D9** | **58** | **1** | **31** | **2** | **92 case** |

D0–D2 đã ghi trước: 28 đạt, 4 không đạt, 6 bị chặn (có biến thể đạt một phần). Tổng kế hoạch 130 case hiện là **86 đạt, 5 không đạt, 31 một phần và 8 bị chặn**. Giữ phân loại chính của D1 là bị chặn. Kết quả lịch sử giữ theo bản test; chưa coi lỗi D0/D1 đã được sửa chỉ vì có thay đổi mã mới.

## Lỗi và tình trạng kiểm lại

**D3-F01 — thiếu kiểm Origin ở hai API ghi (P1, case D3-09 ưu tiên P0 trong kế hoạch).**

Với cookie phiên Chromium thử và header `Origin: https://untrusted.example`:

| Request | Thực tế | Kỳ vọng case |
| --- | --- | --- |
| POST `/api/bookings`, court/time/contact hợp lệ của fixture | 201, tạo đơn thật | 403, không tạo |
| PATCH `/api/profile`, họ tên/phone hợp lệ của fixture | 200, lưu hồ sơ | 403, không lưu |
| POST `/api/favorites` | 403 | 403 |
| POST `/auth/dang-xuat` | 403 | 403 |

Tái hiện hai lượt độc lập trong `last/core` và `confirmed/core`; dữ liệu thử được hủy/dọn. `app/api/bookings/route.ts` và `app/api/profile/route.ts` không kiểm Origin; không có global Origin guard. Đây là kết quả request chủ động kèm cookie bằng Playwright API. **Chưa chứng minh website ngoài có thể lấy/gửi cookie của người dùng qua CORS/SameSite trên deployment**, nên không gọi đây là bằng chứng khai thác CSRF hoàn chỉnh. Nội dung HTML thử trên checkout và inbox được render như text, không chạy script.

Task kiểm thử này không sửa mã sản phẩm. Trong lúc chạy, công việc khác đã thêm guard ở middleware. Bản local mới được build và retest độc lập: **48 request có cookie fixture với Origin ngoài/null/thiếu đều403**, same-origin API/native browser fetch và logout đạt, webhook sai key401. D3-09 được cập nhật đạt ở snapshot này; không suy ra deployment đã nhận bản sửa. Lần build kiểm lại đầu tiên dừng ở webhook500 do thiếu service key; hash webhook lúc sao chép còn bản cũ. Lần build sau với source guard key trước admin client đạt, lưu cả hai kết quả và drift.

### D9-F01 — P2: tràn ngang khi tăng cỡ chữ ở mobile

Build cô lập trên Chromium headless; 25 trang, hai chiều rộng360/1440px, root font16/32px tạo100mẫu. **Cỡ thường50/50 đạt;1440px chữ200%25/25 đạt;360px chữ200%16/25 đạt,9trang tràn ngang**. Không có lỗi JavaScript. Đây là mô phỏng tăng cỡ chữ bằng root font, không phải thao tác zoom native của trình duyệt.

| Trang | Viewport | Chiều rộng document ở chữ200% |
| --- | ---: | ---: |
| `/lien-he` |360|437|
| `/chu-san` |360|468|
| `/chu-san/lich` |360|458|
| `/chu-san/don` |360|378|
| `/tao-cum-san` |360|369|
| `/admin` |360|553|
| `/admin/giai-dau` |360|390|
| `/don-cua-toi` |360|529|
| `/dat-san/SANDEF567` (fixture) |360|492|

Cách tái hiện: mở một trang trên ở viewport360px, đợi font tải, tăng root font-size từ16px lên32px, so `document.documentElement.scrollWidth` với `innerWidth`. Đã xem ảnh checkout và liên hệ: nội dung/thẻ vượt cạnh phải; chữ email và phần QR không còn nằm gọn trong chiều rộng. Ảnh, kết quả từng mẫu và source hashes nằm trong `text-width/` và `text-width-build.json`. Chưa sửa sản phẩm trong task này.

## Quan sát và lỗi bộ test đã xử lý

- `check-booking-polish`: fail đo CTA44 trước ổn định; diagnostic320px ba lượt44, retest sau font/animation44 ở320/390/768/1440, toàn bộ phần cancel/refund còn lại đạt. Giữ lần fail và source hash riêng, không xóa bằng chứng.
- Tournament selector `getByText('Đăng ký của bạn')` trùng link+heading: sửa locator trong bản harness cô lập sang heading rồi chạy tiếp. Không sửa sản phẩm.
- Harness tournament mong thanh toán ở document y<500 nhưng đo612px. Ảnh390px được xem: đăng ký/QR nằm trước lịch, ảnh và thể lệ dài, link tab dẫn đúng. Ghi **D9-O02, tiêu chí threshold chưa được chốt**, không kết luận lỗi nghiệp vụ; không bỏ qua bằng chứng original assert. Lượt luồng còn lại chạy tiếp và đạt.
- PostgreSQL RPC void trả204, không phải200; đăng ký chủ sân tạo mới201; anonymous select `bookings.*` có thể403 vì cột private. Rerun dùng status/column contract đúng.
- Cọc sân chuyển thừa: `payments.amount` giữ nghĩa vụ đã đóng băng100.500, `sepay_events.amount` ghi thực nhận110.500; harness từng mong110.500 trong payments gây fail. Kiểm SQL rollback độc lập xác nhận no-sum/retry/excess đúng, không tính lỗi sản phẩm.
- Guard tắt sân cuối là deferred constraint; bổ sung `SET CONSTRAINTS ALL IMMEDIATE` trước kết luận SQL. CRUD test cuối đạt.
- Race hủy/nhận cọc lúc đầu giả định payment luôn paid: sau hủy nó phải failed và refund needed. Sửa expectation trong harness theo cả hai thứ tự, chạy5rounds đủ hai kết quả đạt; không sửa sản phẩm. Cleanup không được xóa trực tiếp storage.objects, đã dùng Storage API cho đúng metadata fixture, kiểm lại0.
- CLI có timeout/auth temporary-role khi các runner dùng cùng project; những lượt không có completion sentinel không tính đạt. Các fixture đã commit thành công được dọn và audit lại. Không suy ra đó là outage sản phẩm.
- D2-O01 tìm mã từng43.637s vẫn cần đo latency riêng; bộ fixture D9 kiểm phục hồi không chứng minh vấn đề này đã hết.

## Môi trường và giới hạn

- Node24.18.0, Chromium headless executable riêng, context theo vai trò; không dùng Chrome/tab/cookie cá nhân.
- Mỗi build sao chép cả tracked/untracked source, loại `.env*` và `output/`, hash từng file. Mã đang thay đổi từ công việc khác nên không gọi các snapshot là production.
- UI fixture không có khóa live; lượt tích hợp dùng Supabase thật và user/password ngẫu nhiên `example.invalid` đã xác thực fixture. Webhook tiền là localhost hoặc RPC HTTP quyền payment, không chuyển tiền.
- Tắt RESEND/EMAIL_FROM/TELEGRAM_BOT_TOKEN trên app test. Không gọi cấp quyền Google/SePay, gửi email/bot hoặc thay cấu hình deploy/gate.
- SQL rollback có thể bật gate/đổi receiver **chỉ trong transaction đã rollback**. Lượt live yêu cầu gate hiện tại đã mở và không thay gate để chạy.
- 62 migrations; hash booking/confirm_payment/operator/subscription_receiver cuối trùng với trước suite.
- Lint/typecheck/build thành công trên các snapshot; không rerun vô hạn chỉ để kiểm changes của task khác.

| Snapshot evidence | HEAD tại sao chép | Hash nguồn | Drift sau chạy |
| --- | --- | --- | --- |
| ui-results.json | `db3934dc7987cecee91c1524b627927e2fa2959e` | 433 file có SHA256 | app/(site)/page.tsx, docs/ui-ux-progress-2026-10-09.md, scripts/check-public-ui.mjs, scripts/check-remaining-ux.mjs |
| ui-retest-results.json | `d427233b76c9ebf08ff8a23cd8a7c09df74139cc` | 433 file có SHA256 | Không ghi nhận |
| live/results.json | `d427233b76c9ebf08ff8a23cd8a7c09df74139cc` | 433 file có SHA256 | Không ghi nhận |
| final/results.json | `d427233b76c9ebf08ff8a23cd8a7c09df74139cc` | 433 file có SHA256 | Không ghi nhận |
| confirmed/results.json | `d427233b76c9ebf08ff8a23cd8a7c09df74139cc` | 433 file có SHA256 | Không ghi nhận |
| text-width-build.json | `d427233b76c9ebf08ff8a23cd8a7c09df74139cc` | 441 file có SHA256 | .github/workflows/ci.yml, lib/request-origin.ts, middleware.ts, scripts/run-ui-checks.mjs |
| origin-retest-build.json | `d427233b76c9ebf08ff8a23cd8a7c09df74139cc` | 443 file có SHA256 | scripts/check-request-origin.mjs, app/api/webhooks/sepay/route.ts |
| origin-final-build.json | `d427233b76c9ebf08ff8a23cd8a7c09df74139cc` | 444 file có SHA256 | docs/development-progress-2026-10-09.md |

## Index bằng chứng local

Các file bên dưới ở `output/remaining-tests-2026-10-09/`; không đưa secret/token, giấy tờ hay dữ liệu ngân hàng thật lên Git. Báo cáo được commit, ảnh/log/harness giữ local.

| Nhóm | File | Nội dung |
| --- | --- | --- |
| SQL rollback | `sql/results.json` | 13/13 script, 355 assertion/negative markers; hash source và adaptation; metadata trước/sau trùng. |
| UI fixture | `ui-results.json` | 20/21 pass lần đầu; polish measurement fail được kiểm lại riêng. |
| UI retest | `ui-retest-results.json` | Polish đạt sau fonts/animation settle; min-height44 ở320/390/768/1440; bản chụp khác được ghi hash. |
| Contracts | `live/results.json` | 8 scripts pass; crypto/provider/ref/email/refresh/session/input/notification. Có build+lint+typecheck. |
| Linked JWT/API/Storage | `confirmed/core/results.json` | Phiên thật, Storage/signed expiry, receiver webhook, 3 closure race, 5 invoice race, 8 channel visibility, real private realtime. Một số lỗi harness được diễn giải ở dưới. |
| Tournament browser | `final/tournament/result.json` | 4 phiên thật, local webhook giả, approve/paid/refund realtime, timer, hai phía quyết toán. |
| Images browser | `live/images-live.log` | Toàn bộ assertions tính năng PASS; final cleanup có lỗi CLI đã dọn/kiểm lại image-cleanup.json. |
| Utilities browser | `final/utilities/result.json` | Feedback/admin/favorite/share/ICS/help/3901440 real sessions pass. |
| Concurrent tournament | `tournament-races/results.json` | Capacity race và 5 payment RPC race đạt; cleanup repaired verified0. |
| Boundary additions | `extra-sql/results.json` | Fees và tournaments bổ sung rollback pass: normal February/no-sum/snapshot/refund boundaries/zero deposit. |
| Owner CRUD | `crud-extra.sql` | Thực thi hoàn tất rollback; guards future bookings/last court và giá cũ/mới. |
| SAN receipt | `payment-proof.sql` | Thực thi hoàn tất rollback; payments là nghĩa vụ còn actual amount ở sepay_events. |
| OAuth guard | `oauth-state-results.json` | 15 callback mocked guards pass, không cấp quyền thật. |
| Provider retry/refresh | `provider-flow-results.json` | 13 actual helper/route tests với HTTP/DB mock pass; không gọi SePay. |
| Waiver và legacy policy | `waive-legacy.sql` | Completion sentinel pass, rollback; ghi chú, phương án mâu thuẫn, giải cũ policy0 và deadline snapshot. |
| Feedback biên | `feedback-extra.sql` | Completion sentinel pass, rollback;3category và chiều dài chữ Việt. |
| Legacy và rollout | `legacy-gates-extra.sql` | Completion sentinel pass, rollback; snapshot người nhận cũ/mới/ngắt; exempt/paid không vượt rollout gate. |
| Nghĩa vụ khi hết phí | `expired-obligations-extra.sql` | Completion sentinel pass, rollback; sửa thông tin/xem lịch/hoàn cũ và retry không ghi lặp. |
| Booking/admin races | `booking-owner-races/results.json` | 5 hủy/nhận cọc races, expiry now,2admin review và reject/resubmit bằng JWT thật; cleanup0. |
| Cỡ chữ/360px | `text-width/results.json` | 100 mẫu,91 đạt9fail; root font200% tại360px tràn ngang; screenshots riêng. |
| Origin retest | `origin-final-build.json` | Snapshot local mới,48write guard, same-origin/native fetch/logout và webhook auth; xem trạng thái script trong file. |
| Bundle browser | `public-bundle-scan.json` | Chỉ public static assets của build cô lập; không quét log/deployment. |
| Telegram contracts | `telegram-contract-results.json` | 9contracts actual route với mock notify/DB; không gửi Telegram. |
| Telegram SQL | `telegram-extra.sql` | Anon token sai/empty chat/one-use/exact expiry; completion sentinel rollback pass. |
| Cleanup audit | `final-cleanup-audit.json` | 67 actor IDs, 15 nhóm counts đều0; configuration/schema/functions hash giữ nguyên. |

## Dọn dữ liệu và phần cần nghiệm thu tiếp

Audit cuối gom67 actor IDs từ fixture manifests/cleanup SQL. **Auth, profiles, venues, bookings, notifications, tournaments, registrations, SePay connections/states, subscriptions/invoices, community, favorites, feedback và Storage đều0**. Claims các race có audit riêng0. Lỗi cleanup do FK/community/fee/closure/tournament notifications và một file PDF chưa được tracked trong harness đã sửa cách dọn, chạy lại và xác nhận không còn dữ liệu thử. Không dọn các record ngoài ID đã tạo trong lượt này.

Chưa nghiệm thu chuyển khoản SAN/PHI/GIAI thật, Google/SePay consent thật và nhận email/Telegram thật. Còn phần coverage trong từng bảng, nhất là các ma trận scope còn thiếu, fee realtime, nhập vào ứng dụng lịch và quan sát cron thật. Provider refresh/retry, race hủy/nhận cọc, legacy/gate, waiver và biên góp ý đã bổ sung; cỡ chữ360px có lỗi D9-F01. Phần lý do từ chối hồ sơ chủ sân trong kế hoạch chưa có trường tương ứng ở RPC/API trong bản đã test. Công việc khác đang bổ sung sau snapshot; chưa nâng thành đạt nếu chưa chạy lại. Những mục này có ghi rõ bằng chứng đã đạt và biến thể thiếu, không nâng thành đạt.

Đã đi đến mốc D9 của lượt rà soát, **chưa hoàn tất nghiệm thu toàn bộ130 case**. Không kết luận sẵn sàng nhận tiền thật.
