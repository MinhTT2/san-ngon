# Tiến độ hoàn thiện website — 09/10/2026

Theo [báo cáo đánh giá](website-assessment-2026-10-09.md). Triển khai từng hạng mục, kiểm tra và bàn giao riêng. Những thay đổi local của các task khác không nằm trong biên bản này.

## Đợt 1 — A02: kiểm tra đầu vào và giới hạn đặt sân trong SQL

Thay đổi:

- Migration `20261009000000_booking_input_guards.sql` cập nhật đúng chữ ký `create_booking` đang dùng; không thay schema/types của đơn.
- SQL chỉ cho tối đa 3 khung được lịch SQL trả về và bao phủ liên tục khoảng chơi. Giới hạn tính theo số khung, áp dụng cho sân dùng khung 30/60/90/120 phút.
- Chặn số điện thoại không phải 10 chữ số bắt đầu bằng 0, tên quá 100 ký tự, ghi chú quá 500 ký tự, thời điểm null/vô hạn và khoảng không hợp lệ. Tên/ghi chú vẫn tùy chọn để giữ tương thích API; trim và lưu null khi trống.
- API tiếp tục chỉ xác thực đầu vào/gọi RPC; dịch các lỗi mới sang tiếng Việt. Không nhận tiền từ client, không đưa giới hạn nghiệp vụ vào TypeScript.
- Giữ nguyên tính giá/cọc 100%, giới hạn 2 đơn chờ, GiST, snapshot người nhận và chính sách hủy của đơn hiện có.
- Thêm kiểm tra API vào CI. Fixture của bài giữ chỗ đặt cờ nhiều chủ sân rõ ràng bên trong transaction để kết quả không phụ thuộc cờ hiện tại của môi trường.

Kiểm tra trước triển khai:

- Áp dụng migration ứng viên và bài SQL mới/bài giữ chỗ hiện có trong cùng transaction rồi rollback: đạt.
- Gọi RPC dưới role `authenticated`: 12 tổ hợp 1–3 khung ở cả 4 độ dài khung đạt; 4 khung ở mỗi độ dài bị từ chối. Kiểm tra giá không làm tròn lên hàng nghìn, cọc bằng giá SQL, snapshot người nhận, trim và chiều dài biên tiếng Việt.
- Điện thoại sai, tên/ghi chú dài, thời điểm null/vô hạn, khoảng lệch khung và vượt 2 đơn chờ bị từ chối; không thêm đơn/thanh toán hoặc thay điện thoại hồ sơ khi thất bại.
- Bài hồi quy giữ chỗ kiểm giá server, GiST, hủy/hết hạn, tiền thiếu/muộn, xác nhận tay, retry và snapshot OAuth. Dữ liệu/config của bài thử đều rollback, không gửi thông báo ra ngoài.
- Bài API dùng route thật với phiên/RPC giả lập: validation và bản dịch lỗi đạt; giữ HTTP 401/409/201; số tiền giả do client gửi bị bỏ qua. Đây không phải nghiệm thu tạo đơn qua HTTP với tài khoản thật.

Lệnh chạy lại:

```sh
npm run ci
node scripts/check-booking-inputs.mjs
npx supabase db query --linked --file scripts/check-booking-input-guards.sql
npx supabase db query --linked --file scripts/check-booking-holds.sql
```

Trước khi chạy SQL, kiểm tra đúng project liên kết. Mỗi bài thử là một transaction ngắn và kết thúc rollback; không chạy đồng thời các bài cùng sửa fixture `booking_operator`. Không dùng dữ liệu thử để nghiệm thu chuyển khoản thật.

Trạng thái: **hoàn thành ngày 09/10/2026**.

- Lint, typecheck và production build đạt. Lint còn một warning có sẵn ở script của task khác trong `output/d0-2026-10-09/run-d0.mjs`; không sửa file đó trong đợt này.
- Dry-run chỉ liệt kê migration mới `20261009000000_booking_input_guards.sql`; đã áp dụng migration này lên Supabase liên kết.
- Sau triển khai, chạy lại riêng bài SQL mới và bài giữ chỗ: đều đạt và rollback toàn bộ dữ liệu thử.
- Cờ nhiều chủ sân và dữ liệu thử được kiểm tra lại sau rollback; không để lại tài khoản/đơn/thanh toán fixture.
- Bài API mới được chạy thành công và thêm vào CI. Không có thay đổi bố cục nên đợt này không chạy lại toàn bộ bộ kiểm tra trình duyệt.

