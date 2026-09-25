# Sân Ngon

Sân Ngon là website đặt sân thể thao tại Hà Nội: bóng đá 5/7/11 người, cầu
lông, pickleball và tennis. Người chơi xem lịch từng sân, chọn giờ, giữ chỗ
15 phút và chuyển khoản tiền cọc. Chủ sân quản lý cụm sân, lịch đặt và các
khoản cần hoàn trong cùng một nơi.

MVP phục vụ demo ngày **28/09/2026**, do một người phát triển. Desktop là bố
cục chính; điện thoại có bố cục rút gọn. Ưu tiên luồng đặt sân và vận hành ít
điểm hỏng, chưa mở rộng thành hệ thống quản trị toàn diện.

## Luồng sản phẩm

### Người chơi

1. Tìm cụm sân theo tên/địa chỉ, khu vực, môn, ngày chơi, trong/ngoài nhà và
   tình trạng còn chỗ. Thẻ sân hiển thị số khung trống, giờ trống sớm nhất và
   giá từ theo bộ lọc; có sắp xếp và phân trang.
2. Mở lịch sân con, chọn tối đa ba khung liền nhau trên cùng một sân. Xem lịch
   không cần tài khoản; đăng nhập khi đặt bằng Google hoặc email/mật khẩu.
   Đăng ký email cần xác nhận mã OTP.
3. Nhập thông tin liên hệ, tạo đơn và chuyển khoản theo QR/mã `SANxxxxxx`.
   Giá và tiền cọc do SQL tính, đóng băng vào đơn.
4. Theo dõi thanh toán, xem lại đơn, hủy theo chính sách và nhận thông báo
   trên website. Phần tiền còn lại thanh toán tại sân.

### Chủ sân và admin

1. Người dùng gửi **hồ sơ chủ sân** tại `/dang-ky-san`: thông tin đại diện,
   loại hình đăng ký, giấy tờ xác minh và tài khoản nhận tiền.
2. Admin xem hồ sơ, mở giấy tờ qua signed URL rồi duyệt hoặc từ chối. Người
   bị từ chối có thể gửi lại; người được duyệt mới tạo cụm sân.
3. Chủ sân tạo cụm sân và sân con trong khu quản lý. Cụm mới ở trạng thái
   `draft`; lưu **3–8 ảnh thật** qua luồng quản lý ảnh sẽ chuyển sang `active`
   để xuất hiện ở trang tìm sân. Luồng này không yêu cầu duyệt lại từng cụm;
   admin vẫn có công cụ xử lý hồ sơ cụm sân `pending` từ luồng cũ.
4. Chủ sân sửa thông tin cụm/sân con, giá chung, giờ hoạt động; khóa/mở lại
   lịch theo ngày hoặc khoảng giờ. SQL chặn thay đổi ảnh hưởng đơn đã đặt.
5. Chủ sân xem lịch bảy ngày, danh sách đơn, thống kê và khoản cần hoàn;
   xác nhận tay đơn còn hạn khi đã kiểm tra tiền vào, đánh dấu đã hoàn sau
   khi chuyển tiền thủ công. Telegram báo đơn mới khi đã kết nối bot;
   email kết quả duyệt hồ sơ dùng Resend nếu được cấu hình.

## Đặt chỗ và thanh toán

**Bản demo chỉ nhận đơn cho một chủ sân**, có thể quản lý nhiều cụm sân.
SQL chặn chủ sân khác nhận đơn dùng chung tài khoản cọc. Kết nối SePay riêng
cho nhiều chủ sân chỉ triển khai sau khi SePay duyệt ứng dụng OAuth. Xem
[cấu hình và nghiệm thu](docs/sepay-single-owner.md).

Một đơn chỉ gắn với **một sân con** (`courts`), không phải cả cụm (`venues`).
Muốn đặt hai sân cùng giờ phải tạo hai đơn. Mỗi tài khoản có tối đa hai đơn
chờ còn hạn. Cọc mặc định 30%, tùy cấu hình cụm sân, được làm tròn lên bội số
1.000 đồng. Thời hạn đặt trước mặc định 30 ngày, có thể cấu hình theo cụm.

Đơn `pending` giữ chỗ 15 phút. Hết hạn thì khung được coi là trống ngay trong
SQL, không phải chờ cron; tạo đơn mới cũng giải phóng giữ chỗ đã hết hạn trước
khi ghi đơn. GiST trên `bookings` là lớp chống đặt trùng cuối cùng.

Tiền cọc hiện vào **tài khoản ngân hàng của dự án/người sáng lập**, lấy từ
biến môi trường trên checkout. Tài khoản trong hồ sơ chủ sân phục vụ vận
hành và đối soát, chưa tự quyết định QR của từng cụm sân. Chuyển tiền cho chủ
sân và hoàn cọc đều cần xử lý thủ công.

