# Biên bản D2 — bổ sung sáu case còn mở

Ngày kiểm tra: **09/10/2026**, tiếp nối [lượt đầu](test-results-d2-2026-10-09.md). Người dùng đã cho phép tiếp tục trên Supabase liên kết, tạo dữ liệu thử và dọn sau chạy.

**Sáu case bổ sung D2-01/02/03/04/15/16 đã đạt trong phạm vi ghi nhận.** Tổng hợp với lượt đầu: **16/16 case D2 đạt** trên các bản chụp và môi trường được mô tả dưới đây. Checkout ban đầu bị chặn do mã/schema chưa đồng bộ; database được cập nhật từ công việc khác, sau đó kiểm lại các trạng thái và đạt. Có một quan sát tìm mã mất khoảng 44 giây cần theo dõi. Kết quả không xác nhận toàn bộ workspace cuối cùng hoặc domain triển khai.

## Môi trường và phiên bản

- Lượt chính **16:05–16:09 giờ Việt Nam**, HEAD `fb9e24136423bba93dd589b71e28bc62d14f752d` cộng thay đổi local, gồm file nguồn chưa tracked. Sao chép nguồn sang thư mục tạm, build và chạy riêng tại `http://127.0.0.1:43383`.
- Chạy lại riêng D2-04 và chẩn đoán D2-16 **16:11–16:13**, server `http://127.0.0.1:39491`. Giữ đúng nguồn của lượt chính; đối chiếu SHA-256 toàn bộ file trước khi build lại. Không thay mã sản phẩm để làm test đi qua.
- Danh sách đơn kiểm độc lập **16:14–16:17** và chạy lại có ghi request/response **16:18–16:21**, server `http://127.0.0.1:45783` ở lượt chạy lại. Chụp nguồn mới, cùng HEAD `fb9e241`; hash trang danh sách, component danh sách, query controls và Supabase client giống lượt trước. Kiểm checkout cuối **16:23–16:24**, tái sử dụng nguyên bản build của lượt danh sách và kiểm hash nguồn trước khi chạy; origin chính xác nằm trong kết quả checkout.
- Node **24.18.0**, Next **15.5.27**, Chromium **153.0.8010.12** headless, context đăng nhập riêng A/B và context khách, 1440×1000, múi giờ Việt Nam. Không dùng Chrome hoặc cookie cá nhân.
- Database lượt chính có **56 migrations**, lượt danh sách chạy lại có **57**, lượt checkout cuối có **61** do công việc khác cập nhật trong lúc kiểm thử. `search_my_bookings` và `create_booking_once` tồn tại; MD5 `create_booking` vẫn `eedfff8847922a6206afb1edc1f98cf2`, có GiST `bookings_no_overlap`. Cờ nhiều chủ sân đã true từ trước, task kiểm thử không thay đổi cờ, không áp dụng migration.
- Fixture chính: **3 tài khoản, 12 cụm, 16 sân con, 1 kết nối SePay giả trong database**. Có 10 cụm active, 1 draft và 1 rejected; tên mang nhãn kiểm thử, tài khoản nhận giả, không có OAuth/token/provider thật. Mỗi lượt kiểm riêng tiếp theo dùng fixture mới: 3 tài khoản, 2 cụm, 5 sân con, 1 kết nối giả; các ID extra được sinh nhưng không insert.
- Ngày chơi 16/10/2026 và ngày kế tiếp 17/10/2026 do SQL tính. Không gửi email, chuyển khoản, tạo webhook ngoài hệ thống hoặc upload Storage. Các trạng thái đã trả cọc/completed chỉ được dựng trên đơn thử, không phải giao dịch tiền thật.

## Kết quả bổ sung

