# Tiến độ rà soát UI/UX — 09/10/2026

Danh sách gốc có 29 mục: 7 P1, 19 P2, 3 P3 có điều kiện. Người dùng yêu cầu thực hiện toàn bộ phần có thể triển khai và giao agent tự quyết chính sách hoàn cọc sân thường.

## Danh sách và kết quả

| # | Mục | Kết quả |
|---|---|---|
| 1 | Lỗi nằm trong hộp thoại đang thao tác | Đã sửa; giữ form và tập trung lỗi. Commit a668c1c. |
| 2 | Bật/tắt sân con dễ hiểu | Đã sửa. Commit 1707727. |
| 3 | Xác nhận nhận tiền / đánh dấu hoàn cọc | Đã có bước kiểm tra mã, khách, sân và tiền. Commit 7fca567. |
| 4 | Kết quả tạo đơn chưa rõ khi mạng lỗi | Đã sửa UI; RPC idempotency và tìm lại đơn được bổ sung ở 31bd103. |
| 5 | Chuẩn hóa số điện thoại | Đã sửa khoảng trắng và +84. Commit 85dc033. |
| 6 | Giữ đường quay lại khi đăng ký / khôi phục tài khoản | Đã sửa. Commit d321539. |
| 7 | Chốt trách nhiệm và hạn hoàn cọc | Giữ mốc 2 giờ; chủ sân hoàn thủ công trong 3 ngày làm việc sau khi đủ thông tin đối soát. Chính sách hiển thị công khai; không đổi SQL hoặc áp ngược đơn cũ. |
| 8 | Cọc 100% đã đủ tiền sân | Đã làm rõ checkout, form và đơn của tôi; giữ số dư đơn cũ. Commit aef6567. |
| 9 | Tìm sân trước carousel | Form tìm sân đứng trước carousel, có main landmark. |
| 10 | Lưu/chia sẻ/báo lỗi gần tên sân; Xem lịch dẫn đúng chỗ | Thanh thao tác gần tên; ảnh và nút Xem lịch mở #lich-san. |
| 11 | Tìm theo giờ và thời lượng | RPC SQL kiểm tra đúng giờ, cùng sân trống liên tục, tối đa 3 khung; mang lựa chọn sang trang sân. |
| 12 | Tóm tắt đặt sân gọn trên điện thoại | Thanh dưới hiển thị giờ, thời lượng, tiền và nút tiếp tục; giữ phần đổi sân đầy đủ. |
| 13 | Ngày dễ đọc, thống nhất múi giờ | Có nhãn thứ/ngày trên tìm sân và lịch; ngày vận hành 7 ngày do SQL cung cấp; ngày trong kỳ thống kê hiển thị dd/mm/yyyy; các trang khác tiếp tục dùng format chung. |
| 14 | Hướng dẫn/lọc giải gọn trên điện thoại | Video nằm trong mục mở rộng, bộ lọc tự mở khi có lọc đang áp dụng. |
| 15 | Lưu/chia sẻ QR trên cùng thiết bị | Có tải ảnh, chia sẻ khi thiết bị hỗ trợ, hướng dẫn khi thất bại. |
| 16 | Phí website và lỗi QR | Giữ giải thích gia hạn; có tải lại QR, sao chép tài khoản/số tiền/mã, chống gửi lặp khi lấy kỳ phí. |
| 17 | Tìm/phân trang đơn chủ sân | Đã bổ sung ở 5e71c34: mã/tên/điện thoại, khoảng ngày và phân trang SQL. |
| 18 | Cần hoàn/đã hoàn qua toàn lịch sử | Trang /chu-san/hoan-coc, tìm mã/tên/điện thoại, phân trang SQL, xác nhận hai bước. |
| 19 | Việc vận hành trước doanh thu | Đưa hoàn cọc, đơn chờ và đơn hôm nay lên trước lịch tuần/thống kê. |
| 20 | Xem giá thực tế theo ngày | Chủ sân gọi RPC SQL để xem mức giá đã lưu, nhãn/ưu tiên theo từng khung; bản xem trước báo cần tải lại sau khi sửa giá. |
| 21 | Chọn sân vận hành khi có nhiều sân | Tìm không dấu, lọc cụm/môn, sắp theo cụm/môn/tên, 12 sân mỗi trang; giữ nhận diện sân đang xem. |
| 22 | Checklist sẵn sàng nhận đặt | Hồ sơ, ảnh, sân con, nhận tiền, phí và quyền nhận đơn; lấy trạng thái thực tế và giữ trạng thái lỗi đọc. |
| 23 | Cảnh báo form giải/kết nối chưa lưu | Chặn rời trang khi tải ảnh/gửi; cảnh báo bản sửa chưa lưu; realtime không ghi đè form đang chỉnh. |
| 24 | Xem trước quyền công khai | Phản ánh ngay hồ sơ ẩn/công khai và từng công tắc kênh liên hệ. |
| 25 | Hỗ trợ giao dịch kèm chứng từ riêng tư | Form gắn đơn thuộc người gửi, upload JPEG/PNG/WebP ≤5 MiB, bucket riêng tư, chỉ người gửi/admin đọc; gửi lại cùng mã yêu cầu không tạo trùng. Không xác nhận tiền hoặc phục hồi giữ chỗ. |
| 26 | Chữ quan trọng và điều khiển chuyển động | Nhãn giá/lịch/thông tin chuyển khoản tăng tối thiểu 12px; carousel và video nền có dừng/tiếp tục; giữ hỗ trợ reduced motion. |
| 27 | Xuất CSV đối soát | Xuất theo cụm thuộc chủ sân và khoảng ngày chơi do SQL lọc; ≤366 ngày/10.000 đơn, chống công thức CSV. Đây là tiền trên đơn, cần đối chiếu sao kê cho khoản thừa/thiếu/nhầm. |
| 28 | Đặt sân cố định hằng tuần | Chưa phát hành. Bản đặc tả bên dưới bảo toàn giới hạn một sân/đơn và tối đa hai đơn chờ. Cần xác thực nhu cầu và quy tắc trả tiền cả chuỗi trước khi có đơn chuỗi. |
| 29 | Quan sát 3–5 người thật | Đã chuẩn bị kịch bản phía dưới. Chưa có kết quả quan sát thực tế, không thay bằng dữ liệu giả. |

