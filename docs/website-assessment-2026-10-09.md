# Đánh giá mức độ hoàn thiện Sân Ngon — 09/10/2026

## Kết luận

Sân Ngon đã vượt mức một bản giao diện demo: có các luồng người chơi, chủ sân và admin; nghiệp vụ lịch/giá/cọc nằm trong SQL; có realtime, OAuth SePay, giải đấu, phí dịch vụ và nhiều tiện ích phục hồi lỗi. Điểm yếu hiện tại nằm ở khả năng vận hành có tiền thật, chất lượng dữ liệu công khai và khả năng đối soát khi có ngoại lệ.

Ưu tiên tiếp theo là làm cho một vòng đặt sân → nhận tiền → đến chơi/hủy → hoàn tiền chạy đáng tin cậy. Việc mở thêm nhiều tính năng sẽ làm tăng số luồng phải bảo trì trong bối cảnh một người code.

Không đưa ra phần trăm hoàn thiện hoặc điểm số thương mại: chưa có dữ liệu chuyển đổi, quan sát người dùng, tải thực tế và biên bản nghiệm thu ngân hàng đủ để tính những chỉ số đó.

## Phạm vi và bằng chứng

- Đọc `AGENTS.md`, route/component/lib, các bản định nghĩa SQL mới nhất và tài liệu nghiệm thu/vận hành.
- Chạy lint, typecheck và production build trên Node.js 24: đạt.
- Chạy kiểm tra route công khai: đạt các trang, đầu vào tìm kiếm, chuyển hướng xác thực và kiểm tra API có trong script.
- Chạy audit dependency production: 3 dependency có cảnh báo, gồm 2 mức high và 1 mức moderate. Đây là kết quả của npm audit tại thời điểm rà soát, không phải bằng chứng website đã bị khai thác.
- Kiểm tra cấu hình Auth Supabase theo chế độ chỉ đọc: chưa có SMTP tên miền riêng; giới hạn 2 email/giờ; độ dài/hạn OTP, tiêu đề và mẫu thư xác nhận chưa khớp cấu hình mà giao diện yêu cầu.
- Kiểm tra cấu hình local: thiếu `RESEND_API_KEY` và `EMAIL_FROM`. Không suy ra hai biến này trên Vercel cũng thiếu.
- Truy vấn chỉ đọc Supabase đang liên kết: 3 cụm sân active, 25 sân con active thuộc các cụm active, 3 khu vực; cả 3 cụm được hàm SQL cho phép nhận đơn. `multi_owner_enabled` hiện **true**.
- Đọc trực tiếp định nghĩa `create_booking` trên database: giống hướng xử lý trong migration cọc 100%; chưa kiểm tra giới hạn 3 khung trong SQL.
- Chromium headless riêng, context mới, không dùng Chrome/cookie cá nhân: 8 trang công khai × 2 kích thước 390/1440 px, gồm trang chủ, tìm sân, một chi tiết sân, giải đấu, kết nối, đăng nhập, đăng ký chủ sân và trợ giúp. 16 lượt tải trả 200, không tràn ngang, không có page exception; không thấy ảnh tải hỏng tại thời điểm chụp.
- Bộ kiểm tra UI đầy đủ với dữ liệu và phiên giả lập riêng: đạt. Bao gồm khám phá/điều hướng, motion/no-JS, đặt sân, checkout/realtime/mất mạng/QR, inbox/hồ sơ, lịch, biểu mẫu/ảnh/SePay chủ sân và các màn admin. Các nhóm có kiểm tra nhiều kích thước từ 320 đến 1440 px; không phải mỗi trang đều được kiểm tất cả kích thước. Đã xem ảnh tìm sân, trang chủ, chi tiết sân, tổng quan chủ sân và admin. Lượt chạy đầu thiếu đúng phiên bản Chromium; chạy lại bằng Chromium headless đã có trong môi trường và hoàn tất thành công.

Chưa chuyển khoản thật, gửi thư thật, OAuth bằng tài khoản thật, hoàn tiền thật, thử tải đồng thời hoặc nghiệm thu trên domain production trong lượt này. Các màn quản lý trong bộ UI dùng dữ liệu giả lập, không chứng minh quyền và dữ liệu của phiên thật. Không thay đổi database, cờ nhận đơn, người nhận tiền hay chính sách. Không sửa các thay đổi local có sẵn.

## Những phần đã có, cần giữ và hoàn thiện

