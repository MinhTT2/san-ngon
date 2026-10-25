# Phát triển tuần tự từ 21/10/2026

Theo yêu cầu làm lần lượt toàn bộ danh sách. Mỗi đợt kiểm tra và bàn giao riêng;
phần cần người vận hành/tài khoản nhà cung cấp được ghi riêng, không đánh dấu
hoàn thành bằng bài giả lập. Các tính năng mở rộng vẫn cần nhu cầu và quy tắc tiền.

| Thứ tự | Hạng mục | Trạng thái |
| --- | --- | --- |
| 1 | Hoàn cọc sân có tham chiếu, số thực hoàn và lịch sử | Đã triển khai SQL, kiểm tra và bàn giao code; chuyển hoàn thật còn nghiệm thu |
| 2 | Hàng đợi email/Telegram, timeout và retry | Đã triển khai production; cron mỗi phút và worker HTTP 200 đã kiểm tra |
| 3 | Nhật ký thao tác quan trọng | Đã triển khai production và kiểm tra |
| 4 | Giám sát và cảnh báo vận hành | Đã triển khai production; cron/worker và heartbeat thật đã kiểm tra |
| 5 | Báo cáo thực nhận/thực hoàn/nghĩa vụ và CSV | Đã triển khai production và kiểm tra |
| 6 | Đo phễu tìm sân–đặt–trả tiền | SQL và giao diện nhóm đơn tạo→cọc kiểm tra đạt; tìm/mở/chọn giờ đã có GA4, cần quyền đọc thật |
| 7 | Báo cáo và xử lý nội dung công khai | Đã triển khai production; SQL, build và kiểm tra đạt |
| 8 | Yêu cầu dữ liệu cá nhân và thời hạn lưu | Đã triển khai production và kiểm tra; 90/180 ngày là mốc rà soát, không tự xóa |
| 9 | Database thử cho SQL/CI | Đạt trên GitHub Actions: 83 migrations, 19 SQL rollback và hai kết nối tranh lịch |
| 10 | Hiệu năng thực và khả năng tiếp cận | Đã triển khai/đo lại production; dung lượng tải trang chủ giảm 15%, axe đạt; LCP mobile còn 3,92–4,31 s |
| 11 | SEO sân/giải và kiểm soát URL bộ lọc | Đã triển khai production; metadata/schema, URL lọc và phân trang hết dữ liệu đã kiểm tra đạt |

## Đợt 1 — sổ hoàn cọc sân

- `booking_refunds` giữ số thực chuyển, mã tham chiếu, giờ chuyển theo Việt Nam,
  người ghi và thời điểm ghi. Bảng riêng tư, chỉ đọc/ghi qua RPC có kiểm tra quyền.
  Không có thao tác chuyển tiền tự động, sửa hoặc xóa khoản đã ghi.
- Chủ nhận tiền trên snapshot của đơn ghi từng phần qua `record_booking_refund`.
  SQL khóa đơn trước kiểm tra số còn phải hoàn; UUID thử lại và tham chiếu duy nhất
  theo người nhận chặn ghi lặp. Retry sau hoàn tất trả đúng lịch sử, không báo lần hai.
- Tiền nhận dựa trên các sự kiện SePay đã đối chiếu của đơn và số cọc xác nhận tay;
  xác nhận tay không cộng thành một giao dịch ngân hàng nữa. Thanh toán mô phỏng
  không được dùng làm căn cứ chuyển hoàn. Không suy ra số thực nhận từ giá sân.
- Lưu phần cọc giữ lại khi hủy không được hoàn/không đến; khoản chuyển thêm sau đó
  không khiến cọc giữ lại thành khoản được hoàn. Đơn chờ đã chuyển thiếu khi hủy
  được đưa vào danh sách cần hoàn. Ngoại lệ nhiều khoản/xác nhận tay vẫn phải
  đối soát sao kê; sổ này chỉ ghi số đã có căn cứ, không tự phân bổ tiền không mã.
- Đơn đã đánh dấu hoàn trước migration giữ trạng thái cũ, không dựng số tiền hay
  chứng từ lịch sử. Chặn ghi thêm trên nhóm này, yêu cầu đối soát lịch sử riêng.
- Bỏ đường ghi `refund_status` trực tiếp của trình duyệt và vô hiệu hóa RPC
  `mark_refund_done(text)` cũ. SQL vẫn cập nhật trạng thái khi đủ số phải hoàn.
- Chủ sân mở sổ từ tổng quan, đơn và hoàn cọc; người chơi xem lịch sử tại Đơn của tôi.
  Form giữ cùng nội dung/UUID khi mất phản hồi; thông báo rõ không chuyển tiền lần nữa.

