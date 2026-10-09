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