| Case | Kết quả sau đối chiếu lượt đầu | Bằng chứng mới |
| --- | --- | --- |
| D2-01 | **Đạt** | 10 cụm active phù hợp, SQL và UI có 2 trang **9/1**; đi trang sau/trước không trùng/mất cụm, giữ tên/môn/ngày/quận/indoor/available/sort. Draft và rejected không xuất hiện. |
| D2-02 | **Đạt** | Đi qua từng link nới available, tên, quận, indoor khi kết quả rỗng; giữ môn/ngày. Mở cụm từ trang 2, đổi ngày rồi bấm “Kết quả tìm sân”: giữ toàn bộ bộ lọc, ngày mới và page 2. |
| D2-03 | **Đạt** | Hai trang khách đang mở tự đổi số khung **68 → 67 → 68** khi B giữ/hủy sân; lịch cảnh báo lựa chọn không còn đủ thời gian và cho chọn lại sau hủy. Thẻ cập nhật sau **16.386 giây**, ghi nhận mỗi trang có 2 lần đọc lại. Không reload thủ công. **Không có event dòng đơn của B:** đồng bộ thông qua đọc lịch công khai định kỳ, không coi đây là chứng minh khách nhận realtime riêng tư của người khác. Kiểm không lộ liên hệ ở lượt đầu vẫn giữ. |
| D2-04 | **Đạt** | UI đổi qua cầu lông 60 phút, pickleball 90 phút, bóng đá 120 phút; chỉ cho sân đúng môn. Cầu lông có giờ riêng bắt đầu 06:00, hai môn kế thừa giờ cụm bắt đầu 05:00; form khớp giờ/tên sân và giá SQL **100.500 / 150.750 / 201.000đ**. |
| D2-15 | **Đạt — form/API và khôi phục intent** | B chiếm giờ sau khi A nhập form: lỗi thật giữ tên/ghi chú; A chọn giờ khác, tạo đơn thành công với đúng liên hệ đã giữ. Cho request thực sự tạo đơn rồi bỏ phản hồi: form cảnh báo đơn có thể đã tạo. Bấm hai lần chỉ có 1 request; qua Đơn của tôi, reload, khôi phục và bấm hai lần vẫn chỉ thêm 1 request trả cùng mã. SQL có đúng **1 booking_requests, 1 payment**, hạn giữ chỗ không đổi. Checkout ở thời điểm này còn bị điểm chặn đã xử lý sau đó ở D2-16. |
| D2-16 | **Đạt — sau kiểm lại schema** | Bộ lọc pending/confirmed/history/all có chính xác **1/1/4/6** đơn, không thừa mã; đúng sân và tổng/cọc 100.500đ. Pending có thanh toán/hủy giữ chỗ; confirmed còn giờ có hủy đơn; history không có hai hành động này. Tìm mã completed trả đúng 1 đơn. Sau khi schema đồng bộ, checkout confirmed/completed/cancelled/expired/past mở được, không còn QR hoặc nút hủy giữ chỗ; các trạng thái có nhãn phù hợp. Hold ngắn tự chuyển màn hết hạn khi trang đang mở. Past fixture vẫn confirmed trước cron, không lộ hành động pending. |

Lượt đầu giữ nguyên kết quả D2-05–14 trên baseline đã ghi ở biên bản đó. Chưa nghiệm thu chuyển tiền hoặc mọi kích thước màn hình.

## Điểm chặn đã kiểm lại và quan sát còn theo dõi

**D2-B01 — mã checkout và schema chưa đồng bộ.** Trong bản chụp, `app/dat-san/[code]/page.tsx` select `court_name_snapshot`, `venue_name_snapshot`, `venue_address_snapshot`. Database liên kết có **0/3** cột này. Truy vấn lỗi nên nhánh `notFound()` chạy ngay cả với đơn tồn tại và đúng người đăng nhập.

Tái hiện lúc đầu: đăng nhập người chơi thử → tạo đơn bằng RPC/API thật → mở `/dat-san/<mã vừa tạo>` → HTTP 404. Migration local `20261009000200_booking_details_snapshot.sql` thuộc công việc khác và còn thay đổi khi lượt đầu chạy. Sau đó catalog có đủ ba cột; lượt checkout cuối chạy trên nguyên build giữ lại và đạt năm trạng thái trên. Công việc snapshot được commit riêng ở `0bb5303`, không thuộc commit biên bản này. **Đã đóng điểm chặn cho tổ hợp build/schema kiểm lại**, chưa kiểm riêng domain triển khai.

