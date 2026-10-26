# Mua và duyệt tài khoản VIP

Chốt ngày 25/10/2026: 49.000đ cho một tháng, giảm 10% tiền đặt sân mới.
VIP trả đủ số tiền sau giảm khi đặt sân; không phải trả thêm phần 10% tại sân.
Không giảm phí giải đấu hoặc phí website của chủ sân.

## Người chơi

Mở **Mua tài khoản VIP** trong menu tài khoản hoặc `/vip`, tạo yêu cầu để
nhận QR riêng. QR dùng MBBank, số 0691920022005, tên NGUYEN DANG NGUYEN.
Chuyển đúng 49.000đ và nội dung `VIP` + 12 ký tự hex rồi bấm đã chuyển khoản.
Một người chỉ có một yêu cầu chưa hoàn tất; tải lại/bấm lại không tạo yêu cầu mới.

Chỉ admin được xác nhận thanh toán. Mốc 30 phút tính từ lúc gửi duyệt là thời
gian xử lý, không phải thời điểm tự kích hoạt. Nếu quá hạn, liên hệ hỗ trợ;
không chuyển thêm tiền. Nếu chưa được duyệt nhưng đã chuyển tiền, liên hệ
đối soát trước khi mua lại. Không tự hoàn tiền.

## Admin

Vào `/admin/vip`, kiểm tra giao dịch tiền vào trong SePay: đúng người nhận
trên yêu cầu, đúng mã VIP và đủ 49.000đ trong một giao dịch. Nhập **ID giao
dịch SePay** (số ID, không phải mã yêu cầu VIP hoặc mã tham chiếu ngân hàng)
và đánh dấu đã đối soát trước khi duyệt. Giao dịch đã dùng ở luồng khác hoặc
yêu cầu VIP khác không được dùng lại. Duyệt lại cùng yêu cầu không cộng tháng lặp.

Yêu cầu chưa xác minh được phải ghi lý do để người chơi biết cách bổ sung.
Kết quả duyệt gửi vào thông báo website. Nhật ký lưu người duyệt và kỳ VIP.
Tab **Đã mua VIP** tại `/admin/vip` liệt kê riêng các lượt mua/gia hạn đã duyệt,
kèm tên, số điện thoại, số tiền, ngày xử lý và kỳ VIP (có năm). Bao gồm cả
các kỳ đã hết hạn; mỗi lượt mua/gia hạn là một dòng, phân trang 20 dòng.
Admin có thể tắt ưu đãi tại `/admin/users`; việc tắt không thay đổi giá đơn cũ
và không tự hoàn tiền mua VIP.

## Quy tắc dữ liệu

SQL tính tháng lịch trong `Asia/Ho_Chi_Minh` từ lúc duyệt. Gia hạn khi còn hiệu
lực cộng tiếp vào hạn cũ; hết hạn thì tính từ lúc duyệt mới. SQL kiểm tra hạn
ở mỗi lần tạo đơn, không phụ thuộc cron. Giảm giá làm tròn xuống tới đồng;
cọc bằng đúng số tiền sau giảm, không làm tròn lên hàng nghìn.

`user_vip_memberships`, `vip_purchases` và `vip_receiver` tách khỏi trường hồ
sơ tự sửa. Browser không có quyền ghi các bảng này. Mọi thay đổi qua RPC kiểm
tra quyền, số tiền và người nhận đóng băng trong yêu cầu. Giá gốc, khoản giảm,
tổng tiền và cọc đóng băng trong đơn. QR đặt sân dùng số tiền sau giảm.
Thanh toán VIP được đối soát thủ công; không tự kích hoạt từ webhook SePay.

Mục tiêu 200 người dùng thật không phải điều kiện cấp VIP. Không seed tài
khoản production để đạt mục tiêu này. Kiểm tra SQL trong
`scripts/check-vip-booking.sql` luôn rollback; kiểm tra trình duyệt dùng
fixture localhost và Chromium headless riêng.