| Nhóm | Đã có trong code | Nhận xét |
| --- | --- | --- |
| Người chơi | Tìm sân/lọc/sắp xếp/phân trang, chi tiết/ảnh, chọn môn và thời lượng, gợi ý sân, giữ chỗ, QR, đơn cá nhân, hủy | Luồng trọng tâm khá đầy đủ; cần kiểm thử ngoại lệ giao dịch và phục hồi khi mất phản hồi tạo đơn |
| Tài khoản | Google/email, OTP, quên/đặt lại mật khẩu, hồ sơ, avatar, khóa tài khoản | Giao diện có; hệ thống gửi thư đang là điểm chặn xác nhận |
| Chủ sân | Hồ sơ 3 bước, SePay OAuth, duyệt admin, cụm nháp, sân con, giá ngày/giờ, ảnh, lịch khóa/mở, thống kê, xác nhận tay, hoàn cọc | Thiếu công cụ tra lịch sử và dấu vết hoàn tiền đủ cho vận hành lâu dài |
| Quản trị | Duyệt chủ sân, tài khoản, giải, phí, góp ý | Phạm vi hợp lý; ưu tiên tác vụ đối soát tối thiểu, không mở rộng thành hệ quản trị tổng quát |
| Giải đấu | Đề xuất/tự tổ chức, duyệt, khóa sân, đăng ký/duyệt/cọc, deadline, hủy/hoàn, quyết toán | Nghiệp vụ đã khá sâu; cần nghiệm thu toàn vòng đời và các ngoại lệ tiền riêng với đặt sân |
| Kết nối | Hồ sơ tự nguyện công khai, từng kênh liên hệ bật/tắt, lọc người chơi | Cách bảo vệ riêng tư đúng hướng; cần quy trình tiếp nhận báo cáo nội dung/hồ sơ |
| Tiện ích | Sân yêu thích, chia sẻ, trợ giúp, góp ý, đặt lại, tải lịch `.ics`, inbox | Đã có, không đưa vào backlog như tính năng chưa triển khai |
| Chất lượng nền | GiST chống trùng, giá server, snapshot người nhận/giá, RLS/RPC, giới hạn đơn chờ, realtime/reconnect, lỗi/404, sitemap/robots, CI/UI | Là nền nên giữ; tiếp tục bổ sung kiểm tra nghiệp vụ quan trọng thay vì thay kiến trúc |

## Các phát hiện có ảnh hưởng trực tiếp

### 1. Đăng ký qua email chưa sẵn sàng cho người dùng mới — P0

Đã kiểm tra trực tiếp cấu hình Supabase, không chỉ dựa vào tài liệu ngày 25/09. SMTP riêng chưa có và OTP chưa khớp. Với hạn gửi 2 email/giờ, nhiều người đăng ký hoặc gửi lại mã có thể không hoàn tất được luồng. Google login không giải quyết được toàn bộ người dùng email hoặc khôi phục mật khẩu.

Cần cấu hình domain gửi thư, SMTP, OTP 6 số/10 phút, mẫu confirmation và recovery, Redirect URLs đúng domain. Kiểm tra nhận thư trên các hộp thư phổ biến, thư rác, gửi lại, mã/link hết hạn và đăng nhập bằng mật khẩu mới. Email báo chủ sân phải nghiệm thu riêng; không coi bài kiểm payload là đã gửi thành công.

Căn cứ: `scripts/configure-auth-email.mjs`, `scripts/check-env.mjs`, `docs/mvp-acceptance.md`.

### 2. Giới hạn 3 khung đang được bảo vệ ở giao diện, chưa được bảo vệ trong SQL — P0

**Cập nhật 09/10/2026: đã xử lý A02 và A13.** Migration giới hạn khung/đầu vào đã triển khai lên Supabase, kiểm tra RPC và hồi quy giữ chỗ đạt. A13 đã phân biệt lỗi tải với dữ liệu trống và bổ sung thử lại; kiểm tra giao diện/giả lập lỗi đạt. A07 đã vá ba thư viện runtime và audit runtime còn 0 cảnh báo; phần công cụ phát triển vẫn mở theo [biên bản thư viện](dependency-security-2026-10-09.md). Nội dung bên dưới ghi phát hiện trước khi sửa. Xem [tiến độ và kết quả kiểm tra](development-progress-2026-10-09.md).

`lib/venue-time-options.ts` dừng ở `MAX_SLOTS = 3`. API tạo đơn xác thực thời điểm nhưng không kiểm số khung. Bản `create_booking` cuối trong migrations và định nghĩa đang chạy trên database cộng tất cả khung trống nằm trong khoảng, không giới hạn số khung. Người dùng có thể gửi khoảng dài hơn qua API/RPC, miễn thỏa các điều kiện còn lại. Điều này làm yếu giới hạn chống giữ lịch hàng loạt dù đã có tối đa 2 đơn chờ mỗi người.

Cần chặn ngay trong SQL bằng số khung thực tế của sân, không mặc định 3 khung = 3 giờ vì sân có `slot_minutes` khác nhau. Đồng thời đưa kiểm tra định dạng số điện thoại và giới hạn tên/ghi chú vào SQL: route đang kiểm những dữ liệu này, RPC trực tiếp chỉ kiểm điện thoại không rỗng. Giữ Zod ở Next.js để trả lỗi dễ hiểu và giữ GiST để xử lý đặt đồng thời.