**D2-O01 — tìm mã có độ trễ cần theo dõi.** Lượt danh sách đầu chờ 12 giây rồi timeout; lượt ghi request/response với thời gian chờ 45 giây tìm đúng mã nhưng hoàn tất toàn bước sau **43.637 giây**. Có response 200 cho URL chứa mã sớm hơn thời điểm hoàn tất UI, không đủ bằng chứng quy toàn bộ thời gian cho truy vấn database. Môi trường đang có cập nhật song song; chưa kết luận lỗi hiệu năng cố định. Giữ log và kiểm lại thời gian URL/kết quả hiển thị ở D9-05/06 trên môi trường ổn định. Không sửa kết quả timeout cũ thành đạt.

## Dọn dữ liệu và kiểm tra

Đã kiểm cleanup cả **5 lượt**: **0 tài khoản Auth, hồ sơ, cụm, sân con, đơn, kết nối giả, booking_requests, notifications, price_rules, closures, sepay_events** theo toàn bộ ID fixture. Payments được xóa trong cleanup và có foreign key `ON DELETE CASCADE` tới bookings; không giữ khoản tiền giả của các đơn đã dọn. Không có giao dịch transfer claim mới trong đợt này.

Build các bản chụp đều đạt, gồm lint và kiểm kiểu của Next; không có page exception. Lượt checkout cuối dùng lại build đã đạt, không build lại mã mới. Server và thư mục build tạm được dọn. Hash nguồn và danh sách file đổi sau chụp nằm trong từng `results.json`; một phần drift là chính biên bản kiểm thử. Không gán kết quả cho các thay đổi xuất hiện sau bản chụp.

Lỗi công cụ đã phân biệt: D2-04 ban đầu bấm giờ sớm nhất 05:00 rồi cố chọn sân chỉ mở lúc 06:00; sửa script để chọn giờ đầu tiên của đúng sân từ SQL, chạy lại cùng hash nguồn và đạt. D2-16 ban đầu chờ nhãn hết hạn/hủy rồi timeout; kiểm lại mới xác nhận trang thực tế là 404 do thiếu cột. Kết quả thô ban đầu vẫn được giữ, không sửa FAIL thành PASS trong file bằng chứng.

## Bằng chứng local

Không commit log/ảnh/script thử. Các đường dẫn dưới đây chỉ dùng trên máy còn giữ thư mục output:

- [Lượt chính: kết quả, hash và drift](../output/d2-followup-2026-10-09/results.json), [build](../output/d2-followup-2026-10-09/build.log), [cleanup bổ sung](../output/d2-followup-2026-10-09/cleanup-audit.json).
- [Chạy lại D2-04 và chẩn đoán checkout](../output/d2-targeted-2026-10-09/results.json), [build lại](../output/d2-targeted-2026-10-09/build.log).
- [Danh sách đơn lượt đầu](../output/d2-list-2026-10-09/results.json), [danh sách đơn chạy lại và request/response](../output/d2-list-retry-2026-10-09/results.json), [ảnh tìm mã completed](../output/d2-list-retry-2026-10-09/completed-order-search.png).
- [Checkout sau đồng bộ schema](../output/d2-checkout-2026-10-09/results.json), [ảnh completed](../output/d2-checkout-2026-10-09/completed-checkout.png), [cleanup cả năm lượt](../output/d2-followup-2026-10-09/all-cleanup.json).
- [Trang 2 với bộ lọc](../output/d2-followup-2026-10-09/search-page-two.png), [checkout 404](../output/d2-targeted-2026-10-09/checkout-schema-mismatch.png).

## Tiếp theo

Tiếp tục D3 về phân quyền, ghi baseline và schema mới sau các cập nhật song song. Theo dõi D2-O01 ở D9; các lỗi/điểm chặn D0/D1 và nghiệm thu tiền thật vẫn giữ trạng thái ở biên bản tương ứng.