## Đặt hằng tuần: đặc tả để phát triển khi nhu cầu đã xác nhận

Phương án phù hợp MVP: một mẫu nhắc lịch cho người chơi, mỗi lần xác nhận vẫn tạo đúng một đơn và thanh toán 100% riêng, giữ chỗ 15 phút. SQL tính ngày tuần tiếp theo theo múi giờ Việt Nam và kiểm tra GiST từng đơn. Mẫu không tự khóa sân, không tự tạo nợ hoặc thanh toán nhiều buổi bằng một mã.

Nếu cần giữ cả chuỗi, phải định nghĩa riêng: số tuần tối đa, thời hạn thanh toán cả chuỗi, xử lý một buổi bị chiếm, hủy từng buổi/cả chuỗi, thay đổi giá và hoàn tiền. Hiện giới hạn hai đơn pending không cho tạo trước một chuỗi dài; không bỏ giới hạn này chỉ để có nút đặt định kỳ.

## Kịch bản quan sát người dùng thật

Mời 3–5 người: ít nhất hai người đặt sân, một chủ sân; có người dùng điện thoại và máy tính. Cho họ thao tác độc lập với tài khoản/dữ liệu demo. Người quan sát không hướng dẫn thao tác trước khi ghi nhận điểm mắc.

1. Tìm sân cầu lông trong nhà, chọn ngày/giờ và chơi 120 phút.
2. Mở lịch, đổi sân con nếu cần, xác nhận thông tin, xem QR và tổng tiền.
3. Quay lại đơn đang giữ, phân biệt đã thanh toán đủ/hết hạn/chờ hoàn.
4. Hủy đúng quy trình, tìm trách nhiệm/hạn hoàn, gửi yêu cầu đối soát có ảnh đã che dữ liệu nhạy cảm.
5. Công khai hồ sơ kết nối, chỉ bật điện thoại; mô tả người khác sẽ thấy gì.
6. Chủ sân tìm đơn cũ, xem Cần hoàn/Đã hoàn, kiểm tra giá một ngày, tìm sân khi có nhiều sân và tải CSV.

Ghi mỗi nhiệm vụ: hoàn thành độc lập/nhờ trợ giúp/thất bại; thời gian; lần bấm nhầm; câu nói nguyên văn; mức tự tin 1–5. Đánh dấu lỗi cản hoàn thành trước, sau đó lỗi hiểu sai tiền/quyền riêng tư, rồi vấn đề thẩm mỹ. Không thu mật khẩu/OTP hoặc lưu ảnh ngân hàng thật vào báo cáo. Sau 3–5 phiên, chọn ba điểm lặp lại nhiều nhất để sửa và thử lại.

## Kiểm chứng

- Lint và typecheck: đạt; cảnh báo trong thư mục output của tác vụ khác không thuộc thay đổi.
- scripts/check-remaining-ux.sql: dữ liệu giả trong transaction rollback; giờ chính xác, liên tục, giới hạn 3 khung, khóa giữa buổi, ưu tiên giá, lịch tuần SQL, lịch sử hoàn, quyền RPC, chứng từ riêng tư/idempotency và phạm vi CSV và tên sân đã đóng băng trên đơn.
- scripts/check-remaining-ux.mjs: Chromium headless, context riêng, session giả; kiểm tra desktop/mobile, QR lỗi/tải lại/lưu, dữ liệu form khi lỗi mạng, quyền công khai và cảnh báo chưa lưu.
- Năm migration của đợt này (03, 05, 06, 07, 08) đã áp dụng riêng; kiểm tra rollback đạt cả trước và sau triển khai. Không đưa migration của tác vụ khác vào đợt triển khai này.
- Production build cô lập: đạt. 21 nhóm kiểm tra giao diện đã đạt qua lượt hồi quy đầy đủ và lượt kiểm tra lại các ca được cập nhật; có thêm kiểm tra chi tiết đơn đóng băng từ tác vụ liên quan. Những giả định kiểm tra cũ về video không có nút dừng đã được cập nhật theo thiết kế mới.
- Kiểm tra 320/390/768/1024/1440px và rà ảnh desktop/mobile; form lỗi mạng giữ nội dung, QR lỗi/tải lại/lưu, công tắc riêng tư, cảnh báo chưa lưu, lịch sử hoàn, giá và CSV đã đạt.
- Mọi thao tác ghi trong trình duyệt được chặn bằng dữ liệu giả, không chuyển tiền hoặc gửi email thật. SePay QR trả CORS cho phép tải ảnh; đã kiểm tra phản hồi header. Thử nghiệm hoàn tiền/ngân hàng thật và quan sát người dùng thật vẫn là các nghiệm thu vận hành riêng.
- Tổng kết phạm vi: 27/29 mục đã triển khai. Mục 28 có đặc tả để chốt nhu cầu/quy tắc chuỗi; mục 29 có kịch bản và biểu mẫu ghi nhận, chưa có người tham gia thực tế.
