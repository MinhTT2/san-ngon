# Cải thiện giao diện và chất lượng — 12/10/2026

Phạm vi là 20 hạng mục người dùng đã chấp thuận. Giữ giá/quyền/lịch/thanh toán trong SQL, checkout realtime và phong cách nền phẳng của Sân Ngon. Thay đổi local có trước task được giữ ngoài các commit bàn giao.

## Mốc 1 — ảnh, trang chủ và chữ

- Carousel ưu tiên ảnh của cụm sân đang active, có sân con active đúng môn; dẫn đến lịch của địa điểm và ghi rõ tên cụm. Ảnh ở cấp cụm, không gán thành ảnh một sân con. Bản bàn giao cuối dùng minh họa SVG gốc khi thiếu ảnh, ghi rõ minh họa; không thêm ảnh stock.
- Thẻ sân, gallery và thumbnail dùng kích thước ảnh phù hợp qua bộ tối ưu hiện có. Ảnh gốc vẫn dùng khi mở trình xem/phóng to. Ảnh preview lỗi có hướng dẫn mở ảnh gốc.
- Allowlist tối ưu chỉ bucket venue-photos công khai của project đã cấu hình, không nhận giấy tờ hoặc URL có token.
- Hai font hiện tại được phục vụ từ website, có bộ dấu tiếng Việt/Latin và giấy phép SIL OFL. Không gọi Google Fonts khi xem trang hoặc build.
- Footer mobile chia liên kết hỗ trợ thành hai cột, vùng bấm 44px; desktop giữ bố cục gọn.
- Đạt: lint/typecheck, build production cô lập; trang chủ 320/390/768/1024/1440px và no-JS; tối ưu ảnh thật, chặn bucket riêng/URL ký; chọn môn, gallery zoom/focus và giảm chuyển động. Bài trang chủ phát hiện footer quá cao, đã sửa bố cục và chạy lại đạt.

## Mốc 2 — lịch, biểu mẫu và trạng thái tải

- Chú giải lịch có chữ và ký hiệu cho còn sân/đang chọn/không thể đặt/giờ vàng; giữ token hiện tại. Thanh chọn nhanh trên mobile có cả tên sân con.
- Lỗi số điện thoại nằm cạnh ô nhập, liên kết với screen reader và trả focus; thông tin khác giữ nguyên. Không gửi API nếu số không hợp lệ. Khi đang gửi hoặc chưa rõ kết quả, giữ nguyên nội dung đã gửi để khôi phục đúng lần đặt.
- Skeleton có cấu trúc tương ứng với trang sân, lịch và dashboard; chỉ thông báo tải, không dựng dữ liệu/nút tương tác giả. Chế độ giảm chuyển động không nhấp nháy.
- Tiêu đề ngắt dòng cân đối, văn bản dài xuống dòng; ô nhập mobile tối thiểu 16px, vẫn tôn trọng chữ lớn theo cấu hình người dùng.
- Tìm sân giữ kết quả cũ khi đang tải bộ lọc mới; keyed fieldset áp dụng mặc định URL, bỏ reset sau hydration để tránh xóa thao tác mới nhập.
- Đạt: production build lint/typecheck; lựa chọn lịch/gallery/motion; lỗi liên hệ và khôi phục UUID đơn; tìm sân/lưu sân/giữ bộ lọc/no-JS; checkout 320–1440px, realtime/read race, QR lỗi, mất mạng và không polling. Mọi ghi/QR được giả lập.
- Bài tìm sân phát hiện loading boundary mới ở /tim-san làm yêu cầu RSC bị hủy khi chuyển bộ lọc có phản hồi chậm. Bỏ boundary đó và chạy lại toàn bộ check-player-discovery trên cùng production build cô lập: đạt. Skeleton không được dùng để đánh đổi khả năng tìm kiếm.

## Mốc 3 — dashboard, chia sẻ và khả năng đọc

