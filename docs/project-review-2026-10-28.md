# Rà soát và phát triển tiếp — 28/10/2026

## Phạm vi và căn cứ

Rà từ `origin/main` tại `a2ebcfb`, đối chiếu hướng dẫn, cấu trúc 155 file trong
`app`, 172 file trong `lib`/`components`, CI, thư viện, các luồng API/UI và
database vận hành qua truy vấn chỉ đọc. Không coi kiểm kê file là đã kiểm
từng nhánh nghiệp vụ. Các kiểm tra trình duyệt dùng Chromium headless,
context riêng và dữ liệu giả lập localhost, không dùng phiên cá nhân.

Workspace gốc có thay đổi chưa commit và chậm 23 commit. Công việc lần này
ở worktree riêng; các thay đổi dở dang về đăng nhập, hiển thị sân và types
không được gộp. Supabase và Git đang có cùng **95 migration**, không thiếu
phiên bản ở hai phía tại thời điểm đối chiếu.

## Đợt này đã phát triển

1. **Vá thư viện chạy website.** Next.js 15.5.27 → 15.5.28, đồng bộ
   eslint-config-next; Zod 3.25.76 → 4.6.7. Audit trước vá có một thư viện
   critical và một high; `npm audit --omit=dev` sau vá không còn cảnh báo.
   Advisory: [Next SVG](https://github.com/advisories/GHSA-2464-fhr4-w9xw),
   [Next Server Actions](https://github.com/advisories/GHSA-p3m5-59mp-jv5r),
   [Zod collections](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
   Đây là kết quả registry tại thời điểm rà, không phải chứng minh đã bị khai thác.
2. **Giữ hợp đồng đầu vào khi nâng Zod.** PostgreSQL chấp nhận UUID cũ không
   có version/variant RFC; dùng `z.guid()` để giữ tương thích ở các biên đang
   dùng `z.string().uuid()` của Zod 3. Giữ kiểm định ngày, giới hạn mảng, mặc
   định, chuẩn hóa điện thoại và lỗi tiếng Việt; đổi `errorMap` và cấu trúc
   issue theo Zod 4. SQL vẫn quyết định giá, quyền và lịch.
3. **Sửa trang duyệt VIP.** URL trang cũ vượt dữ liệu (`PGRST103`/416) được
   tải về trang đầu của cùng bộ lọc. Lỗi kiểm tra quyền quản trị được đưa vào
   màn thử lại; không chuyển về trang chủ như khi thực sự thiếu quyền.
   Lỗi database khác vẫn hiện lỗi, không biến thành lịch sử trống.
4. **Sửa các bài kiểm tra bị lệch sau khi có báo giá VIP.** API báo giá dùng
   POST để đọc; bài kiểm tra giữ chỗ không chặn/đếm nó là tạo đơn. Chờ báo
   giá xong trước khi thử bấm kép. Bài yêu cầu dữ liệu chọn đúng thông báo
   lỗi, không nhầm vùng route announcer của Next. Bổ sung kiểm tra VIP về
   lịch sử đã mua/hết hạn, phân trang, lỗi truy vấn/quyền và chuyển đăng nhập.
5. **Ngăn hồi quy.** CI kiểm audit production mức high trở lên, thêm bài
   hợp đồng schema và tham số URL. Đồng bộ mô tả chính sách hủy đã chốt và
   thông tin OAuth trong tài liệu/công cụ thiết lập.

## Hiện trạng vận hành đọc lúc khoảng 16:40 ngày 28/10 (giờ Việt Nam)

- Cron giữ chỗ, hoàn tất buổi chơi, hạn giải, gửi thông báo và giám sát đều
  bật. Worker HTTP và heartbeat giám sát đang phản hồi thành công.
- Không có hàng đợi quá hạn hoặc chủ sân cần cấp quyền SePay lại.
- **4 email gửi lỗi `HTTP_403`**. Cần đối chiếu quyền API/tên miền gửi tại
  nhà cung cấp và người nhận trước khi thử gửi lại; HTTP 403 chưa cho biết
  chính xác nguyên nhân. Lần rà này không gửi thư hoặc retry cho khách.
- Kiểm tra cấu hình Supabase Auth chỉ đọc xác nhận **chưa có SMTP tên miền
  riêng**, giới hạn **2 email/giờ**; độ dài/hạn OTP và mẫu thư xác nhận chưa
  khớp giao diện. Đây là lỗi cấu hình hiện còn tồn tại, không chỉ là ghi chú
  của checklist tháng 9. Cần tên miền gửi đã xác minh để hoàn tất nghiệm thu.
- **1 giao dịch đã nhận diện bị gắn cờ đối soát lâu**. Xử lý tại
  `/admin/tien-vao`; không tự xác nhận thanh toán hoặc đánh dấu đã hoàn.
- `multi_owner_enabled = true`, khác mặc định/thông tin trong tài liệu cũ.
  `booking_operator.accepts_new_bookings = false` là trạng thái đường nhận
  tiền cũ, không chứng minh toàn website ngừng nhận đơn OAuth. Giữ nguyên
  các cờ; cần đối chiếu biên bản nghiệm thu trước khi kết luận vận hành đủ điều kiện.

## Thứ tự phát triển tiếp

| Ưu tiên | Việc | Tiêu chí hoàn tất |
| --- | --- | --- |
| P1 | Xử lý email lỗi và giao dịch tồn | Xác định nguyên nhân nhà cung cấp, nghiệm thu thư thật và đối soát ngân hàng; chỉ retry khi đủ căn cứ |
| P1 | Kiểm quyền RPC và `search_path` | Phân loại hàm công khai/hàm nội bộ, khóa đường tìm tên của 3 helper, thu hồi quyền thừa qua migration có rollback test; không làm hỏng tìm sân anonymous/Telegram |
| P1 | Vá công cụ phát triển/triển khai | Audit toàn cây còn 35 cảnh báo sau đợt vá, chủ yếu Vercel CLI và dependency; chọn bản tương thích và kiểm thử CLI, không ép `audit fix --force` |
| P1 | Backup và diễn tập khôi phục | Khôi phục DB, Storage và khóa AES trên môi trường riêng; ghi thời gian, phạm vi và bằng chứng |
| P2 | Tối ưu truy vấn/RLS theo số đo | EXPLAIN và đo trước/sau; giữ nguyên phạm vi quyền, không bỏ GiST hay gom logic tiền vào TypeScript |
| P2 | Cải thiện LCP trang chủ trên mobile | Đo production nhiều lượt; chỉ đổi ảnh/font/tải tài nguyên khi có bằng chứng, giữ ảnh thật và khả năng đọc khi JS lỗi |
| P2 | Nghiệm thu toàn vòng | OTP/recovery, OAuth/QR/chuyển thật, VIP, hủy/hoàn, giải đấu; Safari/điện thoại, người giữ tài khoản tham gia |
| P3 | Lịch cố định, đơn ngoài web, nhắc lịch | Chỉ thiết kế khi có nhu cầu, quy tắc cọc/hủy/xung đột và kênh nhận được chốt |

## Phân loại cảnh báo database

Supabase Advisors trả **212 WARN, không có ERROR** trong lượt quét này:
3 helper thiếu `search_path`, 1 extension ở public, 28 quyền anonymous và
115 quyền authenticated trên SECURITY DEFINER, 27 `auth_rls_initplan`,
37 `multiple_permissive_policies`, 1 bảo vệ mật khẩu rò rỉ chưa bật.

Các số này không tương đương 212 lỗ hổng. Nhiều RPC công khai hoặc có kiểm
quyền bên trong là chủ đích. Cần đọc từng định nghĩa cuối và quyền thực tế
trước khi đổi; extension `btree_gist` đang phục vụ ràng buộc chống trùng,
không di chuyển tùy tiện. Hai nhóm RLS hiệu năng cần đo trên dữ liệu và
vai trò thật. Thiết lập Auth cần đánh giá cấu hình/gói dịch vụ hiện có.

## Bằng chứng kiểm tra

- Cài lại bằng `npm ci`, lint và typecheck đạt. Production build với fixture
  độc lập dùng Next 15.5.28 đạt; không truyền khóa production vào build thử.
- 14 bài hợp đồng đầu vào/API, origin, hoàn cọc, thông báo, mã hóa SePay,
  mã phí, lịch trống và schema SEO đạt.
- Lượt `npm run check:ui` cuối đạt đủ **40 bộ kiểm tra** trên production
  build với fixture cô lập: đặt sân, checkout, VIP, tài khoản, lịch sử,
  quản lý chủ sân/admin, phục hồi lỗi, accessibility và tối ưu ảnh; các bài
  responsive chạy từ 320 đến 1440px theo phạm vi từng bộ. Đây là kiểm tra
  localhost, không thay thế nghiệm thu chuyển khoản hoặc gửi email thật.
- SQL preflight đạt: 95 migrations và 22 bài rollback. Không sửa SQL trong
  đợt này; [SQL CI của bản gốc](https://github.com/MinhTT2/san-ngon/actions/runs/40624738969)
  đã đạt. Không gọi preflight là đã chạy lại các bài SQL trên database.
- [CI bản gốc](https://github.com/MinhTT2/san-ngon/actions/runs/40624738830)
  có job code đạt, browser lỗi tại personal data, player discovery,
  booking polish và query recovery. Các sửa kiểm tra nêu trên xuất phát từ
  log thật; giữ các assertion về tiền, chống gửi kép và phục hồi.
- Một lượt chạy đồng thời xuất hiện lỗi hydration trong `check-remaining-ux`;
  chạy lại riêng ở năm độ rộng và lượt 40 bộ cuối đều đạt, chưa đủ căn cứ
  xác định nguyên nhân.
  Bài kiểm tra giữ nguyên assertion lỗi trình duyệt và ghi thêm URL khi lỗi
  để điều tra nếu tái diễn; không đánh dấu đã sửa một lỗi chưa chẩn đoán.

Xem thêm [lộ trình đã bàn giao](development-roadmap-2026-10-21.md),
[hiệu năng](performance-accessibility.md), [VIP](vip.md) và
[nghiệm thu MVP](mvp-acceptance.md). Email/chuyển khoản/hoàn thật, backup và
quyền đọc GA4 vẫn cần bằng chứng vận hành riêng, không thể thay bằng mock.