## Những việc cần thông tin vận hành

SMTP/domain gửi thư, dữ liệu sân thật, chính sách hủy và nghiệm thu chuyển khoản vẫn là các mục riêng. Đợt này không đổi người nhận tiền, cờ nhận đơn nhiều chủ sân, giá/cọc hoặc mốc hoàn tiền.

## Đợt 2 — A13: báo lỗi tải dữ liệu và thử lại

- Tổng quan chủ sân phân biệt lỗi lịch/đơn, hoàn cọc, thống kê và kết nối Telegram với dữ liệu trống. Không hiện lịch «Trống», «Hôm nay chưa có đơn nào» hoặc trạng thái chưa kết nối khi query tương ứng thất bại.
- Tổng quan admin, hồ sơ sân/chủ sân, đơn và tài khoản không biến lỗi query thành số 0 hoặc bảng rỗng. Lỗi kiểm tra quyền không bị hiểu thành tài khoản không có quyền.
- Trang chủ không hiển thị số 0 thay dữ liệu bị lỗi; lỗi lịch thật có thông báo riêng, không rơi về lịch minh họa.
- Thông báo tiếng Việt và nút «Thử lại» tải lại dữ liệu từ server; các phần độc lập tải thành công vẫn sử dụng được. Không lộ nội dung lỗi database cho người dùng.
- Thêm giả lập lỗi đọc vào fixture cục bộ và bài kiểm tra trình duyệt riêng, chạy cùng CI giao diện.

Kiểm tra: lint, typecheck và production build đạt. Kiểm tra giao diện trang chủ/tổng quan chủ sân/admin ở 320/390/768/1024/1440px; 11 trường hợp lỗi và phục hồi ở 390/1440px. Tất cả dùng dữ liệu giả lập và Chromium headless với context riêng, không dùng phiên cá nhân hay ghi dữ liệu thật.

Lệnh chạy lại:

```sh
npm run lint
npm run typecheck
npm run check:ui -- --only=check-query-errors,check-dashboard-ui,check-public-ui
```

Trạng thái: **hoàn thành ngày 09/10/2026**.

## Đợt 3 — A07: vá thư viện chạy website

- Next.js 15.5.25 → 15.5.27, eslint-config-next đồng bộ 15.5.27; sharp 0.35.4 → 0.35.5 và source-map-js 1.2.1 → 1.2.2.
- Lockfile và overrides giữ bản đã vá; không đổi nhánh major Next, danh sách host ảnh hay quyền tối ưu SVG.
- `npm audit --omit=dev` không còn cảnh báo. Audit gồm công cụ phát triển còn 37 cảnh báo; A07 vẫn mở phần CLI/lint. Chi tiết advisory, đường sử dụng và ngoại lệ trong [biên bản thư viện](dependency-security-2026-10-09.md).
- Bài kiểm tra ảnh qua endpoint Next được đưa vào CI giao diện; dùng ảnh sẵn có, kiểm xử lý ảnh/giải mã, chặn host ngoài danh sách và SVG.

Kiểm tra: lint, typecheck, production build, hợp đồng API đặt sân và queue realtime đạt; bộ giao diện trang chủ/tìm sân/đặt sân/checkout/báo lỗi và bài xử lý ảnh đều đạt trên fixture riêng. Không tạo đơn hoặc chuyển tiền thật.

Trạng thái: **hoàn thành phần runtime ngày 09/10/2026**; A07 còn ngoại lệ công cụ phát triển. Biên bản đã ghi rõ 37 cảnh báo còn lại, gồm critical trong tar của cây Vercel CLI.

Bổ sung guard cho runner để từ chối sớm khi danh sách kiểm tra nhắc tới script chưa được Git theo dõi. Tham chiếu tạm tới bài auth trong đợt trước đã có file tương ứng được bàn giao ở commit kế tiếp; danh sách kiểm tra của bản push hiện tại đầy đủ.

## Đợt 4 — A09: phục hồi đúng yêu cầu đặt sân

