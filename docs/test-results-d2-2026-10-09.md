# Biên bản D2 — tìm sân và đặt/hủy đơn, lượt đầu

Ngày kiểm tra: **09/10/2026**. Lượt tích hợp chính **15:39–15:45 giờ Việt Nam**; kiểm tra bổ sung và dọn sổ giao dịch sau đó.

**Cập nhật sau lượt đầu:** xem [biên bản bổ sung sáu case](test-results-d2-followup-2026-10-09.md). D2-01/02/03/04/15/16 đã bổ sung đạt trong phạm vi ghi nhận; có quan sát tìm mã chậm cần theo dõi ở D9. Bảng dưới giữ nguyên kết quả lịch sử của lượt đầu.

**16 nhóm biến thể đã chạy đều đạt, chưa phát hiện lỗi sản phẩm mới.** Khi đối chiếu toàn bộ kế hoạch, ghi **10 case đạt trong phạm vi dưới đây, 6 case chưa chạy đủ**. D2 chưa đóng: không dùng một biến thể đạt để thay thế các biến thể còn thiếu của cùng case. Đợt này không sửa mã sản phẩm hoặc nghiệm thu chuyển khoản thật.

## Bản kiểm tra và dữ liệu

- Theo [kế hoạch](test-plan-2026-10-09.md), dùng project Supabase đang liên kết với dữ liệu thử được người dùng cho phép tạo và dọn.
- Local HEAD **`31bd103fc6378ec62ace060ad997367c0212af3c`**, cộng các thay đổi local lúc chụp, gồm file nguồn mới chưa được Git theo dõi. Mã được sao chép sang thư mục tạm cố định, build và chạy server riêng tại `http://127.0.0.1:35951`. Không dùng Chrome/cookie cá nhân hoặc ghi đè `.next` của workspace.
- Node **24.18.0**, Next **15.5.27**, Chromium **153.0.8010.12** headless, hai context người chơi riêng, desktop 1440×1000. Hash SHA-256 từng file được chụp lưu trong `output/d2-2026-10-09/results.json`.
- Database lúc bắt đầu có **54 migrations**; `create_booking_once` đã có, GiST `bookings_no_overlap` tồn tại. MD5 định nghĩa `create_booking` là **`eedfff8847922a6206afb1edc1f98cf2`**; bài SQL bổ sung đối chiếu lại đúng định nghĩa này. Không tự áp dụng migration. `multi_owner_enabled` đã true trước test, không thay cờ.
- Fixture chính: **3 tài khoản** (chủ sân, A, B), **2 cụm** (active/draft), **5 sân con** (30/60/90/120 phút; cầu lông, pickleball, bóng đá), **1 kết nối SePay giả** chỉ trong database, không có OAuth/token thật. Tên cụm có nhãn `KIEM THU TAM KHONG DAT`; tài khoản nhận giả không được chuyển tiền.
- Ngày chơi **16/10/2026**, do SQL tính theo múi giờ Việt Nam. Giá cơ bản 100.500đ/giờ, sân khác 150.000đ/giờ, mức giờ vàng 200.500đ/giờ. Giờ cụm 05:00–23:00; hai sân có giờ riêng 06:00–22:00.
- Tài khoản thử đăng nhập thật; request API/RPC dùng phiên/token thật. Lỗi mạng của request tạo đơn được chặn ở trình duyệt. Khoản tiền đến muộn chỉ gọi SQL với giao dịch giả; không gửi webhook ra provider hoặc chuyển tiền.

## Kết quả từng case