Kiểm tra đạt: API validation/auth/lỗi SQL; migration ứng viên và sau triển khai trong
transaction rollback (tiền thiếu/thừa, từng phần, UUID/tham chiếu trùng, vượt số còn lại,
quyền người chơi/chủ sân khác/bị khóa, bất biến, đơn cũ, cọc giữ lại và giờ Việt Nam).
Hồi quy SQL giữ chỗ/chính sách hủy đạt. Build production cô lập với lint/typecheck;
Chromium headless/context riêng cho sổ hoàn 390/1440 và hồi quy đặt/hủy/xác nhận tay,
lịch sử người chơi/hoàn cọc 320–1440 đạt. Đã xem ảnh mobile của dialog.

Migration `20261021000000_booking_refund_receipts.sql` áp dụng qua thư mục migrations
cô lập; dry-run chỉ liệt kê migration mới. Không gộp thay đổi local ở đăng nhập,
lịch/hiển thị sân, webhook hoặc các phần types không thuộc đợt này.

## Phụ thuộc ngoài code

- SMTP/domain gửi và nhận OTP/recovery/email thật.
- QR, OAuth, chuyển khoản, webhook và hoàn cọc thật; đối chiếu cờ nhận đơn/nhiều chủ sân.
- Quyền GA4 Data API: Property ID và Viewer cho tài khoản dịch vụ.
- Backup DB/Storage/khóa AES và thử phục hồi trên môi trường riêng.
- Dữ liệu sân thật, nghiệm thu với chủ sân/người chơi, Safari/ngân hàng và giải toàn vòng.

## Mở rộng có điều kiện

Lịch cố định hằng tuần, đơn ngoài website và nhắc lịch/hạn phí được xem xét sau
khi có nhu cầu thật, quy tắc hủy/cọc/xung đột và lựa chọn kênh nhận. Chưa mở rộng
sang app native, ví, hoàn tự động, chat hoặc đặt nhiều sân trong một đơn.

## Đợt 3 — nhật ký thao tác

SQL ghi nối tiếp khi xác nhận/hủy đơn, ghi hoàn cọc, duyệt hồ sơ, đổi phí,
trạng thái cụm/kết nối và admin yêu cầu gửi lại thông báo. Trình duyệt không
đọc trực tiếp hoặc sửa/xóa. RPC admin trả mã, tác nhân và trường đã cho phép;
không ghi số điện thoại, chứng từ ngân hàng, khóa hoặc payload nhà cung cấp.
Không dựng nhật ký cũ. Trang `/admin/nhat-ky` tìm mã/ID và phân trang.

Kiểm tra SQL ứng viên/sau migration bằng rollback: quyền, bất biến, trường riêng tư,
retry không ghi lặp, các nhánh cập nhật và phân trang. Build production cô lập,
Chromium 390/1440, giới hạn admin và hồi quy origin/worker đạt.

## Đợt 4 — cảnh báo vận hành

Trang Vận hành đọc projection admin cho cron giữ chỗ/buổi chơi/giải/hàng đợi,
worker HTTP, tác vụ gửi lỗi/tồn, chủ sân cần nối SePay và giao dịch nhận diện được
đang gắn cờ trên 24 giờ. Không lộ command, phản hồi thô, Vault hay giao dịch riêng.
Không suy đoán lỗi webhook khi không có tiền vào. `operational-health` chạy 5 phút,
chỉ báo inbox admin khi mở/phục hồi sự cố, không lặp khi trạng thái giữ nguyên.
Trang cũng cảnh báo khi heartbeat giám sát cũ/tắt. Inbox nội bộ vẫn cần admin theo dõi;
chưa thay thế dịch vụ theo dõi uptime bên ngoài khi app/DB cùng mất kết nối.

Kiểm tra SQL rollback: projection/quyền, bỏ giao dịch riêng, mở/phục hồi/mở lại,
không báo trùng và không tạo tác vụ gửi tiền/email ngoài. Build cô lập và UI 390/1440
cùng hồi quy nhật ký/thông báo đạt. Lịch giám sát đã áp dụng trong migration.

## Đợt 5 — báo cáo tiền

`/chu-san/bao-cao-tien` và `/admin/bao-cao-tien` đọc tiền nhận đã nhận diện đúng
người nhận từ sổ riêng, phân nguồn SAN/GIAI/PHI. Tiền nhận theo thời điểm website ghi
nhận; hoàn sân theo giờ chuyển chứng từ khai báo. Không phải sao kê hoặc doanh thu;
không cộng xác nhận tay lần hai và không đưa giao dịch không mã/sai người nhận vào.
Nghĩa vụ hoàn sân là số còn lại hiện tại toàn thời gian (có căn cứ xác nhận tay),
loại phần giữ lại và tách đơn hoàn cũ thiếu chứng từ. Hoàn/quyết toán giải tiếp tục
xem tại từng giải, không tự nhận là đã có sổ hoàn tiền giải tương đương.