Điều kiện đạt: gọi API và RPC trực tiếp với 4 khung bị từ chối; 1–3 khung hợp lệ vẫn đúng giá; dữ liệu liên hệ sai/bị phóng dài bị từ chối; không phát sinh đơn/thanh toán khi bị từ chối. Chưa tạo đơn thử để tái hiện trong lượt đánh giá này; kết luận dựa trên định nghĩa SQL/API đã đọc.

Căn cứ: `supabase/migrations/20260926000000_full_booking_deposit.sql:10`, `app/api/bookings/route.ts`, `lib/venue-time-options.ts:14`.

### 3. Chất lượng nội dung công khai chưa đủ để khách tin tưởng trả trước 100% — P0

Trên bản production local đọc Supabase thật, một cụm có tên mang tính thử nghiệm “Sân bóng Đặt Ngay Cho Tao”; ảnh gallery/thẻ là ảnh chụp phần mềm database. Một cụm khác dùng trạng thái “Chưa có ảnh sân”. Đây không phải dữ liệu giả lập của bộ UI. Chưa xác minh liệu những dữ liệu này có đang phục vụ domain production hay chỉ nằm trong môi trường dự án liên kết.

Cần kiểm kê tên, địa chỉ, điện thoại, ảnh thật, mô tả, môn, giá và giờ hoạt động của từng cụm trước khi quảng bá/nhận người dùng. Xử lý dữ liệu thử trên đúng môi trường sau khi xác nhận; không tự xóa hoặc tắt các cụm trong lượt đánh giá. Xử lý các cụm active từ luồng cũ thiếu ảnh. Luồng mới vẫn là chủ sân được duyệt → cụm draft → đủ ảnh → active; không thêm bước admin duyệt từng cụm.

Ngưỡng khai trương nên dựa trên khả năng phục vụ một nhóm người cụ thể, chẳng hạn đủ lựa chọn thực ở 1–2 khu vực và môn ưu tiên, thay vì quảng bá phủ Hà Nội khi dữ liệu còn ít. 3 cụm/25 sân là số lượng dữ liệu, chưa phải bằng chứng 25 sân thực đã đồng bộ lịch vận hành.

### 4. Ngoại lệ chuyển khoản đơn sân chưa có quy trình đối soát hoàn chỉnh — P0

`confirm_payment` đã lưu `sepay_events` cho khoản có mã đơn tìm được, kể cả thiếu cọc. Tuy nhiên, nhánh thiếu tiền trả `UNDERPAID`; chuyển vào đơn đã xác nhận trả `ALREADY_CONFIRMED`; chuyển thừa có thể xác nhận đơn với giá gốc. Các khoản này chưa có một danh sách xử lý ngoại lệ đơn sân trong màn chủ sân/admin tương đương danh sách sự kiện phí và giải.

Webhook không có mã, mã không tồn tại hoặc mã mơ hồ trả 200 để bỏ qua, nhưng chưa có sổ ngoại lệ riêng của ứng dụng cho các khoản đó. Tiền vẫn có thể đã về ngân hàng. Không nên suy ra “webhook trả 200” hoặc “đơn chưa xác nhận” là không có tiền cần xử lý.

Ví dụ cần giải quyết: đơn 250.000đ nhận 200.000đ; nhận 300.000đ; nhận hai giao dịch khác nhau mỗi giao dịch 250.000đ; nhận sau hết hạn. Người vận hành phải thấy số thực nhận, số gắn vào đơn, số dư/thiếu và phần cần hoàn. Không dùng `deposit_amount` làm số hoàn cho mọi ngoại lệ. Với tiền vào đơn hủy, trạng thái cần hoàn hiện chưa biểu diễn được chính xác nhiều giao dịch hoặc số tiền thực nhận khác giá đơn.

Cần bổ sung nhật ký ngoại lệ tối thiểu, phân loại giao dịch và RPC đối soát có kiểm tra quyền. Không cộng dồn khoản thiếu hoặc thay đổi chính sách nhận tiền khi chưa chốt. Không mở bảng token/raw cho trình duyệt. Màn admin vẫn dùng phiên người dùng và RPC; service role chỉ dùng trong các đường SePay đã được cho phép.

Căn cứ: `app/api/webhooks/sepay/route.ts`, `supabase/migrations/20260925000002_sepay_oauth.sql:161`, `app/admin/phi-dich-vu/page.tsx`.

### 5. Chính sách hủy chưa chốt và đơn sân chưa đóng băng phiên bản chính sách — P0

Trang chính sách nói thay đổi chỉ áp dụng cho đơn sau ngày công bố. Nhưng `cancel_booking` đang đọc hằng 2 giờ trong hàm; bảng `bookings` chưa lưu mốc/phiên bản chính sách. Nếu sửa hằng SQL, các đơn cũ cũng sẽ được xét theo quy tắc mới.

Cần chốt mốc với chủ sân và đóng băng điều khoản hủy/hoàn ngay khi tạo đơn. SQL hủy dùng snapshot đó; UI hiển thị điều khoản của đúng đơn. Không tự thay mốc 2 giờ trong lúc đánh giá. Chính sách 24 giờ của giải đấu vẫn riêng và đã có cơ chế lưu trên đăng ký.

