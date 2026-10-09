# Biên bản D1 — xác thực và phiên đăng nhập

Ngày kiểm tra: **09/10/2026**, khoảng **14:34–14:44 giờ Việt Nam**.

Kết quả theo 12 case: **4 đạt trong phạm vi ghi nhận, 2 không đạt, 6 bị chặn hoặc mới kiểm được một phần**. Có hai lỗi điều hướng P1 và một góp ý thông báo P2. Chưa nghiệm thu trọn luồng đăng ký/khôi phục qua hộp thư hoặc Google thật. Đợt này chỉ kiểm thử và viết biên bản, không sửa mã sản phẩm.

## Phạm vi và bản kiểm tra

- Theo [kế hoạch kiểm thử](test-plan-2026-10-09.md), dùng project Supabase đang liên kết theo lựa chọn của người dùng; tạo dữ liệu thử rồi dọn.
- Tích hợp local chạy từ bản chụp nguồn riêng: HEAD **`6e61b121a3250035a0fd9473b62609d0fc14ca08`**, cộng các thay đổi local có lúc chụp. Hash từng file nằm trong `output/d1-2026-10-09/results.json`; HEAD không đại diện đầy đủ cho bản chụp có thay đổi chưa commit.
- Node **24.18.0**, Next **15.5.27**, Chromium **153.0.8010.12** headless, context riêng. Lượt xác minh cuối dùng `http://127.0.0.1:45037`. Không dùng tab/cookie/Google cá nhân; không ghi đè `.next` của workspace.
- UI trên [domain triển khai](https://san-ngon.vercel.app) chạy ở 390×844; **chưa xác minh commit triển khai**. Tất cả request ghi Auth được chặn và trả kết quả giả lập; các request ghi khác bị chặn. Kết quả này chứng minh cách form xử lý phản hồi, không chứng minh gửi thư hoặc tạo phiên thật trên domain.
- Cả hai lượt tích hợp đều build thành công, kiểm tra logic đầu vào và đặt lại mật khẩu thành công. Không chạy lại toàn bộ CI của D0 để nghiệm thu riêng hai tài liệu.
- Trong lượt cuối, workspace thay đổi sáu file: `app/(site)/don-cua-toi/page.tsx`, `app/(site)/san/[slug]/page.tsx`, `app/(site)/san/[slug]/venue-schedule.tsx`, `app/api/bookings/route.ts`, `components/booking-form.tsx`, `lib/constants.ts`. Server thử dùng bản chụp cố định; không gán kết quả cho các thay đổi đến sau. Các file Auth không đổi trong lượt này.

## Kết quả từng case

“Đạt — UI cô lập” giới hạn ở hành vi form với phản hồi giả lập. “Bị chặn — một phần đạt” không được cộng vào số case đạt.

| Case | Kết quả | Bằng chứng và giới hạn |
| --- | --- | --- |
| D1-01 | **Bị chặn** | Chưa gửi email đăng ký và chưa nhận OTP thật. Cấu hình email đã ghi ở D1-C01 của biên bản D0 chưa đủ điều kiện nghiệm thu. Tài khoản được dựng cho test phiên không thay thế đăng ký qua hộp thư. |
| D1-02 | **Bị chặn — một phần đạt** | UI chặn mã 5 số, loại ký tự không phải số; gửi được định dạng 6/8 số và hiển thị lỗi OTP, nút cho thử lại. Tài khoản chưa xác thực thật được đưa vào bước OTP; Auth từ chối mã sai 403. OTP tự dựng bị từ chối cả khi mới và khi đã đặt thời điểm cũ, nên chưa chứng minh được OTP hợp lệ hoặc hết hạn thật. |
| D1-03 | **Bị chặn — một phần đạt** | UI khóa gửi lại trong thời gian chờ ban đầu; bấm nút bị khóa không gửi thêm request. Recovery xử lý 429 giả lập bằng hướng dẫn/thời gian chờ. Chưa thử gửi lại OTP sau thời gian chờ và nhận thư thật; 429 recovery không thay thế 429 resend OTP. |
| D1-04 | **Đạt — UI cô lập** | Mật khẩu nhập lại không khớp không gửi signup; phản hồi email đã tồn tại có hướng dẫn đăng nhập; email được trim; lỗi mạng cho thử lại và đi tiếp tới OTP khi provider giả lập trả thành công. Chưa xác minh signup/email tồn tại bằng request ghi Auth thật. |
| D1-05 | **Đạt — tích hợp** | Mật khẩu sai bị từ chối; email có khoảng trắng được chuẩn hóa; đăng nhập đúng bằng fixture thật, trang tài khoản/header đọc đúng người, tải lại giữ phiên. |
| D1-06 | **Không đạt — P1** | Local: khách chọn sân/ngày 16/10, nhập tên/điện thoại/ghi chú, đăng nhập thật rồi về đúng sân/ngày và phục hồi liên hệ; không tạo đơn. Domain: đi qua liên kết quên mật khẩu làm mất `next` (D1-B01). Chưa tạo tình huống lịch bị người khác lấy trong khi đăng nhập; bổ sung ở D2. |
| D1-07 | **Bị chặn — một phần đạt** | Google provider bị tắt giả lập hiện hướng dẫn tiếng Việt và không rời website. Callback thiếu/sai code có đường phục hồi ở local. Chưa dùng tài khoản Google thử để xác minh thành công hoặc từ chối consent thật. |
| D1-08 | **Đạt — đầu vào đã chọn** | Đường nội bộ về tài khoản/sân hoạt động qua đăng nhập thật. `next` là URL ngoài, `//`, dấu gạch chéo ngược hoặc ký tự điều khiển đều được chuẩn hóa về đường an toàn; không thấy chuyển tới website ngoài. Việc localhost khác 127.0.0.1 được ghi riêng ở D1-B02. |
| D1-09 | **Đạt — tích hợp** | Logout server trả 303; reload/Back trang riêng phải đăng nhập. PATCH hồ sơ sau logout trả 401; phát lại cookie đã chụp trước logout cũng trả 401. Không kết luận mọi JWT của mọi thiết bị đều đã bị vô hiệu từ thử nghiệm cookie này. |
| D1-10 | **Bị chặn — một phần đạt** | Recovery với email có/không tồn tại giả lập hiện cùng thông báo chung và cooldown. Đổi mật khẩu fixture khi có phiên thật thành công: mật khẩu cũ trả 400, mới trả 200 khi đăng nhập; nhập lại không khớp không gửi cập nhật. Đây là đổi mật khẩu khi đã xác thực, chưa phải khôi phục qua thư thật. |
| D1-11 | **Bị chặn — một phần đạt** | Không có phiên mở trang đặt lại mật khẩu thì chuyển về quên mật khẩu. Callback thiếu/sai code giữ đích nội bộ và có hướng dẫn lấy link mới; lỗi mạng recovery cho thử lại. Chưa có link email thật hết hạn/đã dùng. Người đã có phiên hợp lệ đổi mật khẩu là hành vi được phép, không coi riêng việc thiếu phiên recovery là lỗ hổng. |
| D1-12 | **Không đạt — P1** | Admin fixture khóa/mở khóa thành công; phiên cũ bị từ chối ở API 401 và `update_profile` RPC trực tiếp 400, trang riêng về đăng nhập. Nhưng khi đã đăng nhập, mở đăng nhập/đăng ký trên 127.0.0.1 đổi sang localhost và mất phạm vi cookie (D1-B02). Đây không phải bằng chứng vượt quyền khi bị khóa. |

## Lỗi cần xử lý và kiểm lại

### D1-B01 — P1: quên mật khẩu làm mất đường quay về sân trên domain

- Case: D1-06, biến thể điều hướng qua các trang Auth.
- Tái hiện không cần tài khoản: mở `/dang-nhap?next=` với đích nội bộ chứa sân/ngày/môn/hash; bấm “Đăng ký bằng email”, quay lại “Đăng nhập”, rồi “Quên mật khẩu?”.
- Kỳ vọng: trang quên mật khẩu và các liên kết quay lại giữ nguyên đích nội bộ hợp lệ.
- Thực tế lúc **14:42**: link có `href="/quen-mat-khau"`, URL cuối là `https://san-ngon.vercel.app/quen-mat-khau`, thiếu `next`. Đã đợi navigation trước khi kiểm; mất đích xảy ra trước các phản hồi Auth giả lập.
- Phạm vi kết luận: bản domain được mở lúc test, chưa xác minh commit. Bản chụp local đã có helper `authHref`; công việc khác sau đó commit thay đổi giữ đích trong **`d321539`**. Chưa kiểm deploy sau commit này, nên lỗi domain chưa được đóng.
- Kiểm lại: login → signup → login → recovery → login, callback recovery và khôi phục thực tế khi có email, với đích chứa query/hash và đích không an toàn.

### D1-B02 — P1: chuyển hướng local đổi hostname, người đã đăng nhập lại về đăng nhập

- Case: D1-12. Local bản chụp, khoảng **14:42**.
- Tái hiện: đăng nhập tại `http://127.0.0.1:45037`, rồi mở `/dang-nhap?next=%2Ftai-khoan` hoặc `/dang-ky?next=%2Ftai-khoan`.
- Kỳ vọng: chuyển tới tài khoản trên cùng địa chỉ trình duyệt và nhận đúng phiên.
- Thực tế cả hai cuối cùng tới `http://localhost:45037/dang-nhap?next=/tai-khoan`, sau khi đã chờ tới 10 giây. Cookie của 127.0.0.1 không thuộc localhost.
- Đối chiếu mã: middleware dựng URL redirect từ `request.url`; callback cũng đọc origin từ URL nội bộ của request. Helper `requestOrigin` lấy Host hiện đã dùng ở logout. Đây là hướng điều tra, chưa sửa hoặc chứng minh mọi route đều có lỗi tương tự.
- Phạm vi: lỗi hostname trong môi trường local chạy thử. Chưa có bằng chứng domain công khai bị lỗi tương tự hoặc có arbitrary open redirect.
- Kiểm lại: phiên thật trên cả localhost và 127.0.0.1; các redirect Auth/callback/logout giữ đúng host; kiểm lại `next` ngoài sau sửa.

### D1-U01 — P2: thông báo lỗi mạng đăng ký còn tiếng Anh

Lỗi mạng signup trên domain hiện `Failed to fetch`. Nút được mở lại và dữ liệu đủ để thử tiếp, nên không coi luồng bị khóa. Nên dịch thành hướng dẫn tiếng Việt nhất quán với recovery. Bằng chứng ở `mock-browser.json.observed_errors`.

## Phần chưa đủ điều kiện nghiệm thu

- Giữ [D1-C01 của D0](test-results-d0-2026-10-09.md): lần đọc cấu hình trước đó chưa có SMTP riêng, giới hạn 2 email/giờ, OTP 8 số/3.600 giây và mẫu thư chưa khớp cấu hình nghiệm thu. D1 không đổi cấu hình hoặc đọc lại để khẳng định trạng thái sau test; cũng không suy cấu hình Vercel từ biến local.
- OTP hợp lệ tự dựng không được GoTrue chấp nhận. Đây là hạn chế dựng fixture; **không ghi là lỗi xác minh OTP của sản phẩm**. Các phản hồi 403 với mã tự dựng không chứng minh hành vi hết hạn của một mã từng hợp lệ.
- Google thành công/từ chối consent và email recovery hết hạn/đã dùng cần tài khoản/hộp thư thử cùng provider cấu hình đúng. Mock chỉ hỗ trợ test xử lý lỗi.

## Dữ liệu thử, cleanup và bằng chứng

Mỗi lượt tích hợp tạo **4 tài khoản disposable** riêng: người chơi A/B, admin và tài khoản chưa xác thực, cùng identity/profile tương ứng. Tài khoản admin chỉ được cấp cho fixture. Khóa/mở khóa và đổi mật khẩu chỉ áp dụng fixture.

**Cả hai lượt đã dọn và kiểm tra còn 0 Auth users, 0 profiles thuộc fixture.** Lượt cuối kiểm tra 0 bookings của fixture trước cleanup; không bấm giữ chỗ sau đăng nhập. Không tạo cụm sân/sân con/ảnh Storage, không chuyển tiền, không gửi email hoặc thông báo Google consent. Thư mục tạm build được dọn và server thử đã tắt.

Bằng chứng sau đây lưu local, không commit ảnh/log/script tạm vào Git. Các liên kết `output` chỉ dùng được trên máy đang giữ bộ bằng chứng:

- [Kết quả tích hợp cuối và hash nguồn](../output/d1-2026-10-09/results.json)
- [UI domain với phản hồi giả lập](../output/d1-2026-10-09/mock-browser.json)
- [Xác minh lại recovery lỗi mạng](../output/d1-2026-10-09/mock-recovery-followup.json)
- [Ảnh phục hồi form sau đăng nhập](../output/d1-2026-10-09/booking-draft-restored.png)
- [Ảnh lỗi OTP mobile](../output/d1-2026-10-09/mock-otp-error-mobile.png)
- [Build](../output/d1-2026-10-09/build.log), [logic đầu vào](../output/d1-2026-10-09/request-inputs.log), [logic reset](../output/d1-2026-10-09/password-reset.log)

Lượt đầu có các giả định sai trong công cụ: coi localhost cùng cổng là URL ngoài, chỉ chấp nhận 403 khi tài khoản bị khóa, và đọc URL trước khi navigation xong. Lượt tích hợp cuối đã sửa cách kiểm và chạy lại. Mock recovery có locator `alert` trùng với route announcer của Next; lượt follow-up dùng alert bên trong `main` đã đạt. Các lỗi công cụ này không được cộng thành lỗi sản phẩm; file ban đầu giữ riêng để đối chiếu, không sửa JSON thô nhằm đổi kết quả.

## Tiếp theo

Tiếp tục D2 — tìm sân, lịch trống, giá, tạo/hủy và đặt đồng thời bằng dữ liệu thử rồi dọn. Phần Auth đã đủ để thử bằng tài khoản disposable có phiên thật; không cần chờ email để kiểm nghiệp vụ đặt sân. D1-B01/B02 và các phần email/Google vẫn mở cho đến khi có bằng chứng chạy lại phù hợp.