- Tổng quan chủ sân có ba đường vào công việc: đơn đã xác nhận hôm nay, đơn chờ cọc còn hạn trong 7 ngày và khoản cần hoàn của cụm đang chọn. Khi đọc lỗi, hiển thị dấu chưa rõ thay vì số 0 và vẫn có đường mở danh sách.
- MetadataBase lấy domain cấu hình. Trang chủ/tìm sân/giải/kết nối có canonical, mô tả, Open Graph và Twitter tiếng Việt; chi tiết sân/giải ưu tiên ảnh thật, thiếu ảnh dùng ảnh thương hiệu 1200×630. Trang giải cá nhân không index.
- Sitemap đọc anonymous, phân trang, chỉ lấy sân active và giải published/completed; không thêm hồ sơ cá nhân hoặc bản nháp. Không thêm giá/chỗ trống dựng vào SEO.
- Ảnh thương hiệu dùng logo/font/màu hiện tại, tạo offline; font giữ giấy phép đi kèm.
- Rà lại chỉ dẫn không dùng stock: carousel thiếu ảnh dùng các minh họa SVG gốc đã có, ảnh sân lỗi cũng có nhãn minh họa rõ ràng. Nền khối chủ sân dùng video đồ họa sân gốc. Media stock lịch sử không được thêm vào chỗ ảnh sân.
- Chữ lớn 200%: hero/nút xuống dòng trong vùng hiển thị, bộ lọc ngày/giờ và ô lịch tự tăng bề rộng, thanh chọn nhanh và tóm tắt tiền có thể xuống hàng. Không chỉ kiểm tra scrollWidth vì overflow hidden có thể che chữ.
- Các cặp màu chữ/nền trong token hiện tại đạt tối thiểu 4,5:1 (đo tính toán WCAG); không phải chứng nhận toàn website hoặc kiểm tra screen reader thật.
- Đạt: production build, lint/typecheck, dashboard và lỗi đọc dữ liệu; canonical/ảnh chia sẻ/sitemap; bố cục 320–1440px, chữ lớn 200%, no-JS và giảm chuyển động. Header được kiểm tra cả vị trí logo/nút đăng nhập để phát hiện chồng nội dung.

## Mốc 4 — đối chiếu đủ 20 hạng mục và bàn giao

Đã hoàn tất các mốc code và đối chiếu đủ 20 hạng mục. Bảng dưới đây phân biệt cải thiện mới, tính năng đã có được kiểm tra hồi quy và phần nghiệm thu thực tế còn lại.

| # | Hạng mục | Kết quả trong đợt này |
| --- | --- | --- |
| 1 | Ảnh sân thật | Trang chủ ưu tiên ảnh từ cụm active có sân con active đúng môn; thẻ/gallery dùng ảnh chủ sân. Chụp bổ sung ảnh đẹp khoảng 18h vẫn là việc tại địa điểm. |
| 2 | Hero | Có tên/khu vực/đường vào lịch sân thật; thiếu ảnh dùng minh họa gốc, nhãn rõ; hỗ trợ chữ lớn và điều khiển bằng bàn phím. |
| 3 | Thẻ sân | Tối ưu kích thước ảnh; giữ bố cục đồng nhất, giá theo giờ, khung trống, fallback ảnh và thao tác lưu sân đã có. |
| 4 | Typography | Hai font hiện tại phục vụ cùng website, đầy đủ dấu; tiêu đề cân đối và ô nhập mobile dễ đọc. |
| 5 | Khoảng trắng | Footer gọn hơn; các vùng nhập/lịch tự đổi số cột khi không đủ chỗ, không ép chữ nhỏ để giữ bố cục. |
| 6 | Gallery | Giữ phóng to/kéo/chuyển ảnh/focus có sẵn; thêm preview phù hợp kích thước và hướng mở ảnh gốc nếu preview lỗi. |
| 7 | Lịch trực quan | Có đủ chú giải chữ/ký hiệu; ô lịch tăng bề rộng theo chữ; giá và lịch vẫn do SQL quyết định. |
| 8 | Tóm tắt đặt sân | Thanh mobile có tên sân con; thông tin và tiền xuống dòng khi chữ lớn; giữ bước xem lại và dữ liệu khi chọn lại giờ. |
| 9 | Checkout chuyển khoản | Đã có QR, sao chép và snapshot người nhận; kiểm tra hồi quy thay vì viết lại luồng đang chạy. |
| 10 | Phản hồi thanh toán | Giữ realtime, hạn giữ chỗ và trạng thái đã nhận/hết hạn; kiểm tra mất mạng, nối lại và phản hồi đến lệch thứ tự. |
| 11 | Nút/biểu mẫu | Giữ bộ điều khiển chung; lỗi liên hệ gắn đúng trường/focus, ngăn thay nội dung khi lần gửi chưa rõ kết quả. |
| 12 | Trạng thái tải | Skeleton cho trang sân, lịch và tổng quan; tìm sân giữ kết quả cũ trong lúc tìm mới để không mất ngữ cảnh hoặc gián đoạn chuyển bộ lọc. |
| 13 | Trống/lỗi | Giữ các đường thử lại/mở rộng bộ lọc; tổng quan đọc lỗi ghi chưa rõ số lượng thay vì báo 0. |
| 14 | Điện thoại | Kiểm tra 320–1440px; bộ lọc/ô lịch/thanh chọn nhanh thích nghi; bổ sung kiểm tra chữ lớn 200% ở hành trình tìm và đặt. |
| 15 | Dashboard | Ba ô dẫn tới đơn hôm nay, chờ cọc còn hạn trong 7 ngày và cần hoàn của cụm đang chọn. |
| 16 | Chuyển động | Giữ các hiệu ứng có sẵn và chế độ giảm chuyển động; dùng đồ họa sân gốc ở khối chủ sân, không thêm thư viện. |
| 17 | Tốc độ tải | Ảnh thẻ/gallery/thumbnail được giảm kích thước; font cùng website; ảnh chia sẻ là PNG tĩnh 67 KB. Chưa đo tốc độ trên thiết bị/mạng thật. |
| 18 | Tiếp cận | Focus, nhãn lỗi, chú giải không chỉ dùng màu; đo tương phản token và kiểm tra chữ lớn. Screen reader/Safari thật vẫn cần nghiệm thu. |
| 19 | SEO/chia sẻ | Canonical, mô tả, Open Graph/Twitter, ảnh thương hiệu và ảnh địa điểm; sitemap thêm giải công khai và giữ loại trừ dữ liệu riêng/bản nháp. |
| 20 | Luồng vận hành | Kiểm tra hồi quy bằng dữ liệu giả và request ghi được chặn; chuyển khoản/hoàn tiền thật cần chủ sân và người vận hành thực hiện. |

