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
| 5 | Báo cáo thực nhận/thực hoàn/nghĩa vụ và CSV | SQL triển khai và kiểm tra đạt; code chờ deploy |
| 6 | Đo phễu tìm sân–đặt–trả tiền | Đang phát triển; số tìm sân GA4 còn phụ thuộc quyền đọc |
| 7 | Báo cáo và xử lý nội dung công khai | Chờ |
| 8 | Yêu cầu dữ liệu cá nhân và thời hạn lưu | Chờ; thời hạn lưu cần người vận hành chốt |
| 9 | Database thử cho SQL/CI | Chờ; không tự dùng project vận hành làm DB CI |
| 10 | Hiệu năng thực và khả năng tiếp cận | Chờ |
| 11 | SEO sân/giải và kiểm soát URL bộ lọc | Chờ |

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