Cần chốt thêm mưa/sân không chơi được, người chịu trách nhiệm hoàn và thời hạn xử lý hoàn. Vì cọc bằng 100% tổng giá, truyền đạt rõ đây là thanh toán toàn bộ tiền sân; người vận hành cần cam kết xử lý tương xứng.

Căn cứ: `supabase/migrations/20260925000000_booking_holds.sql:289`, `app/(site)/chinh-sach-huy/page.tsx:70`, cấu trúc `bookings` trên database.

### 6. Đã bật nhiều chủ sân, cần bằng chứng nghiệm thu tương ứng — P0

Truy vấn chỉ đọc trả `multi_owner_enabled = true`, trong khi tài liệu yêu cầu chỉ bật sau nghiệm thu tiền thật. Lượt đánh giá chưa thấy biên bản chứng minh các tình huống của môi trường hiện tại đã đạt; không kết luận người vận hành bật sai, cũng không tự tắt cờ.

Cần đối chiếu ai nghiệm thu, ngày, domain, chủ sân/kết nối và kết quả: OAuth, webhook đúng người nhận, QR snapshot, chuyển khoản thật, retry, tiền muộn, ngắt/refresh kết nối và hoàn thủ công. Có bằng chứng rõ rồi mới tiếp tục onboarding thêm chủ sân. Cập nhật tài liệu để trạng thái vận hành hiện tại không mâu thuẫn với mô tả mặc định.

### 7. Dependency có cảnh báo mới cần xử lý có mục tiêu — P0/P1

Audit production báo `next` moderate, `sharp` high và `source-map-js` high. Các advisory lần lượt liên quan cache SSG/ISR, librsvg và xử lý indexed source map. Đường khai thác phụ thuộc kiểu deploy và đầu vào thực tế; website chạy nhiều route dynamic, bộ ảnh sân chỉ nhận JPEG/PNG/WebP, nên không được coi cả ba là lỗ hổng đã tái hiện.

Cần rà reachability, cập nhật bản vá tương thích/lockfile, chạy lại các luồng ảnh, build và UI. Audit nêu Next 15.5.27, sharp 0.35.5 và source-map-js 1.2.2 là các ngưỡng ra khỏi dải cảnh báo tại thời điểm này; phải kiểm tương thích dependency trước khi chọn cách nâng/override. Không nâng major hoặc chạy sửa dependency cưỡng bức chỉ để làm xanh báo cáo.

### 8. Thông báo sau nhận cọc có thể bị bỏ lỡ — P1

Đơn và inbox đã được ghi trong SQL trước khi gửi Telegram/email, đây là thiết kế đúng. Nhưng gửi ngoài hệ thống được thực hiện ngay trong request webhook và chỉ khi kết quả `CONFIRMED`. Nếu tiến trình dừng sau khi SQL commit nhưng trước khi gửi, webhook retry thường trả `ALREADY_PROCESSED`, không đi lại nhánh gửi. Nếu gửi hỏng cũng chưa thấy cơ chế retry bền vững. Telegram chưa có timeout giống email 10 giây.

Cần lưu nhiệm vụ gửi trong cùng transaction xác nhận, có trạng thái/khóa duy nhất theo đơn-kênh, timeout, thử lại có giới hạn và hiển thị gửi hỏng. Có thể dùng bảng SQL nhỏ và cơ chế xử lý phù hợp giới hạn service role hiện tại; chưa cần thêm một hệ hàng đợi lớn. Với lỗi mạng sau khi bên gửi đã nhận, cần chính sách hạn chế gửi lặp, không hứa đảm bảo exactly-once ngoài hệ thống.

Căn cứ: `app/api/webhooks/sepay/route.ts`, `lib/notify.ts:13`.

### 9. Mất phản hồi tạo đơn chưa được phục hồi như một tác vụ đã có mã — P1

Form giữ thông tin, chống nhấn lặp khi đang gửi và cho thử lại khi mất mạng. Tuy nhiên request chưa có khóa retry. Nếu SQL tạo đơn thành công mà phản hồi thất lạc, người dùng thấy lỗi mạng; gửi lại cùng giờ có thể nhận `SLOT_TAKEN` dù chính đơn của họ đang giữ sân.

Cần UUID cho mỗi ý định đặt, ràng buộc cùng người/cùng nội dung trong SQL, gửi lại trả mã đơn cũ. Hoặc bổ sung phục hồi đơn đang chờ tương ứng bằng RPC riêng tư. Chỉ chuyển checkout khi đã biết mã đơn; retry không tạo thêm đơn, không thay giá hoặc người nhận của đơn cũ.

Căn cứ: `components/booking-form.tsx:61`, `app/api/bookings/route.ts`, chữ ký SQL `create_booking`.

### 10. Chủ sân chưa có cách tra lịch sử thuận tiện — P1

