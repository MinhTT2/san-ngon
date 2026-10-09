# Kiểm tra giao diện và tự cập nhật dữ liệu

## Chạy kiểm tra

Node.js 24 và `npm ci`, sau đó:

```sh
npx playwright install --with-deps chromium
npm run check:refresh
npm run check:ui
```

`check:ui` tạo thư mục tạm, sao chép mã nguồn đang được Git theo dõi, dựng
bản production và mở Chromium headless riêng. Không sao chép `.env` hay
dùng phiên trình duyệt cá nhân. Supabase được thay bằng dữ liệu kiểm thử
trên localhost; request ghi ở các bài kiểm tra quản trị bị chặn.

Kiểm tra trang chủ, tìm sân, giải đấu, kết nối, xác thực, hỗ trợ và khu
admin/chủ sân ở nhiều cỡ màn hình. Ảnh lưu ở `output/automated-ui/`;
thư mục tạm và server kiểm thử được dọn khi chạy xong. Có thể đặt
`CHROMIUM_EXECUTABLE` nếu máy đã có Chromium riêng.
Có thể chạy riêng phần thông báo/tài khoản bằng
`npm run check:ui -- --only=check-personal-ui`; vẫn dựng bản production cô lập.
Có thể chọn nhiều nhóm bằng dấu phẩy trong `--only`, ví dụ
`--only=check-personal-ui,check-calendar-ux,check-dashboard-ui`.

Animation dùng `motion/mini` (Motion), kết hợp observer cho nội dung khi cuộn
và CSS cho trạng thái hover/lịch. Nội dung HTML luôn đọc được trước khi JS
chạy; hiệu ứng trả lại style ban đầu khi xong, khi đóng component và khi
người dùng bật giảm chuyển động. Không dùng animation để thay/remount form.
Bài kiểm tra tương tác kiểm tra vùng chọn, bố cục thẻ sân ít kết quả,
phóng to ảnh, focus hộp thoại và đổi tùy chọn giảm chuyển động ngay lúc mở.

Bài kiểm tra đặt sân còn kiểm tra thẻ giải có dữ liệu, chế độ danh sách,
ngày trên đơn chủ sân và form xem lại trước khi giữ chỗ. Mở hộp thoại hủy
không gửi request; đóng hộp thoại trả focus về nút ban đầu. Các trường hợp
hủy lỗi và xác nhận cọc mất mạng được mô phỏng để kiểm tra thông báo/thử lại.
Mọi request thay đổi đơn trong bài kiểm tra đều bị chặn và trả kết quả giả.

Trang thông báo và tài khoản có dữ liệu kiểm thử riêng: phân nhóm theo ngày,
lọc chưa đọc, lỗi đánh dấu đã đọc, chống bấm lặp và thao tác bàn phím trên
popover. Form đánh dấu đã đọc vẫn gửi theo cách thông thường khi tắt JS.
Form tài khoản được kiểm tra khi bỏ thay đổi, chuẩn hóa số điện thoại,
lưu lỗi/mất mạng và lưu thành công; request cập nhật hồ sơ đều bị chặn.
Phiên đọc thông báo hết hạn có hướng dẫn đăng nhập và giữ đường về hiện tại.

Lịch chủ sân được kiểm tra riêng bằng `--only=check-calendar-ux`: phân biệt
đang tải, ngày trống và lỗi; đổi ngày nhanh với phản hồi đến trễ; tải lại mất
mạng; xem khách từ khung đặt; giữ nội dung hộp thoại khi khóa lịch lỗi và
thử lại khóa/mở lịch. Request thay đổi lịch đều bị chặn, không ghi database.
Menu tài khoản được kiểm tra mũi tên, Home/End, Escape và Tab. Các liên kết
admin “Cần xử lý” được kiểm tra bộ lọc hồ sơ và đơn chờ cọc.

Trên GitHub Actions, mỗi lần push `main` hoặc mở/cập nhật PR tự chạy
lint, typecheck, build, kiểm tra hàng đợi refresh và kiểm tra trình duyệt.
Ảnh desktop/mobile được lưu trong artifact `ui-desktop-mobile` 14 ngày,
kể cả khi bài kiểm tra lỗi. Tự triển khai vẫn dùng kết nối Git của Vercel;
không tự thay đổi thiết lập deploy hay database từ bài kiểm tra UI.

## Tự cập nhật trên website

- Tìm sân tải lại kết quả công khai mỗi 15 giây khi trang đang mở.
- Admin và chủ sân nhận thay đổi qua realtime bằng phiên người dùng;
  tải lại mỗi 30 giây để phục hồi nếu realtime không hoạt động.
- Quay lại tab hoặc nối mạng sẽ đồng bộ lại. Nhiều sự kiện cùng lúc được
  gộp thành một lần cập nhật.
- Đang nhập form, có thay đổi chưa gửi hoặc đang mở hộp thoại thì hoãn
  cập nhật. Khi gửi/reset form hoặc đóng form, dữ liệu tiếp tục đồng bộ.

Luồng checkout giữ đăng ký realtime trên đúng đơn; không thêm polling
thanh toán. RLS và các hàm SQL hiện có quyết định quyền đọc/ghi, giá, giữ
chỗ và trạng thái thanh toán. Duyệt hồ sơ, hoàn tiền và quyết toán vẫn cần
người phụ trách xử lý theo quy trình vận hành.