| Case | Kết quả | Bằng chứng và phần còn thiếu |
| --- | --- | --- |
| D2-01 | **Chưa chạy đủ — phần đã chạy đạt** | Tìm theo tên/địa chỉ, môn, quận, ngày và available bằng RPC; UI giữ các bộ lọc. Cụm draft không xuất hiện; page 999 được giới hạn về page 1 khi chỉ có một kết quả. Chưa tạo đủ hơn 9 cụm để kiểm trang 1/2 thực tế; chưa có fixture rejected. |
| D2-02 | **Chưa chạy đủ — phần đã chạy đạt** | Tìm không có kết quả có link bỏ tìm theo tên, giữ môn/ngày; mở sân rồi Back giữ q/ngày. Chưa đi qua từng cách nới quận/indoor/available hoặc đổi ngày sau khi mở sân để đối chiếu bối cảnh. |
| D2-03 | **Chưa chạy đủ — phần đã chạy đạt** | RPC tìm kiếm và lịch công khai khớp: **68 → 67 → 68** khung cầu lông khi B tạo/hủy một hold. Response lịch không chứa ID đơn/người đặt hoặc trường liên hệ. Chưa đo việc thẻ tìm kiếm đang mở tự đổi số sau mutation, chưa phân biệt cập nhật realtime với fallback trên UI. |
| D2-04 | **Chưa chạy đủ — phần đã chạy đạt** | SQL trả đủ ba môn; sân giờ null bắt đầu 05:00/kết thúc 23:00; sân giờ riêng bắt đầu 06:00/kết thúc 22:00. UI đã chọn môn cầu lông và đổi thời lượng 60/120 phút. Chưa đổi qua cả ba môn và đối chiếu gợi ý từng môn trên UI. |
| D2-05 | **Đạt** | Khóa sân 30 phút cả khoảng; sân A chỉ trống nửa đầu, B chỉ trống nửa sau. UI không cho chọn 10:00 cho 120 phút; RPC tạo đơn một sân bị từ chối `SLOT_TAKEN`. Không ghép hai sân thành một đơn. Bài logic còn kiểm khoảng có khe hở. |
| D2-06 | **Đạt** | UI gợi ý một trong hai sân đồng giá thấp nhất; đổi sang sân đắt, gửi form thật và tới checkout. Database xác nhận đơn thuộc sân cuối đã chọn, tổng/cọc **150.000đ**, giờ 10:00–11:00 ngày Việt Nam. Số điện thoại `+84` được chuẩn hóa. |
| D2-07 | **Đạt — RPC và logic chọn giờ** | Tạo/hủy đủ **12 tổ hợp**: 1/2/3 khung với khung 30/60/90/120 phút. Bốn khung bị từ chối `TOO_MANY_SLOTS` ở từng loại. Bài logic kiểm liên tục trên một sân, khe hở, không ghép sân và giới hạn 3 khung; UI có đổi thời lượng 60/120 phút. Chưa nghiệm thu toàn bộ tổ hợp ở mọi kích thước màn hình (D9). |
| D2-08 | **Đạt** | API nhận thêm `total_amount=1`, `deposit_amount=0` vẫn tính **301.000đ** cho 15:00–17:00 qua hai mức giá; payment cùng 301.000đ. Đơn một giờ có tổng/cọc đúng **100.500đ**, không làm tròn. |
| D2-09 | **Đạt** | Hai context gửi API gần đồng thời: **3 lượt cùng khoảng + 3 lượt chồng một phần**. Mỗi lượt đúng một **201**, một **409** và một pending chiếm lịch. Có kiểm constraint GiST trực tiếp trong catalog. Không phải bài đo tải lớn hoặc chứng minh mọi cách lập lịch request. |
| D2-10 | **Đạt** | Hai người đặt hai sân cùng giờ: cả hai 201. Hai người đặt cùng sân ở hai khoảng nối tiếp 10:00–11:00 và 11:00–12:00: cả hai 201. |
| D2-11 | **Đạt** | Tạo 2 pending rồi thứ 3 bị `TOO_MANY_PENDING`; hủy một đơn cho tạo lại. **3 lượt gửi 3 request đồng thời** vào các khoảng khác nhau, mỗi lượt đúng 2 × 201 và 1 × 400; database còn đúng hai pending còn hạn. |
| D2-12 | **Đạt — SQL/API** | Từ chối quá khứ, khoảng bằng nhau/ngược, sai biên, giờ khóa, trước/sau giờ mở. Transaction rollback đổi horizon riêng fixture thành **3 ngày**, kiểm slot trong hạn và start ngoài hạn 1 microsecond. SQL bổ sung kiểm ngay biên: không bị `TOO_FAR_AHEAD` nhưng có thể bị `SLOT_TAKEN` vì không khớp lưới; null/infinite trả `INVALID_RANGE`. Không coi start không khớp lưới là khoảng đặt hợp lệ. |
| D2-13 | **Đạt — nghiệp vụ và một đường UI** | Fixture được đặt hết hạn; lịch cho trống, B tạo đơn thay thế, đơn cũ bị hủy. SQL mô phỏng tiền muộn trả `BOOKING_CANCELLED`, ghi cần hoàn, không đổi đơn B. Transaction bổ sung kiểm hết hạn/replacement khi cron không nhìn thấy thay đổi chưa commit. UI tạo hold → về trang chủ → mở lại checkout, database vẫn pending. Không phải nghiệm thu webhook/ngân hàng thật. |
| D2-14 | **Đạt — SQL/RPC** | Pending hủy trả `none`; hủy lại bị `NOT_CANCELLABLE`. Trong cùng transaction, dựng confirmed thử ở **2 giờ + 1 microsecond / đúng 2 giờ / 2 giờ − 1 microsecond**, hủy lần lượt cho **needed / needed / none**. Các trạng thái paid được dựng chỉ ở fixture, không nhận tiền. Chính sách 2 giờ vẫn chưa chốt với chủ sân. |
| D2-15 | **Chưa chạy đủ — phần đã chạy đạt** | API từ chối phone sai, tên 101 ký tự, ghi chú 501 ký tự. B lấy giờ sau khi A vào form; A nhận lỗi thật, tên vẫn được giữ, có thể chọn lại giờ. Lỗi mạng giả lập hiện hướng kiểm tra đơn và không cho gửi ngay một đơn mới. Chưa thử double-click khi request đang chạy hoặc bấm khôi phục để chứng minh retry cùng intent chỉ có một đơn ở đợt này. |
| D2-16 | **Chưa chạy đủ — phần đã chạy đạt** | Tìm mã trong Đơn của tôi với filter all; pending đổi sang đã hủy khi RPC hủy mà không chủ động reload; checkout đơn hủy hiển thị “Đơn đã hủy”. Chưa kiểm bộ lọc confirmed/history và checkout confirmed/hết hold/completed sau giờ chơi, cùng hành động tương ứng. |