`/chu-san/don` mặc định lấy từ hôm nay đến 30 ngày tới; chọn được một ngày cụ thể và trạng thái nhưng chưa tìm theo mã/điện thoại, chưa chọn khoảng ngày hoặc phân trang. Đơn người chơi cũng đọc toàn bộ rồi lọc ở client. Khi tăng dữ liệu, giới hạn số dòng Supabase có thể khiến lịch sử không đầy đủ mà giao diện không giải thích.

Cần ưu tiên tra đúng một đơn theo mã, tên/điện thoại cho chủ sân; khoảng ngày, lịch sử quá khứ, lọc cần hoàn và phân trang ở server. Giữ bộ lọc trong URL. Xuất CSV chỉ thêm nếu người vận hành cần đối soát ngoài website; export phải đúng phạm vi chủ sân và tránh dữ liệu cá nhân dư thừa.

Căn cứ: `app/(owner)/chu-san/don/page.tsx:25`, `app/(site)/don-cua-toi/page.tsx:15`.

### 11. Hoàn cọc đơn sân chỉ có trạng thái, chưa đủ chứng từ — P1

`mark_refund_done` đổi `refund_status` sang `done`. Trên database, các cột liên quan hoàn/chính sách của `bookings` hiện chỉ có `refund_status`. Chưa lưu số hoàn thực, thời gian/người thực hiện, mã/chứng từ, lý do, lịch sử thay đổi và cách đối chiếu với nhiều khoản chuyển.

Cần sổ hoàn theo giao dịch, có số tiền, thời điểm, người thao tác và mã tham chiếu; dữ liệu chứng từ riêng tư. SQL kiểm số còn phải hoàn và chống hai lượt ghi đồng thời. Phải cho người chơi thấy tiến độ; không đánh dấu xong chỉ vì gửi yêu cầu hoặc nhấn nút. Hoàn vẫn bằng chuyển khoản thủ công.

### 12. Một số lỗi truy vấn còn có thể biến thành danh sách trống — P1

Trang tổng quan chủ sân bỏ qua `error` khi tải lịch 7 ngày và danh sách cần hoàn. Trang admin có một số truy vấn dùng `data ?? []`; trang chủ cũng bỏ qua lỗi số liệu/lịch nhanh. Khi query hỏng, người vận hành có thể hiểu “không có khoản cần hoàn” hoặc “không có đơn”. Các trang khác đã phân biệt lỗi và trống nên cần hoàn thiện đồng nhất.

Cần xử lý lỗi độc lập từng vùng quan trọng, giữ dữ liệu lần thành công trước khi phù hợp, ghi thời điểm cập nhật, có retry. Không đưa trạng thái thành công hoặc số 0 cho dữ liệu chưa tải được.

Căn cứ: `app/(owner)/chu-san/page.tsx:50`, `app/admin/page.tsx`, `app/(site)/page.tsx:41`.

## Đánh giá giao diện và chuyển đổi

Nhận diện xanh pitch, typography tiếng Việt và bố cục phẳng tạo được nét riêng. Desktop tìm sân có sidebar lọc và thẻ chứa giá/địa chỉ/số khung trống; chi tiết sân có chọn giờ gộp theo cụm và nút đổi sân. Đây là những phần phù hợp bài toán thực.

Các cải tiến còn đáng làm:

1. **Đưa tìm sân lên vùng đầu trang chủ.** Carousel cao khoảng 430–440 px đứng trước tiêu đề/form chính. Đo ở 390 px, h1 chính bắt đầu y≈620; desktop y≈585. Nên đặt form/ngày/môn gần lời hứa chính, rút carousel hoặc đưa hình xuống sau hành động. Chưa có số liệu chứng minh việc này tăng chuyển đổi; cần quan sát và đo trước/sau.
2. **Giảm quãng cuộn trước lịch ở chi tiết trên điện thoại.** Đã có nút “Chọn giờ đặt sân”; giữ và thử với người dùng thật. Cân nhắc tóm tắt ngắn hoặc thanh chọn giờ khi cuộn nếu họ khó tìm lịch, không tự thêm CTA cố định che nội dung.
3. **Diễn giải số khung trống.** “120 khung trống” là tổng trên các sân con, không phải 120 giờ bắt đầu có thể chọn cho một buổi chơi. Nên phân biệt số sân, số giờ bắt đầu và thời lượng đang xét; tránh khiến khách nghĩ có lựa chọn liền mạch chưa được kiểm tra.
4. **Hiển thị giờ đã qua khác giờ hết sân.** Ở mẫu chi tiết, các giờ buổi sáng đã qua đều mang nhãn “Không còn sân”. Tách lý do hoặc thu gọn giờ đã qua để người dùng không hiểu nhầm tình trạng kín sân.
5. **Hoàn thiện thao tác QR trên cùng điện thoại.** Checkout đã có sao chép thông tin, hướng dẫn lưu ảnh và retry QR. Nên có hành động tải/chia sẻ ảnh rõ, kèm fallback nếu nguồn QR chặn tải; thử trên iOS Safari/Android Chrome và app ngân hàng thực tế. Deep link ngân hàng chỉ thêm khi có hỗ trợ đã xác minh.
6. **Thông tin sân có giá trị quyết định.** Hiện đã có amenities; cần dữ liệu thật về bãi xe, ánh sáng, mặt sân, trong nhà, thuê dụng cụ, lối vào. Ưu tiên chất lượng thông tin, không thêm một form dài cho mọi tiện ích có thể nghĩ ra.
7. **Khả năng tiếp cận.** Đã có focus, skip link, reduced motion, xử lý no-JS và nhiều kiểm tra bàn phím. Trang chủ chưa có landmark `main`. Video nền lặp hơn 5 giây chưa có điều khiển tạm dừng; carousel dừng khi hover/focus/chọn tay nhưng chưa có nút dừng rõ. Rà WCAG 2.2.2, thêm điều khiển thích hợp hoặc dùng poster tĩnh; kiểm screen reader, tương phản và zoom 200% trước khi tuyên bố đạt chuẩn.
8. **Thống nhất design system và tài liệu.** Repo hiện dùng `motion/mini` và media minh họa đã ghi nguồn trong `docs/media-sources.md`, khác một số chỉ dẫn cũ trong AGENTS. Cần xác nhận quyết định cuối và cập nhật tài liệu; không tự gỡ các thay đổi đã được người dùng yêu cầu ở những task trước.

