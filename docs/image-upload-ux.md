# Trải nghiệm ảnh giải đấu và ảnh đại diện — 06/10/2026

## Cách đánh giá

Phân tích theo tác vụ, kiểm tra heuristic và chạy kịch bản trên Chromium riêng.
Đây là đánh giá của người thiết kế/triển khai, chưa phải nghiên cứu với người
dùng thực tế. Phạm vi: ảnh bìa khi tạo/sửa đề xuất giải; ảnh đại diện ở Tài khoản
và hồ sơ Kết nối; ảnh trên danh sách và chi tiết giải.

## Tài liệu đã tham khảo

- [Luma — Discover](https://luma.com/discover): quan sát bố cục công khai với
  nhóm nội dung có tiêu đề rõ, thẻ cùng kích thước, ảnh nhận diện tách khỏi nút
  hành động và khoảng cách nhất quán. Áp dụng cách phân cấp đó cho các phần
  form và thẻ giải, dùng hệ màu/viền của Sân Ngon.
- [GOV.UK — File upload](https://design-system.service.gov.uk/components/file-upload/):
  hỗ trợ chọn file và kéo-thả; vùng thả dễ nhận biết; lỗi cụ thể theo định dạng,
  dung lượng và tải thất bại; giữ file đã dùng trong cùng hành trình.
- [IBM Carbon — File uploader](https://carbondesignsystem.com/components/file-uploader/usage/):
  đặt giới hạn gần thao tác chọn file; tách trạng thái tải, thành công và đã tải;
  nút tải ảnh là hành động phụ khi trang đã có nút lưu chính; nút và hàng file
  có kích thước nhất quán. Bố cục gọn phù hợp form dài.
- [GitHub — Personalizing your profile](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/personalizing-your-profile):
  chọn ảnh → chỉnh khung → dùng ảnh; có thao tác bỏ ảnh và quay về ảnh mặc định.

Đã đọc các trang trên bằng trình duyệt headless với context riêng. Tham khảo
nguyên tắc tương tác; không sao chép thương hiệu hoặc dùng ảnh stock. Một URL
hướng dẫn Eventbrite trả 404 nên không dùng làm căn cứ thiết kế.

## Người dùng và việc họ cần hoàn thành

| Người dùng | Tình huống | Điều cần rõ |
| --- | --- | --- |
| Người chơi đề xuất giải | Có ảnh thi đấu hoặc poster làm sẵn | Chọn ảnh dễ, không mất chữ, gửi đề xuất vẫn cần admin duyệt |
| Chủ sân tổ chức | Tạo giải dài nhiều thông tin | Ảnh là tùy chọn, không làm lệch thứ tự nhập lịch/giá, xem trước đúng thẻ giải |
| Người chơi cập nhật hồ sơ | Chọn ảnh từ điện thoại | Nhìn được ảnh tròn trước khi lưu, không mất mặt, ảnh dùng chung hai trang |
| Người dùng gặp mạng chậm | Ảnh chưa tải xong hoặc tải thất bại | Có trạng thái chờ, giữ ảnh cũ/form, thử lại mà không chọn file lại |
| Người dùng bàn phím | Không kéo ảnh bằng chuột được | Nút có tên, thanh điều chỉnh có nhãn, Escape/hủy không gửi ảnh |

## Vấn đề của bản đầu và quyết định mới

| Vấn đề | Tác động | Thiết kế đã áp dụng |
| --- | --- | --- |
| Ảnh bìa chưa chọn chỉ có nút nhỏ | Khó nhận biết nơi thêm ảnh, không hình dung khung ngang | Vùng chọn/kéo-thả, hướng dẫn định dạng và dung lượng ngay bên cạnh |
| `object-cover` tự cắt ảnh dọc | Mất khuôn mặt hoặc nội dung poster | Chỉnh khung 16:9 cho bìa, 1:1 cho avatar; xem trước tròn cho avatar |
| Poster có chữ sát cạnh | Cắt 16:9 không luôn phù hợp | Chế độ “Giữ toàn bộ ảnh”, thêm nền pitch để giữ đủ poster |
| Tải ảnh bị hiểu là đã lưu giải | Người dùng rời form và tưởng đề xuất đã gửi | “Ảnh đã sẵn sàng. Gửi giải đấu để lưu…”; bỏ ảnh cũng nói cần gửi thay đổi |
| Chỉ có lỗi tải, phải chọn lại file | Lặp thao tác sau lỗi mạng | Giữ file đã chỉnh để “Thử tải lại ảnh”; ảnh đang dùng được giữ nguyên |
| Nút gửi vẫn dùng được khi ảnh chưa xong | Có thể gửi thiếu ảnh, báo lỗi khiến người dùng lo | Tạm khóa nút gửi và ghi “Đang chuẩn bị ảnh…” trong khi chỉnh/tải |
| Avatar và nút chen ngang nền đầu thẻ | Bố cục chật trên cột desktop 320px | Thẻ tài khoản dùng avatar giữa, hành động ở dưới; form Kết nối dùng hàng ngang tự xuống dòng |
| Bản xem trước giải chiếm nhiều chiều dài mobile | Tăng cuộn trước khi gửi | Desktop giữ cột xem trước; mobile thu vào “Xem trước thẻ giải đấu” |
| Thẻ giải có ảnh và không ảnh cao thấp khác nhau | Danh sách khó quét mắt | Cùng khung 16:9; giải chưa có ảnh dùng nét sân và biểu tượng cúp |
| Chi tiết bìa bị chặn chiều cao nhưng giữ toàn chiều ngang | Crop trên desktop khác bản xem trước | Khung 16:9 nhất quán, giới hạn chiều rộng thay cho chiều cao |

## Thiết kế và hành vi

- Giữ pitch `#0F3D2E`, nền phẳng, viền 1px, hai font hiện có. Không thêm màu
  lịch, đổ bóng hoặc thư viện hiệu ứng. Minh họa sân cho trạng thái thiếu ảnh
  là SVG từ code, không giả làm ảnh thật của giải.
- Nút hành động ít nhất 44px; nút tải ảnh là viền phụ, nút dùng/lưu là pitch;
  trạng thái thành công dùng token success. Không dùng vàng để trang trí.
- Trình chỉnh dùng dialog native: giữ focus, Escape/hủy, khóa cuộn nền;
  kéo bằng pointer/touch hoặc điều chỉnh bằng range có nhãn. Khung tròn chỉ
  là preview; file avatar xuất ra vẫn vuông, được UI hiện tròn.
- Ảnh chỉ upload sau “Dùng ảnh này”. Hủy chỉnh không tải file hoặc thay ảnh cũ.
  Ảnh được xử lý theo chính khung đã xem; bìa tối đa 1600px chiều ngang,
  avatar tối đa 640px, xuất WebP. Đầu vào vẫn JPG/PNG/WebP tối đa 5 MiB.
- Upload ảnh đại diện xong thì lưu ngay qua RPC hiện có. Ảnh bìa mới chỉ gắn
  vào giải khi gửi form thành công. SQL/RLS, bucket, quyền và quy tắc duyệt giải
  giữ nguyên. Đổi avatar không tự công khai hồ sơ cộng đồng.

## Kiểm tra lại

```sh
npm run ci
RUN_IMAGE_UPLOAD_E2E=1 PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
  UX_SCREENSHOT_DIR=output/image-ux-v2 \
  node scripts/check-image-uploads-browser.mjs http://localhost:3101
```

Kịch bản dùng tài khoản thử riêng và dọn dữ liệu trong `finally`. Cần bản
production local và Supabase liên kết. Bao gồm chỉnh/cancel/keyboard, kéo-thả,
file sai/quá dung lượng, ảnh hỏng, chờ upload, lưu/sửa/hiển thị ảnh, thay/xóa
avatar và kiểm tra tràn ở 320, 390, 768, 1024, 1440px. Ảnh chụp phục vụ kiểm
tra bố cục trong thư mục kết quả, không commit tài khoản hay ảnh thử.

Kết quả ngày 06/10/2026: lint, typecheck và production build đều đạt.
Kịch bản trình duyệt thật với Supabase đã đạt kiểm tra ảnh xuất (đúng tỷ lệ,
đúng phần cắt, giữ đầu/cuối poster dọc và nền pitch), kéo-thả một/nhiều file,
Escape/Tab/range/reset, hủy trước upload, mạng lỗi/thử lại cho cả hai loại ảnh,
giữ ảnh cũ/form, lưu/sửa/hiển thị, thay/xóa avatar và các chiều rộng nêu trên.
Đã xem ảnh chụp desktop, mobile và cửa sổ chỉnh ảnh để kiểm tra trực quan.
Chưa thử với người dùng thực tế hoặc trên thiết bị iOS/Android thật.