## Giới hạn bàn giao

- Không chụp hoặc dựng ảnh để giả làm địa điểm đã onboard. Cơ chế ưu tiên ảnh thật đã có; chất lượng từng bộ ảnh cần người vận hành kiểm tra tại sân.
- Kiểm tra tiền dùng QR giả và dữ liệu cô lập, không chuyển tiền, gửi thông báo thật hoặc đổi trạng thái database thật. Nghiệm thu chuyển khoản, hủy và hoàn thực tế vẫn nằm trong checklist MVP.
- Không tự bật multi_owner_enabled, sửa SQL/RLS/giá/SePay hoặc gộp thay đổi local của công việc khác.
- Chưa có phép đo trên mạng di động, Safari/app ngân hàng hoặc screen reader thật. Không đánh dấu toàn bộ nghiệm thu website hoàn tất từ kết quả Chromium.

## Kết quả kiểm tra cuối

- Lint và typecheck đạt. Lint toàn workspace không có lỗi, còn cảnh báo biến không dùng trong các script thử nghiệm ở output; các file bàn giao và production build không có lỗi kiểm tra.
- Chạy đủ 29 nhóm UI trên production build cô lập của phần staged. 28 nhóm đạt ngay; check-public-ui ban đầu vướng so sánh dấu / cuối canonical trang chủ. Chuẩn hóa URL trong bài kiểm tra rồi chạy lại đạt trên cùng build.
- Sau chỉnh header/chữ lớn, build lại và chạy sáu nhóm: public UI, dashboard, tìm sân, tương tác/chuyển động, tài khoản/thông báo và xác thực. Toàn bộ lượt này kết thúc thành công; gồm kiểm tra không chồng logo/nút đăng nhập ở chữ 200%.
- Kiểm tra riêng landing/carousel trên production build mới kết thúc thành công: năm bề rộng 320/390/768/1024/1440px, nút 44px, bàn phím, pause/resume, video vào/ra vùng nhìn, giảm chuyển động, tiết kiệm dữ liệu, no-JS và chọn giờ với dữ liệu 100 sân. Bài kiểm tra được cập nhật theo các nút chọn môn/dừng ảnh hiện có.
- Các nhóm đã đạt bao phủ tìm kiếm/phân trang/lưu sân; khôi phục đặt sân bằng UUID; checkout realtime, QR lỗi và mất mạng; lịch/khóa sân; upload ảnh và retry; quản lý hồ sơ; giải/kết nối; xử lý lỗi đọc dữ liệu; giới hạn ảnh công khai và chặn request ghi từ nguồn ngoài.
- Dữ liệu từ fixture localhost; Chromium headless, context riêng. Không sử dụng cookie/trình duyệt cá nhân, không tải .env hoặc ghi vào database thật.
- Đã xem ảnh chụp desktop, mobile và chữ 200%; ảnh chụp chứa dữ liệu kiểm tra, không phải bằng chứng ảnh địa điểm hoặc nghiệm thu giao dịch thật.

## Commit bàn giao

Ba mốc code đã push lên origin/main:

- a7eeff9 — ảnh sân công khai, trang chủ, tối ưu ảnh và font tiếng Việt.
- bde4b43 — lịch, biểu mẫu, phản hồi tải và giữ ngữ cảnh tìm kiếm.
- a836542 — tổng quan chủ sân, SEO/chia sẻ, minh họa gốc và chữ lớn.

Mốc 4 là báo cáo này. Các thay đổi local có trước task vẫn giữ ngoài commit bàn giao.
