# Giải đấu và kết nối cộng đồng

Yêu cầu: [tài liệu ngày 29/09/2026](https://docs.google.com/document/d/10FhNFapsJhfFWYYydJ3TvabxzZEqmAOfQGoMoB1nMuA/edit).

## Giải đấu

Xem [flow end-to-end, vai trò và đánh giá UI/UX](tournament-journey.md) cho toàn
bộ hành trình từ tạo giải đến hoàn tiền/quyết toán và cách kiểm tra lặp lại.

- `/giai-dau`: xem, lọc môn, phân trang, theo dõi các giải đã đề xuất và đăng ký.
- `/giai-dau/tao`: chủ sân phải chọn sân của mình để công khai ngay, không cần admin duyệt; người chơi mô tả địa điểm mong muốn để admin bố trí và duyệt. Công khai và khóa lịch là một giao dịch SQL, vẫn kiểm tra đúng môn, lịch trống và điều kiện nhận cọc.
- Tạo/sửa đề xuất có một ảnh bìa tùy chọn, xem trước và bỏ/đổi ảnh. JPG/PNG/WebP tối đa 5 MiB, bucket công khai riêng `tournament-photos`; SQL kiểm tra file của người tổ chức rồi lưu `tournaments.cover_path` cùng giao dịch gửi giải. Ảnh hiện ở danh sách và chi tiết. Không đổi ảnh của giải đã công khai. Storage không cho ghi đè hoặc xóa ảnh còn được giải sử dụng; ảnh cũ chỉ được dọn sau khi sửa giải thành công.
- `/admin/giai-dau`: admin mở đề xuất, chọn sân đúng môn, duyệt hoặc từ chối kèm lý do. Duyệt khóa lịch sân bằng `court_closures`; không thể duyệt trùng đơn đặt hoặc khung đã khóa. Người đề xuất nhận quyền quản lý giải, không được đổi role tài khoản.
- `/chu-san/giai-dau`: chủ sân thấy giải ở sân mình và giải mình đề xuất. Trang chi tiết dùng chung cho chủ sân, người tổ chức, admin và người tham gia; SQL quyết định quyền.
- Mỗi tài khoản đăng ký một suất, có họ tên, điện thoại, địa chỉ, tên đội và ghi chú. Thể lệ ghi rõ suất là một người hay một đội. Duyệt đăng ký giữ suất đến hạn cọc riêng; hết hạn chưa trả tiền sẽ trả suất. Số suất còn hiệu lực không vượt quy mô.
- Sau khi duyệt tham gia, hệ thống cấp QR nếu giải yêu cầu cọc. Cọc và lệ phí lấy từ giải đã công khai; không nhận số tiền do người tham gia gửi lên. Phần còn lại thu tại giải.
- Hủy giải trả lịch sân và ghi nhận cần hoàn các khoản đã nhận. Với giải mới, tự hủy suất trước ít nhất 24 giờ được hoàn cọc; muộn hơn không hoàn. Ban tổ chức hủy suất hoàn toàn bộ. Chủ sân thực hiện hoàn qua ngân hàng rồi đánh dấu; người tổ chức được admin giao quản lý không thể tự xác nhận chủ sân đã hoàn tiền.

## Cọc SePay

Mã `GIAI` + 12 ký tự hex, tách biệt mã `SAN` và `PHI`. `tournament_registrations` đóng băng lệ phí, cọc, kết nối, ngân hàng, số tài khoản và tên người nhận khi duyệt. Người nhận là chủ sân tổ chức, kể cả người đề xuất là người chơi. Dùng kết nối SePay sẵn có, giữ nguyên cờ nghiệm thu nhiều chủ sân và kiểm tra phí sử dụng website.

`confirm_tournament_payment` chỉ service role gọi được, qua webhook hiện tại. Phải đúng kết nối/tài khoản và đủ cọc trong một giao dịch trước hạn; không cộng dồn khoản thiếu. Tiền thiếu, thừa, trùng, chuyển sau hạn hoặc sau hủy đều có sổ giao dịch và số tiền cần hoàn. Hoàn một phần dư rồi hủy suất vẫn tính đúng phần cọc còn cần hoàn.

`sepay_transfer_claims` chống dùng lại cùng giao dịch cho ba luồng cọc sân, cọc giải và phí dịch vụ. Retry không ghi nhận tiền hai lần. Không thể ngắt SePay khi còn QR giải được duyệt và còn hạn thanh toán. Trang giải nghe realtime, đồng bộ khi quay lại tab, có mạng, tới hạn đăng ký/cọc hoặc giờ kết thúc.

Thông tin người đăng ký chỉ được đọc bởi chính họ, người quản lý, chủ sân liên quan và admin. Không công khai số điện thoại danh sách tham gia. Payload ngân hàng thô không cấp quyền đọc cho trình duyệt.

## Kết nối

`/ket-noi` cho xem hồ sơ, lọc môn/khu vực và phân trang. Mở hồ sơ để thấy các kênh liên hệ được người chơi chọn công khai, vị trí, trình độ, giới thiệu và giờ thường chơi. Ảnh dùng ảnh đại diện tài khoản.

`/ket-noi/ho-so` lưu thông tin công khai riêng với `profiles`. Mặc định ẩn; người dùng phải chọn đồng ý công khai. Bỏ chọn là ẩn ngay, tài khoản bị khóa cũng bị ẩn. Không có chat nội bộ, tự ghép đối hoặc bản đồ.

Có thể tải/đổi/xóa ảnh đại diện ngay ở `/ket-noi/ho-so` và `/tai-khoan`.
Ảnh được lưu ngay qua `set_profile_avatar`, dùng chung bucket `avatars` và
hiển thị cùng một ảnh trên tài khoản và hồ sơ kết nối. Đổi ảnh không tự công khai hồ sơ.

Kiểm tra tải ảnh thật với bản production local ở cổng 3101 bằng
`RUN_IMAGE_UPLOAD_E2E=1 node scripts/check-image-uploads-browser.mjs`.
Dùng `PLAYWRIGHT_MODULE`/`CHROMIUM_EXECUTABLE` nếu Playwright nằm ngoài repo.
Script dùng Chromium headless và phiên riêng, tạo rồi dọn tài khoản thử,
kiểm tra ảnh bìa/ảnh đại diện và bố cục desktop/mobile; ảnh chụp ở `output/image-uploads`.

## Đăng nhập, OTP và thống kê

Đăng nhập/xác thực thành công tải lại trang đích để header đọc phiên mới. Người đã đăng nhập được chuyển khỏi `/dang-nhap` và `/dang-ky`. Form phục hồi sau lỗi mạng, trim email, chấp nhận mã 6–8 chữ số theo email; server vẫn kiểm tra mã.

OTP cần SMTP Supabase riêng. Kiểm tra bằng `node scripts/configure-auth-email.mjs`; cấu hình `RESEND_API_KEY` và `EMAIL_FROM` thuộc tên miền đã xác minh rồi chạy `node scripts/configure-auth-email.mjs --apply`. Khóa Secret trên Vercel không được tải về bằng `vercel env pull`. Cấu hình SMTP thực tế và nghiệm thu nhận email vẫn cần thông tin gửi thư. Không coi việc có form OTP là đã sửa xong gửi thư.

Bộ lọc thống kê giữ tham số `venue` khi thêm `period`. `get_owner_period_stats` tính ngày Việt Nam trong SQL và gọi thống kê cũ; 7/30/90 ngày thực sự đổi khoảng truy vấn.

## Kiểm tra

```sh
npm run lint
npm run typecheck
npm run build
node scripts/check-doc-requirements.mjs
npx supabase db query --linked --file scripts/check-tournaments.sql
npx supabase db query --linked --file scripts/check-tournament-photos.sql
npx supabase db query --linked --file scripts/check-community.sql
node scripts/check-public-routes.mjs http://localhost:3100
node scripts/check-sepay-webhook.mjs http://localhost:3100
```

Các kiểm tra SQL dùng dữ liệu tạm rồi rollback. Kiểm tra luồng cọc qua webhook giả không thay thế nghiệm thu một giao dịch ngân hàng thật trước khi mở nhận tiền.

## Vận hành bổ sung ngày 29/09/2026

- Tách hạn nhận/duyệt đăng ký với hạn thanh toán cuối cùng. Thời gian cọc sau duyệt mặc định 24 giờ (người đề xuất chọn 1–72 giờ); SQL lấy mốc sớm hơn giữa thời gian này và hạn cuối của giải. Không dùng giờ từ trình duyệt để quyết định nhận tiền.
- Suất chưa trả cọc hết hạn không chiếm quy mô, kể cả cron chưa chạy. Cron `tournament-deadlines` mỗi phút dọn trạng thái, nhắc cọc khi còn tối đa một giờ và chuyển giải qua `completed` sau giờ kết thúc. Giải miễn cọc giữ suất sau khi duyệt.
- Người dùng đã hủy/hết hạn/bị từ chối có thể gửi lại nếu giải còn nhận người. Mỗi lần là một bản ghi và mã thanh toán riêng; lịch sử ngân hàng/hoàn tiền giữ nguyên. Tab Đã đăng ký chỉ hiện lần gần nhất của mỗi giải.
- Người đề xuất sửa và gửi lại giải `pending`/`rejected`, người chơi vẫn phải qua admin duyệt, chủ sân chọn sân của mình thì công khai ngay trên mã giải cũ. Không sửa lịch, giá hay chính sách của giải đã công khai.
- Chính sách đã chốt: giải mới, người chơi tự hủy ít nhất **24 giờ** trước lúc bắt đầu được hoàn toàn bộ cọc; muộn hơn không hoàn cọc. Nếu người quản lý tự hủy suất của chính mình, vẫn là hủy cá nhân. Ban tổ chức hủy suất người khác hoặc hủy cả giải thì hoàn 100%. Hủy cả giải hoàn cả cọc đã giữ do người chơi hủy muộn trước đó. Giải cũ giữ mốc 0 giờ đã công bố; mốc hoàn được đóng băng trên từng đăng ký.
- Thông báo trong website cho đề xuất mới, kết quả duyệt, đăng ký mới, duyệt suất, hết hạn, sắp hết hạn cọc, nhận cọc, hủy, khoản cần hoàn, xác nhận hoàn và quyết toán. Hộp thư cập nhật realtime, quay lại tab hoặc có mạng. Mở thông báo đưa đến đúng giải. Không bổ sung email người chơi.

### Quyết toán thủ công

Với giải do chủ sân tổ chức tại sân mình, hệ thống ghi tiền thuê và tiền thuê khi hủy bằng 0; chủ sân tự thu/hoàn lệ phí, không phát sinh quyết toán giữa hai bên.

Với đề xuất của người chơi, admin chỉ công khai giải sau khi ghi **tiền thuê sân đã thỏa thuận**, nội dung và xác nhận chủ sân/người tổ chức đã đồng ý. Đây là giá thỏa thuận của giải, không phải giá đơn đặt sân thường. Thỏa thuận cố định sau khi công khai; giải cũ chưa có thỏa thuận được admin bổ sung một lần. Người tham gia không được sửa bất kỳ số tiền nào.

Chủ sân nhận toàn bộ cọc và phần lệ phí còn lại. Phần còn lại dùng tiền mặt hoặc nội dung chuyển khoản riêng, không dùng lại mã GIAI của cọc (webhook sẽ coi đó là chuyển cọc trùng và ghi phải hoàn). Từ giờ bắt đầu, chủ sân ghi nhận đã thu phần còn lại (SQL tính bằng lệ phí trừ cọc), kèm chứng từ. Không ghi thu hai lần; không được ghi thu phần còn lại khi chưa đủ cọc. Người vắng mặt hoặc được miễn phần còn lại phải có ghi chú riêng để kết thúc đối soát. Nếu ban tổ chức hủy sau khi đã thu phần còn lại, phần này được ghi phải hoàn riêng với cọc.

SQL tính: **tiền ngân hàng − nghĩa vụ hoàn cọc + phần còn lại đã thu − nghĩa vụ hoàn phần còn lại − tiền thuê sân − các khoản quyết toán đã ghi nhận**. Admin chốt riêng tiền thuê khi người tổ chức/admin hủy cả giải (0 đến tiền thuê ban đầu); chủ sân hủy thì không tính tiền thuê. Khoản này do người tổ chức chịu, không khấu trừ vào tiền phải hoàn người tham gia. Số dương: chủ sân chuyển người tổ chức; số âm: người tổ chức bù chủ sân. Cùng một người tự tổ chức thì không phát sinh chuyển giữa hai bên.

Chỉ ghi quyết toán sau khi giải kết thúc/hủy, đã xử lý khoản thu và hoàn. Bên trả ghi mã giao dịch sau khi thực sự chuyển tiền; bên nhận kiểm tra tài khoản rồi xác nhận. SQL kiểm tra số dư hiện tại, chống dùng màn hình cũ để ghi sai tiền và chỉ cho một khoản chờ xác nhận. Admin được đối soát thay hai bên; mọi lần ghi có người thực hiện và thời điểm. Hạn đối soát hiển thị là 7 ngày sau giờ kết thúc; website không tự chuyển tiền hay cưỡng chế thu nợ.

### Quyền riêng tư hồ sơ

Mỗi kênh điện thoại/Zalo/Facebook có lựa chọn công khai riêng. RPC ẩn giá trị các kênh không được chọn ngay tại SQL, không chỉ ẩn nút trên giao diện. Chủ hồ sơ vẫn đọc được các giá trị để chỉnh sửa. Hồ sơ mới không tự chọn kênh nào; hồ sơ cũ giữ lựa chọn đã đồng ý trước đó. Khung giờ thường chơi là mô tả tối đa 300 ký tự, ví dụ “Tối thứ 3, 5 sau 19h”; không phải lịch đặt sân hay cam kết có mặt.

### Cập nhật giao diện trên production

Không dùng `app/(site)/loading.tsx` bọc toàn bộ website: Next.js 15 có lỗi transition treo khi refresh bên dưới loading boundary, dù RSC đã trả dữ liệu mới (upstream [#86151](https://github.com/vercel/next.js/issues/86151)). Giữ nội dung hiện tại trong lúc tải, biểu mẫu có trạng thái đang xử lý; realtime tiếp tục dùng `router.refresh()`. Kiểm tra luồng duyệt/nhận cọc và điều hướng bằng bản production, không chỉ `next dev`.

### Kết quả kiểm tra bản cập nhật

Đã chạy lint, typecheck, production build và hai kịch bản SQL rollback. Chromium headless với bốn phiên độc lập đã kiểm tra đề xuất/duyệt, hết hạn và đăng ký lại, SePay giả lập + retry + realtime, liên kết thông báo, quyền riêng tư liên hệ, thu phần còn lại và xác nhận quyết toán hai bên. Kiểm tra bố cục/bộ lọc/điều hướng tại 390, 768, 1024 và 1440 px. Hoàn cọc và quyết toán được kiểm tra bằng dữ liệu giả; vẫn cần nghiệm thu chuyển khoản ngân hàng thật.

### Kiểm tra lại giải đấu ngày 03/10/2026

- Chủ sân chọn sân thì form hiển thị địa chỉ đã lưu, không phải nhập lại địa điểm mà SQL sẽ thay thế. Đổi môn xóa sân đã chọn; môn chưa có sân có hướng dẫn rõ.
- Trang chi tiết báo lỗi nếu chưa đọc được quyền/quy mô, không mặc định số suất bằng 0 khi RPC hỏng. Khi tới giờ bắt đầu, trang tự tải dữ liệu mới để hiện thao tác thu phần lệ phí còn lại và bỏ thao tác hủy cá nhân đã hết hạn.
- Ảnh QR không tải được có hướng dẫn dùng thông tin chuyển khoản và nút thử lại. Không che số tài khoản, số tiền, mã chuyển khoản hay hạn cọc.
- `scripts/check-tournament-e2e.mjs --live` chạy bản production local với Supabase thật, bốn phiên Chromium headless tách biệt. Cần CLI đăng nhập/link, `npm run build`, Playwright (hoặc `PLAYWRIGHT_MODULE`) và trình duyệt (hoặc `CHROMIUM_EXECUTABLE`). Ảnh và kết quả lưu ở `../outputs/tournament-review`, đổi bằng `UX_SCREENSHOT_DIR`.
- Kịch bản tạo tài khoản/sân/kết nối **kiểm thử**, đi qua UI và API thật: chủ sân công khai → khóa sân → người chơi đăng ký → duyệt → webhook cọc giả lập/retry → realtime → hủy/ghi nhận hoàn → trả sân; người chơi đề xuất → admin chốt thỏa thuận/duyệt → thu phần còn lại → chủ sân ghi quyết toán → người tổ chức xác nhận.
- Chỉ dịch thời gian của giải kiểm thử bằng SQL để kiểm tra mốc bắt đầu/kết thúc. Không đổi cờ nghiệm thu nhiều chủ sân; script dừng nếu cờ chưa bật. Dữ liệu thử được xóa trong `finally`; nếu tiến trình bị dừng cưỡng bức, dùng `cleanup.sql` trong thư mục kết quả để dọn đúng các UUID đã tạo.
- Webhook đi vào localhost với ngân hàng/tài khoản giả. Ghi nhận thu, hoàn và quyết toán là mô phỏng, không chuyển tiền. Vẫn cần nghiệm thu QR với ngân hàng hợp lệ và giao dịch tiền thật trước khi coi thanh toán ngân hàng đã nghiệm thu.

### Bố cục theo vai trò cập nhật ngày 05/10/2026

- Người chơi thấy form đăng ký hoặc trạng thái/cọc ngay dưới tên giải. Tiến trình ba bước phân biệt đã gửi, đã duyệt và đã đóng cọc; số tiền, hạn chuyển và tài khoản chủ sân nằm cùng một khu vực. Lịch/địa điểm ở dưới và lệ phí ở cột bên cạnh trên desktop; có mốc hoàn và thao tác hủy đúng chính sách.
- Người quản lý có bốn mục với URL riêng: **Tổng quan**, **Người tham gia**, **Giao dịch & hoàn tiền**, **Quyết toán**. Số việc cần xử lý hiện trên đầu trang; danh sách lọc theo trạng thái, tìm tên/đội/điện thoại không cần gõ dấu. Duyệt có lời nhắn tùy chọn; từ chối có ô lý do riêng. Vị trí quản lý giữ qua tải lại, tìm kiếm/bộ lọc giữ khi realtime cập nhật.
- Trang tìm giải rút ngắn phần giới thiệu để danh sách xuất hiện sớm. Form tạo giải có điều hướng đến ba phần. Chủ sân tự tổ chức thấy tổng thu của giải, không bị yêu cầu quyết toán cho chính mình.
- Kịch bản E2E kiểm tra tìm kiếm/bộ lọc người tham gia, QR lỗi, thu/hoàn và cọc ở đầu trang; kiểm tra bổ sung tại `scripts/check-tournament-browser.mjs` và `scripts/check-tournament-journey.mjs`. Xem [luồng và kết quả](tournament-journey.md). Luật nghiệp vụ, quyền và luồng tiền vẫn do các RPC xử lý.