Khoảng tối đa 93 ngày, phân trang; CSV cùng phạm vi quyền và điều kiện SQL,
trên 5.000 dòng báo chọn khoảng nhỏ hơn. CSV escape công thức và cache riêng tư.
SQL rollback trước/sau migration kiểm tổng không nhân dòng, tiền thiếu/thừa,
ẩn giao dịch riêng/chủ khác, mốc nửa đêm Việt Nam, quyền/bị khóa, phân trang và
không cắt CSV. Build production cô lập và browser chủ sân/admin 390/1440 đạt.

## Đợt 6 — theo dõi tìm sân đến cọc

Giữ số thao tác tìm/mở/chọn giờ trong GA4 hiện có; không gửi mã đơn, định danh,
checkout hay dữ liệu thanh toán sang Google. Bổ sung nhóm đơn tạo trong 7/30/90 ngày
và số chính các đơn đó đã xác nhận cọc (kể cả hủy sau cọc), còn giữ hoặc kết thúc
chưa cọc, với tỷ lệ và bảng ngày do SQL tính. Loại thanh toán mô phỏng, chỉ admin
được xem dữ liệu tổng hợp. Hoạt động độc lập khi GA4 chưa kết nối; không chia số đơn
cho số thao tác GA4 và không gọi đó là phễu cùng người/phiên. Nối toàn hành trình
cần thiết kế đồng ý đo lường và quyền GA4, chưa tự thêm theo dõi cá nhân.

SQL rollback trước/sau triển khai kiểm quyền, tổng nhóm/bảng ngày, mô phỏng và kỳ.
Build cô lập và browser 390/1440 (bao gồm GA4 chưa cấu hình) đạt. Kiểm tra GA4 end-to-end
cần build riêng bật production measurement ID; không thực hiện gửi dữ liệu thật.

## Đợt 7 — báo cáo và tạm ẩn nội dung

Link Báo cáo trên hồ sơ/giải mở góp ý riêng tư với đúng đường dẫn và loại báo cáo.
Admin lọc báo cáo trong hàng đợi hỗ trợ, phản hồi riêng và ẩn/khôi phục ở trang
chi tiết. SQL yêu cầu admin hoạt động, lý do gửi người đăng và phiên bản trạng thái
để tránh ghi đè. Lưu trạng thái/lý do riêng tư và audit không có nội dung nhạy cảm.

Hồ sơ ẩn biến mất khỏi tìm kiếm/RPC công khai, người đăng vẫn sửa được và không tự
bỏ cờ ẩn. Giải ẩn không có trong RLS công khai/sitemap; người quản lý và người đã
đăng ký vẫn xem để xử lý cọc/hoàn. Chặn đăng ký mới và duyệt mới ngay trong SQL,
giữ lịch sân, các khoản tiền và đăng ký đã có. Không tự hủy giải hoặc đổi role.
Metadata giải ẩn không index, kể cả khi người có quyền xem trang riêng.

SQL ứng viên/sau triển khai rollback kiểm quyền, CAS, public/own/participant,
ẩn/khôi phục, chặn cam kết mới và giữ lịch sử tài chính. Build cô lập, browser
390/1440 cho báo cáo/triage và hồi quy chính sách/các luồng mới ở 5 độ rộng đạt.

## Đợt 8 — dữ liệu cá nhân

Theo người dùng giao tự chọn: 90 ngày từ từ chối hồ sơ gần nhất, 180 ngày từ kết thúc
hỗ trợ là mốc xem xét. `/admin/du-lieu` không bao gồm hồ sơ đang hoạt động hay hỗ trợ
có đơn/chứng từ. Người vận hành vẫn phải kiểm tra tiền/tranh chấp/yêu cầu đang mở,
Storage và backup trước khi xử lý; chưa có tự xóa hoặc lời hứa xóa chứng từ tài chính.

`/tai-khoan/du-lieu` tải JSON riêng của người đăng nhập (không xuất khách của chủ sân,
khóa, token, raw ngân hàng hoặc tệp riêng). Giới hạn 1.000 bản ghi mỗi nhóm báo cần
hỗ trợ xuất đầy đủ, không cắt lặng. Yêu cầu xem/sửa/xóa có loại riêng, UUID idempotent,
rate limit chung hỗ trợ, được theo dõi tại Góp ý của tôi/admin lọc Dữ liệu cá nhân.
Đóng yêu cầu cần phản hồi tối thiểu 20 ký tự nêu phạm vi xử lý/cần giữ; đổi trạng thái
không tự xóa dữ liệu. Ghi audit yêu cầu và tiến độ, không ghi nội dung riêng vào audit.