- RPC `create_booking_once` nhận khóa riêng từng lần đặt, gắn với tài khoản đăng nhập và hash đầu vào đã chuẩn hóa. Cùng khóa/nội dung trả đúng đơn cũ; khác nội dung báo xung đột. Bảng hash không có quyền đọc/ghi trực tiếp từ trình duyệt.
- Khóa dòng hồ sơ giống `create_booking` để các lần thử lại của cùng tài khoản được xử lý lần lượt. GiST vẫn chống trùng sân giữa các người đặt; việc tạo đơn/tính giá vẫn gọi SQL `create_booking` hiện tại.
- Retry trả trạng thái hiện tại, giá/người nhận/hạn giữ chỗ cũ; không kéo dài hoặc khôi phục đơn hủy/hết hạn. Giao dịch tạo đơn, payment và khóa retry là một transaction.
- API chấp nhận khóa mới, giữ tương thích với tab cũ không gửi khóa. Lỗi database/kết nối chưa rõ kết quả trả 503, không bị coi là từ chối nghiệp vụ.
- Form lưu yêu cầu đang gửi trong sessionStorage theo tài khoản. Khi chưa rõ kết quả, người dùng vào Đơn của tôi để tiếp tục đúng yêu cầu; tải lại trang không tự gửi lại. Chuyển tài khoản không tái sử dụng thông tin cũ. API cũng kiểm tra tài khoản kỳ vọng khi client gửi thông tin này.

Kiểm tra đã đạt trước triển khai: migration ứng viên + bài SQL trong một transaction và rollback; quyền RPC/bảng, normalize/timezone, retry tại giới hạn 2 đơn, xung đột từng trường, snapshot giá/người nhận, đơn hủy/hết hạn/đã xác nhận, tài khoản bị khóa/khác tài khoản, giới hạn 3 khung và 1 payment/đơn. Bài API, lint và typecheck đạt. Các bài SQL không gửi email hoặc tiền thật; chưa phải nghiệm thu nhiều kết nối HTTP đồng thời.

Trạng thái: **hoàn thành ngày 09/10/2026**.

- Production build và các bài giao diện đặt sân/khôi phục/checkout/tài khoản đạt. Khôi phục được sau reload ở 390/1440px, bấm hai lần chỉ gửi một lần, cùng UUID và thông tin gốc, dữ liệu sai hoặc khác tài khoản không được tái sử dụng.
- Dry-run chỉ liệt kê migration mới `20261009000001_booking_requests.sql`; đã áp dụng lên Supabase liên kết.
- Sau triển khai, bài SQL retry, bài giới hạn đầu vào và hồi quy giữ chỗ đều đạt, mỗi bài rollback riêng và chạy lần lượt.
- Các phần types của bảng/RPC mới lấy từ database đã triển khai; không gộp thay đổi types/hiển thị sân đang làm ở task khác.

Lệnh chạy lại:

```sh
node scripts/check-booking-inputs.mjs
npx supabase db query --linked --file scripts/check-booking-requests.sql
npx supabase db query --linked --file scripts/check-booking-input-guards.sql
npx supabase db query --linked --file scripts/check-booking-holds.sql
npm run check:ui -- --only=check-booking-recovery,check-booking-polish,check-checkout-ux,check-personal-ui
```

Nếu trình duyệt chặn sessionStorage, dữ liệu thử lại không tồn tại qua reload; danh sách đơn thật vẫn là cách kiểm tra. Không tự tạo đơn khi mở Đơn của tôi. Chưa nghiệm thu chuyển khoản thật hoặc HTTP đồng thời với tài khoản thật trong đợt này.


## Đợt 5 — A12: lịch sử đơn của chủ sân

- RPC `search_owner_bookings` kiểm tra tài khoản và quyền chủ cụm/admin, tìm mã đơn, tên khách hoặc số điện thoại; hỗ trợ số điện thoại dạng +84 có dấu cách. Tìm chuỗi ký tự nguyên văn, không biến `%`/`_` thành wildcard.
- Bộ lọc trạng thái, khoảng ngày, cả lịch sử và đơn cần hoàn cọc. Tìm mã/liên hệ và lọc hoàn cọc bao gồm đơn cũ nếu không chọn giới hạn ngày; mặc định xem 30 ngày tới do SQL tính theo múi giờ Việt Nam.
- Mỗi trang tối đa 30 đơn, thứ tự ổn định; tổng số và thống kê tính trên toàn bộ kết quả lọc. Chuyển trang giữ bộ lọc; tìm/lọc hoặc đổi cụm sân trở về trang đầu.
- Giữ các nút xác nhận cọc và đánh dấu hoàn hiện tại, realtime của khu chủ sân và đường dẫn ngày cũ. Lỗi tải/ngày sai có thông báo, không bị hiểu thành không có đơn.
- A12 còn phần phân trang lịch sử của người chơi; đợt này chỉ hoàn tất khu chủ sân.