## Các kết quả quan trọng

Giá/cọc được giữ ở SQL và không lấy số tiền client. Đặt đồng thời không tạo hai hold chồng nhau; giới hạn hai pending chịu được ba request gần đồng thời. Các tổ hợp khung đều tuân thủ tối đa ba khung, kể cả tổng thời lượng khác nhau. Gợi ý không ghép lịch trống của hai sân; sân đổi cuối cùng là sân nhận đơn.

Mốc hoàn cọc 2 giờ được kiểm bằng đồng hồ transaction SQL, tránh sai số giữa hai request. Đây là kiểm tra thực thi quy tắc đang có; không chốt chính sách nghiệp vụ thay người dùng. Tiền đến muộn giả lập không khôi phục đơn cũ hoặc chiếm lịch của người mới.

**Không có lỗi sản phẩm mới được xác nhận ở những biến thể đã chạy.** Các lỗi/điểm chặn D0 và D1 vẫn cần kiểm lại riêng; kết quả D2 không đóng các lỗi đó hoặc chứng minh bản domain mới đã triển khai đúng.

## Dọn dữ liệu và giới hạn phiên bản

- Fixture chính đã dọn; truy vấn kiểm lại **0 Auth users, 0 profiles, 0 cụm, 0 sân con, 0 bookings, 0 kết nối** thuộc fixture. Dọn thêm khóa chống dùng lại giao dịch giả; kiểm **0 transfer claims, SePay events, payments, closures** của đợt. Không tạo file Storage hoặc gửi email/Google consent/chuyển tiền.
- Fixture SQL bổ sung nằm trong transaction rollback. Thay đổi horizon, status confirmed và timestamp không được giữ lại. Không thay chủ sân demo, cấu hình cờ, người nhận thật hoặc trạng thái đơn thật.
- Build, bài logic chọn giờ và bài contract API đều exit 0. Build gồm lint/type checking của Next. Trình duyệt không có page exception. Server và thư mục build tạm được dọn.
- Workspace đang có công việc khác sửa song song. **14 file** khác bản chụp sau chạy, gồm trang tìm sân, trang sân/lịch, bộ chọn giờ, helper liên kết/params và kiểu database; tên đầy đủ trong `results.json.source_drift`. Vì vậy không gán kết quả này cho toàn bộ workspace cuối cùng hoặc domain triển khai. Không tự commit các thay đổi sản phẩm đó.

## Bằng chứng và lỗi công cụ đã loại

Bằng chứng nằm local, không commit ảnh/log/script thử lên Git; liên kết `output` chỉ dùng trên máy giữ dữ liệu:

- [Kết quả chính, hash nguồn và drift](../output/d2-2026-10-09/results.json)
- [SQL kiểm biên horizon và hết hạn](../output/d2-2026-10-09/horizon-followup.json)
- [Kiểm cleanup sổ giao dịch](../output/d2-2026-10-09/cleanup-followup.json)
- [Ảnh tìm kiếm có bộ lọc](../output/d2-2026-10-09/search-filtered.png)
- [Ảnh checkout của đơn tạo thật bằng UI, người nhận giả](../output/d2-2026-10-09/real-checkout.png)
- [Build](../output/d2-2026-10-09/build.log), [logic chọn giờ](../output/d2-2026-10-09/time-options.log), [contract API](../output/d2-2026-10-09/booking-inputs.log)

Lượt chuẩn bị đầu chỉ sao chép file được Git theo dõi, thiếu hai component mới nên build không chạy; chưa tạo fixture. Lượt sau build đạt nhưng câu SQL của công cụ dùng alias `day` thiếu `AS`; fixture được dọn sạch, chưa tính case nghiệp vụ nào. Bản cuối sửa công cụ, chụp thêm nguồn chưa tracked và chạy đủ 16 nhóm biến thể. SQL bổ sung ban đầu thiếu payout/địa chỉ đủ dài cho fixture nên bị validation từ chối và rollback; sửa fixture rồi mới lấy kết quả. Không cộng các lỗi dựng môi trường này thành lỗi sản phẩm, không sửa kết quả thô để đổi FAIL thành PASS.

## Tiếp theo

Phần bổ sung đã ghi ở [biên bản mới](test-results-d2-followup-2026-10-09.md). Tiếp tục D3 về phân quyền; theo dõi thời gian tìm mã ở D9.