SQL rollback ứng viên/sau migration kiểm dữ liệu tự thân, chủ sân không xuất khách,
quyền, retry, phản hồi, loại chứng từ khỏi mốc rà soát và giới hạn xuất. Build cô lập,
browser 390/1440, giữ UUID khi lỗi và hồi quy trang chính sách/no-JS đạt; đã xem ảnh mobile.

## Đợt 9 — SQL CI cô lập

`SQL isolation` tạo stack Supabase local tạm trên GitHub runner, áp dụng toàn bộ
migrations Git theo dõi, tắt cron thử và chạy 19 bài SQL rollback cùng hai kết nối
tranh lịch thật. Không nhận URL cloud/`--linked`, không chép `.env`, `.temp` hoặc
khóa vận hành. `--preflight` và lint script đạt; [run 39544499450](https://github.com/MinhTT2/san-ngon/actions/runs/39544499450)
đã đạt trên runner: 83 migrations, 19 bài SQL và GiST chặn một trong hai kết nối tranh lịch. Fixture tự tạo cấu hình, không phụ thuộc dữ liệu vận hành. Xem `docs/sql-ci.md`.

## Đợt 10 — Mobile, khả năng truy cập và hiệu năng

Axe A/AA ở 390/1440, bàn phím bỏ qua điều hướng và tràn ngang đạt. Đã sửa nhãn
khớp chữ nhìn thấy, ngữ nghĩa dt/dd và ô lọc mobile; xem lại ảnh báo cáo/audit.
Hồi quy tìm→chọn giờ→giữ thông tin khách, thư viện ảnh, chuyển slide, bộ tối ưu
ảnh, báo cáo/CSV và nhật ký đạt. Đã đo production bằng trình duyệt mạng/CPU
giới hạn, xác định ảnh hero là điểm chậm rồi hoãn ảnh slide chưa xem và nén nhẹ.
Xem `docs/performance-accessibility.md`; chưa nhận kết quả lab là dữ liệu người dùng thật.

## Đợt 11 — SEO và URL

Sân active có metadata/ảnh chia sẻ riêng và schema SportsActivityLocation; giải
công khai có SportsEvent. Projection chỉ dùng trường công khai, escape script;
giải ẩn/chưa công khai và view vận hành không phát schema. URL lọc/phân trang
noindex/follow, canonical về danh sách gốc; view tài khoản nofollow.
Sửa lỗi bộ lọc giải nhận tham số lặp khiến trang 500. Unit schema/escaping, build,
browser metadata/canonical, URL lặp và metadata khi người quản lý xem giải ẩn đạt.
Hồi quy public/sitemap, axe, tìm/đặt và xử lý lỗi truy vấn đạt. Xem `docs/seo.md`.

## Kiểm tra bản production cuối

Bản code `e620df8` đã deploy lên [website](https://san-ngon.vercel.app).
[CI 39546392688](https://github.com/MinhTT2/san-ngon/actions/runs/39546392688)
đạt cả job check (lint/typecheck/build, API, schema) và browser đầy đủ.
SQL CI có bằng chứng riêng ở đợt 9; từ đó đến bản deploy không đổi schema.
Kiểm tra trực tiếp production:

- Trang chủ/tìm sân/giải/chi tiết sân trả 200; phân trang vượt dữ liệu không gây 500.
  Fixture cũng trả đúng lỗi PostgREST 416 để kiểm tra đường phục hồi công khai/admin.
- Canonical/noindex URL lọc, schema sân/giải trong sitemap và view riêng tư đạt.
  API xuất dữ liệu cá nhân chặn phiên anonymous.
- Chromium headless cô lập ở 390/1440: axe A/AA và không tràn ngang đạt cho bốn
  trang công khai; đã xem ảnh trang chủ mobile và sân desktop.
- Hai lượt lab sau tối ưu ghi tại `docs/performance-accessibility.md`; không gọi
  kết quả này là Core Web Vitals thực tế hoặc tuyên bố LCP đã đạt 2,5 s.

Cron nghiệp vụ/giám sát và worker thông báo đang hoạt động; lần kiểm tra vận hành
cuối không có tin gửi lỗi/tồn. Còn một giao dịch đã nhận diện gắn cờ quá 24 giờ,
cần người vận hành đối soát tại `/admin/tien-vao`; không tự xác nhận tiền/hoàn.
Không bật cờ nhiều chủ sân trước nghiệm thu chuyển khoản thật. Các phụ thuộc
ngoài code phía trên vẫn cần thực hiện và ghi bằng chứng riêng.