## Backlog phát triển và điều kiện hoàn thành

P0 = chặn mở rộng nhận người dùng/tiền thật, hoặc phải có quyết định xử lý rõ trước vận hành. P1 = cần cho vận hành ổn định ngay sau khi đóng P0. P2 = phát triển sau khi có bằng chứng sử dụng. Một số mục là cấu hình/nghiệm thu/quy trình, không phải viết thêm code.

| ID | Mức | Việc | Kết quả cần có để đánh dấu xong |
| --- | --- | --- | --- |
| A01 | P0 | SMTP, OTP, recovery và email chủ sân | Nhận thư thật trên domain; gửi lại/hết hạn/khôi phục chạy đúng; cấu hình khớp UI |
| A02 | P0 | Giới hạn khung và đầu vào ở SQL | 4 khung và dữ liệu liên hệ sai bị chặn qua API lẫn RPC; 1–3 khung vẫn đặt đúng |
| A03 | P0 | Sổ ngoại lệ tiền đơn sân | Nhìn thấy thiếu/thừa/trùng/muộn/không mã; xác định số thực nhận và số cần xử lý; RPC đúng quyền |
| A04 | P0 | Chốt và snapshot chính sách hủy | Đơn cũ giữ điều khoản cũ; UI/SQL khớp; có người chịu trách nhiệm và thời hạn hoàn |
| A05 | P0 | Nghiệm thu SePay và trạng thái nhiều chủ sân | Biên bản domain/kết nối/QR/chuyển thật/retry/muộn/hoàn; đối chiếu cờ hiện true |
| A06 | P0 | Kiểm kê dữ liệu công khai | Tên/ảnh/địa chỉ/giá/lịch thật; xử lý dữ liệu thử ở đúng môi trường; thử được từng sân có nhận đơn |
| A07 | P0/P1 | Vá dependency theo reachability | Có kết luận advisory và bản vá tương thích; build/ảnh/UI đạt; ghi ngoại lệ còn lại nếu có |
| A08 | P0 vận hành | Backup và phục hồi | Kiểm tra backup DB + Storage + khóa AES; phục hồi thử ở môi trường riêng; biết người xử lý và thời gian chấp nhận mất dữ liệu |
| A09 | P1 | Khóa retry/phục hồi tạo đơn | Server tạo xong nhưng mất phản hồi vẫn tìm lại đúng mã; retry không thêm đơn |
| A10 | P1 | Hoàn tiền có chứng từ và lịch sử | Số thực hoàn/người/thời gian/tham chiếu; chống ghi lặp; khách thấy đúng tiến độ |
| A11 | P1 | Gửi thông báo bền vững, timeout và retry | Nhiệm vụ gửi không mất sau commit; lỗi ngoài hệ thống không cản xác nhận tiền; thấy lỗi và có thử lại |
| A12 | P1 | Tra lịch sử/phân trang đơn | Tìm mã/điện thoại, khoảng ngày, đơn quá khứ/cần hoàn; thử dữ liệu vượt một trang/giới hạn đọc |
| A13 | P1 | Phân biệt lỗi query với danh sách trống | Giả lập lỗi tải đơn/hoàn/statistics không hiển thị nhầm số 0 hoặc danh sách sạch |
| A14 | P1 | Giám sát và nhật ký thao tác quan trọng | Có cảnh báo lỗi webhook/cron/kết nối; trace theo mã, che dữ liệu nhạy cảm; ghi ai xác nhận tay/hủy/hoàn/duyệt |
| A15 | P1 | Snapshot thông tin buổi chơi | Tên sân/địa chỉ/môn tại thời điểm đặt vẫn đọc đúng sau khi sửa cụm/sân; giá/người nhận tiếp tục giữ nguyên |
| A16 | P1 | Lý do từ chối hồ sơ chủ sân | Admin ghi lý do, chủ sân nhìn thấy phần cần bổ sung, gửi lại giữ dữ liệu phù hợp; inbox/email nhất quán |
| A17 | P1 | Quyền riêng tư và điều khoản website | Trang giải thích dữ liệu liên hệ/giấy tờ, mục đích, công khai, thời gian giữ, yêu cầu xóa/hỗ trợ, trách nhiệm các bên; được người vận hành rà soát |
| A18 | P1 | Tiếp nhận báo cáo hồ sơ/nội dung công khai | Dùng luồng góp ý hiện có với liên kết đối tượng; admin có cách ẩn nội dung vi phạm và dấu vết xử lý; chưa cần chat |
| A19 | P1 | Trang chủ ưu tiên tìm sân và nội dung thật | Form/môn/ngày dễ tìm ở viewport đầu; dữ liệu/ảnh đáng tin; thử với 3–5 người và đo tác vụ |
| A20 | P1 | Lịch dễ đọc và thanh toán trên điện thoại | Phân biệt giờ đã qua/hết sân, hiểu đúng số khung, thao tác QR một máy; thử Safari/Chrome và ngân hàng thật |
| A21 | P1 | Bàn phím, screen reader, chuyển động | Landmark main, focus/dialog, thông báo trạng thái, tương phản/zoom; dừng video/slide được; nội dung vẫn có khi JS hỏng |
| A22 | P1 | Nghiệm thu giải đấu toàn vòng | Chủ sân tự tổ chức/người chơi đề xuất; công khai/khóa sân; quá số suất; deadline/cọc; hủy/hoàn/quyết toán đúng quyền |
| A23 | P1 | Tự động hóa kiểm tra SQL lõi trong môi trường thử | Bài GiST đồng thời, RPC trực tiếp, hạn giữ, quyền, retry, ngoại lệ tiền và chính sách; rollback/cleanup; không dùng production làm DB CI |
| A24 | P1 | Đo hiệu năng thật | Đo p75 LCP/INP/CLS trên domain; truy vấn chậm/latency/realtime; tối ưu theo nút thắt và không cache nhầm lịch/phiên riêng tư |
| A25 | P1 | Đo hành trình tìm–đặt–trả tiền | Theo dõi tìm kiếm không kết quả, xem sân/chọn giờ/tạo đơn/xác nhận SQL; không gửi PII, giấy tờ, mã ngân hàng/token vào analytics |
| A26 | P1 | Cập nhật tài liệu và xác nhận bản bàn giao | Trạng thái OAuth/nhiều chủ sân/media/motion/email khớp thực tế; từng thay đổi local được kiểm tra và bàn giao riêng |
| A27 | P2 | Báo cáo/CSV vận hành | Làm khi chủ sân cần; tổng tiền sân, thực thu, hoàn và ngoại lệ tách rõ; phạm vi và ngày do SQL quyết định |
| A28 | P2 | Lịch cố định hằng tuần | Chỉ làm sau khi chốt cọc/hủy từng buổi, xung đột và gia hạn; cần yêu cầu từ nhóm/người vận hành thật |
| A29 | P2 | Quản lý đặt ngoài website thuận tiện hơn | Trước mắt dùng khóa lịch hiện có; chỉ thêm ghi khách/đơn offline nếu chủ sân thường xuyên cần và quy tắc tiền đã rõ |
| A30 | P2 | SEO địa phương và chia sẻ nâng cao | Metadata riêng trang tìm sân, Event/SportsActivityLocation khi dữ liệu đúng; sitemap giải công khai; Search Console/canonical/filter không tạo trang rác |