Kiểm tra SQL: 40 đơn trải qua quá khứ/tương lai, tổng số vượt một trang, phân trang không trùng, trang quá lớn, mã cũ, số điện thoại +84, tên chứa `%_`, khoảng ngày, trạng thái, hoàn cọc cũ, dữ liệu rỗng, tham số sai, tài khoản khác/chủ sân khác/bị khóa và quyền anon. Migration ứng viên chạy cùng bài thử trong transaction rollback trước triển khai.

Lệnh chạy lại:

```sh
npx supabase db query --linked --file scripts/check-owner-booking-search.sql
npm run check:ui -- --only=check-owner-booking-search,check-dashboard-ui,check-query-errors,check-booking-polish
```

Trạng thái: **hoàn thành phần chủ sân ngày 09/10/2026**. Bản dựng production riêng cùng lint/typecheck đạt; tìm/lọc/phân trang/ngày sai ở 390/1440px, khu quản lý ở 320–1440px, giả lập lỗi/phục hồi và thao tác xác nhận/hoàn cọc đều đạt. Đã áp dụng riêng migration `20261009000002_owner_booking_search.sql`, chạy lại bài SQL sau triển khai và rollback dữ liệu thử. Không triển khai migration tìm sân đang làm ở task khác.


## Đợt 6 — A12: lịch sử đơn của người chơi

- `search_my_bookings` chỉ đọc đơn của `auth.uid()`, kiểm tra tài khoản đang hoạt động; không nhận user ID từ trình duyệt và không có quyền gọi anon. Trả đúng các thông tin cần hiển thị, không trả liên hệ khách đặt.
- Chuyển tìm mã/tên sân/khu vực/môn sang SQL với tìm không dấu theo từng từ; phân trang 30 đơn, tổng số và số chờ cọc/sắp chơi/lịch sử tính trên toàn bộ kết quả tìm kiếm và khoảng ngày.
- SQL phân loại giữ chỗ hết hạn và buổi đã qua ngay khi đọc, không đợi cron. Sắp đơn còn hoạt động trước, ưu tiên chờ cọc, rồi lịch sử gần nhất; thứ tự có ID làm khóa cuối để phân trang ổn định.
- Người chơi lọc khoảng ngày, chuyển trang giữ tìm kiếm/bộ lọc; tìm kiếm có trì hoãn ngắn để không gọi server mỗi phím, giữ focus, hiện trạng thái đang tải. Đổi mục/tìm kiếm trở về trang đầu; reload và điều hướng giữ tham số.
- Giữ realtime, đồng bộ khi focus/nối mạng/kết nối lại và timer hiển thị hạn trên trang; giữ nguyên thao tác hủy, thanh toán và phục hồi yêu cầu đặt sân.

Trạng thái: **A12 hoàn thành ngày 09/10/2026**. Migration `20261009000100_player_booking_search.sql` đã áp dụng riêng, không triển khai các migration chưa nghiệm thu của task khác. Các migration mang số nhỏ hơn nhưng chưa triển khai cần kiểm tra và dùng `--include-all` khi bàn giao sau; không xóa/sửa lịch sử migration.

Kiểm tra SQL ứng viên và bản đã triển khai đều đạt, rollback riêng: 42 trạng thái đơn, phân trang/tổng số, mã cũ/hoàn cọc, không dấu/nhiều từ, giới hạn ngày theo Việt Nam, dữ liệu rỗng/tham số sai/quyền tài khoản; thêm 1.001 đơn lịch sử để xác nhận tổng 1.043 đơn vẫn đầy đủ và trang cuối trả đúng 18 đơn lịch sử. Không để dữ liệu thử tồn tại sau rollback.

Lint và bản dựng production riêng/typecheck đạt. Trình duyệt headless với context riêng ở 390/1440px kiểm tra lịch sử nhiều trang, tìm đơn cũ, reset trang, reload/focus, không dấu, ngày sai và lỗi đọc/phục hồi. Hồi quy đặt sân/hủy/xác nhận/hoàn cọc và phục hồi yêu cầu đạt; ảnh giao diện chủ sân/người chơi đã được xem lại. Không nghiệm thu tiền thật trong đợt này.

```sh
npx supabase db query --linked --file scripts/check-player-booking-search.sql
npm run check:ui -- --only=check-player-booking-search,check-booking-polish,check-booking-recovery,check-owner-booking-search
```
