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

Checkout có nhóm `--only=check-checkout-ux`: tóm tắt sân/giờ trên mobile,
tải lại QR lỗi và giữ đúng người nhận/số tiền/mã đơn, mất mạng và nối lại,
lỗi đọc trạng thái, cập nhật realtime đến trước phản hồi đọc cũ, cùng các
trạng thái đã xác nhận/đã chơi/hủy/hết hạn/chưa có tài khoản nhận cọc.
WebSocket, QR và dữ liệu đơn đều được giả lập trên trình duyệt cô lập;
không tải QR thật, gửi tiền hoặc ghi database. Bài kiểm tra chờ qua 15 giây
để xác nhận checkout không polling trạng thái thanh toán.

Form chủ sân có nhóm `--only=check-owner-forms`: cảnh báo chưa lưu khi
đổi mức giá, rời trang, hủy chỉnh sửa và đóng hộp thoại tạo/sửa cụm sân;
giữ dữ liệu sau lỗi lưu; tải từng ảnh bị gián đoạn và thử lại với bản nháp
cũ; chỉ công khai bộ ảnh khi lưu đủ và dùng lại ảnh đã tải thành công.
Kết nối SePay có các trạng thái chưa cấp quyền/đã cấp quyền/cần kết nối
lại/sẵn sàng; kết nối sẵn sàng vẫn phân biệt với quyền mở nhận đơn.
Request tạo cụm, lưu giá, tải ảnh và kết nối đều trả dữ liệu giả trên localhost.
Cảnh báo rời trang dùng `beforeunload`; liên kết trong website và các nút
đóng form có xác nhận bỏ thay đổi. Trình duyệt hỗ trợ Navigation API còn
chặn được Back/Forward trong cùng tài liệu. Không tự lưu dữ liệu ngân hàng
hay form vào bộ nhớ trình duyệt.

Tìm sân và lưu sân có nhóm `--only=check-player-discovery`: tìm kiếm đang
tải, ngăn gửi lặp, đưa focus về kết quả, giữ bộ lọc/phân trang/môn chơi
khi mở sân và đổi ngày, nới từng bộ lọc khi không có kết quả. Form tìm sân
vẫn gửi GET khi tắt JavaScript. Nút lưu sân dùng trạng thái đã xác nhận từ
API; lỗi/trạng thái chưa đọc nằm dưới nội dung thẻ, có thử lại và đăng nhập
về đúng trang khi phiên hết hạn. Sân yêu thích có dữ liệu thiếu ảnh và sân
chưa công khai; bỏ lưu trả focus về tiêu đề danh sách. Đổi giờ ở bước thông
tin giữ tên, điện thoại và ghi chú trong bộ nhớ của lần mở trang hiện tại.
Dữ liệu gồm một danh mục giả có nhiều trang và sân nhiều môn; mọi request
lưu sân/tạo đơn được chặn và trả dữ liệu giả, không dùng database thật.

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