Không thấy cấu hình backup/giám sát/analytics/quy trình riêng tư đầy đủ trong repo. Điều này không chứng minh nhà cung cấp hoặc người vận hành chưa có; A08/A14/A17/A24/A25 cần kiểm kê phần đang có trước khi triển khai thêm.

### Làm rõ bảng giá trước khi mở rộng

SQL hiện chọn price rule theo thời điểm bắt đầu mỗi khung, ưu tiên cao trước và giá cao hơn nếu cùng priority. `save_price_rule` cho chọn phút bất kỳ. Ví dụ khung 16:00–17:00 và rule bắt đầu 16:30 cần xác nhận chủ sân hiểu giá tính theo đầu khung hay muốn chia giá theo thời gian thực. Nếu chỉ hỗ trợ giá theo đầu khung, giải thích và giới hạn mốc rule phù hợp slot; nếu hỗ trợ chia giá, toàn bộ phép tính phải ở SQL. Không coi đây là lỗi tính tiền đã tái hiện khi chưa chốt quy tắc mong muốn.

## Lộ trình đề xuất cho một người phát triển

### Đợt 1: đủ điều kiện chạy thử có tiền

Xử lý A01–A07; kiểm kê backup A08 và chứng từ hoàn A10 tối thiểu. Công việc email, ảnh thật, chính sách và chuyển khoản nghiệm thu cần chủ sân/người vận hành phối hợp; không thể hoàn tất chỉ bằng code. Ưu tiên sửa giới hạn RPC trước các thay đổi hình thức. Chạy thử giới hạn với các chủ sân đã nghiệm thu, đối chiếu cờ nhận đơn hiện tại.