SePay gọi `/api/webhooks/sepay` với API key; `confirm_payment` đối chiếu mã,
số tiền và mã giao dịch. `payments.bank_tx_id` unique chống xử lý lại cùng
giao dịch. Checkout theo dõi realtime trên dòng đơn, không polling trạng
thái thanh toán. Webhook đến sau hạn không khôi phục đơn, mà đánh dấu cần
hoàn; chuyển thiếu không xác nhận đơn.

Người chơi hủy trước giờ chơi từ hai giờ trở lên được đánh dấu cần hoàn cọc;
hủy muộn mất cọc. Chủ sân hủy đơn của khách thì khách được hoàn. **Mốc hai giờ
vẫn chờ thống nhất với chủ sân**, phải sửa đồng thời SQL, hằng số và nội dung
chính sách khi chốt. Xem các điểm cần xử lý trước demo trong
[AGENTS.md](AGENTS.md#việc-cần-chốt-trước-demo).

## Chạy dự án

Cần Node.js **24.x** và project Supabase từ xa, ưu tiên region Singapore.
Không cần Docker cho luồng phát triển chính.

```bash
npm ci
cp .env.example .env.local
# Điền biến Supabase theo .env.example
npm run setup:check
npm run dev
```

Mở <http://localhost:3000>. Hai biến Supabase chỉ đủ kết nối app; database,
Auth và thanh toán cần được thiết lập theo [docs/dev-setup.md](docs/dev-setup.md).

```bash
npm run ci  # lint, typecheck, build
```

CI chạy cùng lệnh khi push `main` hoặc mở PR. Chưa có bộ test tự động nghiệp
vụ; các bước kiểm tra demo thủ công nằm trong hướng dẫn thiết lập.

## Các route chính

| Route | Mục đích |
| --- | --- |
| `/`, `/tim-san`, `/san/[slug]` | Trang chủ, tìm cụm sân, lịch và đặt sân con |
| `/dang-nhap`, `/dang-ky` | Đăng nhập, đăng ký tài khoản người dùng |
| `/dat-san/[code]` | QR, đếm ngược giữ chỗ và trạng thái thanh toán |
| `/don-cua-toi`, `/thong-bao` | Đơn và thông báo của người dùng |
| `/dang-ky-san` | Gửi/theo dõi hồ sơ chủ sân |
| `/chu-san` | Tổng quan, thống kê, lịch bảy ngày và khoản cần hoàn |
| `/chu-san/quan-ly`, `/tao-cum-san` | Quản lý cụm/sân con, ảnh và tạo cụm mới |
| `/chu-san/lich`, `/chu-san/don` | Lịch vận hành, khóa lịch và danh sách đơn |
| `/admin`, `/admin/owners/[id]` | Tổng quan vận hành và duyệt hồ sơ chủ sân |
| `/chinh-sach-huy`, `/lien-he` | Chính sách và hỗ trợ |

Checkout có header gọn, nút về trang chủ và không có footer. Về trang chủ
không hủy giữ chỗ; dùng nút hủy để trả lịch ngay. Khu chủ sân và admin có bố
cục quản lý riêng.

## Kiến trúc và tài liệu

- Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4 và Supabase
  (Postgres, Auth, Realtime, Storage).
- SQL giữ logic giá, lịch, tạo/hủy đơn, thanh toán và quyền vận hành. Next.js
  kiểm tra đầu vào, xác thực, gọi RPC và dịch lỗi tiếng Việt.
- Giá do server tính; database lưu `timestamptz` UTC, quy đổi giờ Hà Nội trong
  SQL. Frontend format giờ, không tự cộng/trừ múi giờ.
- RLS giới hạn dữ liệu theo người dùng; service role chỉ dùng trong webhook
  SePay. Không ORM, state manager, thư viện form hay animation riêng.
- [supabase/migrations/](supabase/migrations/) là nguồn schema/functions hiện
  tại. Không dựng môi trường mới bằng bộ `01_schema.sql`–`04_seed.sql` cũ.
- [AGENTS.md](AGENTS.md) ghi nguyên tắc phát triển, thiết kế và phần còn thiếu.
- [docs/dev-setup.md](docs/dev-setup.md) hướng dẫn database, Auth, webhook,
  dữ liệu demo và deploy Vercel.

Bản đồ, đánh giá sao, tìm đối, ví nội bộ, hoàn tiền tự động, Zalo OA, email
thông báo đơn cho người chơi và ứng dụng native nằm ngoài MVP. Email xác
thực tài khoản vẫn có. Upload ảnh sân và trang admin tối thiểu đã nằm trong
sản phẩm hiện tại.
