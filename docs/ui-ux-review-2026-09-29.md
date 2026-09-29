# Rà soát UI/UX — 29/09/2026

Đã sửa trực tiếp các luồng Giải đấu và Kết nối, cùng điều hướng chung. Đây là phân tích theo nhiệm vụ và kiểm tra trình duyệt, chưa phải nghiên cứu người dùng hoặc số liệu chuyển đổi thực tế.

## Hành vi dự kiến và quyết định giao diện

| Người dùng / mục tiêu | Điểm gây vướng trước đây | Thay đổi |
| --- | --- | --- |
| Người chơi tìm giải | Ngày, môn, phí và hạn đăng ký chưa có thứ tự rõ; nút tổ chức nổi hơn việc tìm giải | Thẻ có nhãn môn/trạng thái, lịch, địa điểm, phí và hạn; nút khám phá đưa đến bộ lọc |
| Người đã đăng ký quay lại | Đăng ký cá nhân nằm cuối danh sách khám phá | Tab “Đã đăng ký”, phân trang, nhãn duyệt/cọc; bố cục gọn cho lượt quay lại |
| Người chờ duyệt / đóng cọc | Chưa rõ đã được giữ suất hay phải làm gì tiếp | Thông báo bước tiếp theo đầu trang, hạn đóng cọc, tách cọc và phần còn lại, nút sao chép tài khoản/mã chuyển khoản |
| Người đề xuất / chủ sân | Biểu mẫu dài liền mạch, có thể chọn sân sai môn | Chia thông tin, lịch/quy mô, phí/thể lệ; chỉ hiện sân hoạt động đúng môn đã chọn, đổi môn sẽ bỏ lựa chọn sân cũ |
| Người quản lý giải | Việc duyệt lẫn với đăng ký tham gia; nút hủy mang màu hành động chính | Tóm tắt chờ duyệt/chưa đủ cọc, liên kết đến danh sách, đưa đăng ký chờ duyệt lên trước, lọc trạng thái; hủy là nút viền đỏ có xác nhận |
| Người tổ chức cũng muốn chơi | Biểu mẫu tham gia có thể làm loãng màn hình quản lý | Giữ khả năng đăng ký cá nhân trong phần mở rộng riêng |
| Người tìm bạn chơi | Danh sách trống không giúp tiếp tục; hồ sơ chỉ là các dòng thông tin | Màn hình trống có hành động rõ; thẻ theo danh tính/môn/trình độ, trang hồ sơ có vùng liên hệ riêng |
| Người tạo hồ sơ | Không rõ ai xem được thông tin sau khi lưu | Trạng thái đã lưu, giải thích quyền công khai ngay cạnh checkbox, bản xem trước riêng tư; vẫn phải chủ động đồng ý công khai |
| Người dùng điện thoại / bàn phím | Nội dung hướng dẫn có thể đẩy bộ lọc quá xa | Hướng dẫn thu gọn bằng details/summary trên điện thoại; điều khiển tối thiểu 44px, focus hiển thị, lỗi biểu mẫu nhận focus |

## Thiết kế

Giữ xanh pitch, nền xanh nhạt, chữ Bricolage Grotesque và Be Vietnam Pro. Nhịp trang theo phần mở đầu → bộ lọc/tab → kết quả → hành động. Dùng viền phẳng và khoảng cách thay cho bóng; màu hổ phách dành cho trạng thái chờ. Không thêm thư viện, ảnh stock hay số liệu cộng đồng giả.

## Kiểm chứng

- Chromium headless với context cô lập; Giải đấu, Kết nối và Tìm sân ở 390, 768, 1024, 1440px: không tràn ngang; bộ lọc giữ kích thước thao tác.
- Kiểm tra bàn phím mở/đóng hướng dẫn, lọc/xóa bộ lọc, giữ đường quay lại sau đăng nhập.
- Tài khoản tạm: đề xuất → admin duyệt/bố trí sân → người chơi đăng ký → quản lý duyệt → webhook SePay giả lập → realtime xác nhận; gửi lại webhook không ghi nhận lặp.
- Sao chép mã chuyển khoản thực sự vào clipboard; hồ sơ công khai hiển thị cho khách, ẩn lại thì khách không đọc được.
- Xem ảnh chụp cả dữ liệu trống lẫn có dữ liệu, biểu mẫu trên điện thoại và chi tiết thanh toán trên desktop.
- Lint, typecheck, build và kiểm tra hồi quy hiện có trước khi bàn giao.

Kiểm tra webhook dùng ngân hàng giả và dữ liệu tạm đã dọn, không phải nghiệm thu chuyển tiền thật. Chưa đo khả năng hoàn thành nhiệm vụ với người dùng thật. Nên quan sát 3–5 người lần lượt tìm giải, theo dõi đăng ký và công khai/ẩn hồ sơ; ghi lại điểm họ dừng hoặc hỏi trước khi quyết định cải tiến tiếp.

## Chạy lại kiểm tra khám phá

Chạy app rồi dùng Playwright cài trong môi trường kiểm tra (không kết nối Chrome cá nhân):

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
CHROMIUM_EXECUTABLE=/path/to/chromium \
UX_SCREENSHOT_DIR=/tmp/san-ngon-ux \
node scripts/check-discovery-ux.mjs http://localhost:3100
```

Hai biến đường dẫn có thể bỏ nếu Node tìm được `playwright` và Playwright đã có Chromium. Script chỉ đọc các trang công khai, không tạo người dùng, gửi mail hay chuyển tiền.