### Đợt 2: giảm lỗi và thời gian xử lý hàng ngày

A09–A16, A19–A23: phục hồi đơn, đối soát/hoàn, thông báo, tra lịch sử, lỗi tải, dấu vết thao tác và cải thiện UI theo quan sát. Gắn mỗi hạng mục với một tác vụ thật, tránh làm một dashboard lớn chỉ vì có thể.

### Đợt 3: đo hiệu quả và phát triển có căn cứ

Hoàn thiện A17–A18/A24–A26 rồi chọn P2 theo nhu cầu. Onboard có chọn lọc sân thật trong khu vực mục tiêu. Không cam kết thời gian cứng trước khi chốt quy tắc tiền và kiểm kê cấu hình ngoài repo; công việc đối soát/chính sách/migrations cần thời gian kiểm thử riêng.

## Chỉ số để biết website đang hoàn thiện hơn

| Chỉ số | Ý nghĩa | Cách đo |
| --- | --- | --- |
| Tỷ lệ hoàn thành đăng ký/khôi phục | Người mới có vào được hệ thống không | Theo bước, lý do thất bại; không lưu OTP/mật khẩu |
| Tìm kiếm có lựa chọn thực | Nguồn cung đủ cho khu vực/môn/ngày không | Tỷ lệ tìm không kết quả và thiếu giờ phù hợp |
| Hoàn thành tìm sân → đặt → cọc | Luồng có bán được dịch vụ không | Xác nhận thanh toán từ SQL, không chỉ lượt xem QR |
| Thời gian tự tìm/xử lý đơn của chủ sân | Công cụ có giảm điện thoại/công việc không | Quan sát 3–5 chủ sân, đo nhiệm vụ tìm mã/khóa lịch/hoàn |
| Ngoại lệ tiền chưa xử lý và tuổi khoản | Rủi ro đối soát/niềm tin khách | Theo giao dịch thực, chủ sân, số tiền và thời gian tồn |
| Trùng lịch thành công | Ràng buộc quan trọng nhất | Mục tiêu 0; thử cạnh tranh có kiểm soát và theo dõi sự cố |
| Thời gian webhook → trạng thái hiển thị | Độ tin cậy xác nhận cọc | Timestamp SQL và cập nhật giao diện; phân biệt mạng/ngân hàng |
| Thời gian hoàn tiền thực | Cam kết sau bán hàng | Từ lúc đủ điều kiện đến chứng từ đã chuyển/đối soát |
| Quay lại đặt và chủ sân tiếp tục dùng | Giá trị sản phẩm có bền không | Theo tuần/tháng, không suy ra từ số tài khoản đăng ký |
| Core Web Vitals | Tốc độ và phản hồi trên máy người dùng | Mục tiêu tham khảo p75 LCP ≤2,5s, INP ≤200ms, CLS ≤0,1; chưa được đo trong lượt này |

## Những thứ chưa nên đưa vào kế hoạch hiện tại

App native, bản đồ toàn hệ thống, đánh giá sao, chat/ghép đối, ví, hoàn tự động, nhiều sân trong một đơn, hệ thống coupon/phân tích AI và một bộ quản trị lớn. Những việc này không giải quyết các điểm chặn đã xác nhận, còn tăng nghiệp vụ/chi phí bảo trì. Có thể xét lại phạm vi sau khi có dữ liệu sử dụng và yêu cầu kinh doanh cụ thể.

Không chuyển nghiệp vụ sang TypeScript, không bỏ GiST, không nhận số tiền từ client, không đổi múi giờ bằng JavaScript, không dùng service role cho admin, không mở quyền bảng hồ sơ/giấy tờ để làm giao diện thuận tiện hơn.

## Tiêu chí chốt một bản có thể vận hành

Đã có biên bản email/ngân hàng và dữ liệu sân thật; không còn lỗ hổng giới hạn RPC đã nêu; có cách thấy/xử lý từng ngoại lệ tiền; chính sách đã chốt và giữ cho đơn cũ; hoàn tiền có người/chứng từ/hạn xử lý; lỗi tải không giả thành danh sách trống; có backup/khôi phục và người nhận cảnh báo; chủ sân và người chơi hoàn thành tác vụ qua quan sát thực. Mỗi phần thay đổi phải kiểm tra đúng phạm vi, commit/push riêng; file local có sẵn không tự động được xem là đã bàn giao.
