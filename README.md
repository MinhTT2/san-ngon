# Sân Ngon

Sân Ngon là marketplace web đặt sân thể thao tại Hà Nội. Người chơi xem lịch
trống theo thời gian thực, chọn đúng sân con, giữ chỗ 15 phút và đặt cọc bằng
chuyển khoản. Chủ sân quản lý nhiều cụm sân, lịch và đơn đặt ở một nơi; admin
kiểm tra hồ sơ trước khi cụm sân được mở công khai.

Đây là bản MVP phục vụ demo ngày **28/09/2026**. Sản phẩm tập trung vào luồng
đặt sân và vận hành cốt lõi, không phải một app di động hay một hệ thống quản
trị đầy đủ.

## Sản phẩm hiện có

**Người chơi**

- Tìm cụm sân đang hoạt động ở Hà Nội theo khu vực và môn: bóng đá 5/7/11
  người, cầu lông, pickleball và tennis.
- Xem lịch từng sân con, chọn tối đa ba khung giờ liền nhau và biết giá trước
  khi đặt.
- Xem lịch không cần tài khoản; đăng nhập khi đặt bằng Google hoặc email.
- Nhận mã đơn, QR chuyển khoản, đếm ngược giữ chỗ và cập nhật xác nhận tiền
  qua realtime.
- Xem lại đơn, hủy đơn theo chính sách và theo dõi thông báo trong app.

**Chủ sân**

- Đăng nhiều cụm sân trong cùng một tài khoản.
- Gửi thông tin đại diện, giấy phép kinh doanh, tài khoản nhận tiền, môn thể
  thao, số sân, giờ mở cửa và giá khởi điểm.
- Theo dõi hồ sơ chờ duyệt; chỉ cụm sân được admin duyệt mới nhận đặt.
- Xem lưới lịch 7 ngày, đơn hôm nay và danh sách cần hoàn cọc.
- Xác nhận tay đơn đã nhận tiền khi webhook SePay gặp sự cố.
- Nhận báo đơn mới trong app, Telegram và email nếu cấu hình kênh tương ứng.

**Admin**

- Xem tổng quan tài khoản, đơn đặt và hồ sơ cụm sân.
- Mở giấy phép kinh doanh bằng signed URL, rồi duyệt hoặc từ chối hồ sơ.

## Luồng thanh toán

Trang `/dat-san/[code]` hiển thị số tiền cọc và thông tin tài khoản nhận tiền
được cấu hình trong biến môi trường. Nội dung chuyển khoản chứa mã dạng
`SANxxxxxx`. SePay gọi `/api/webhooks/sepay`; webhook đối chiếu mã, số tiền và
mã giao dịch rồi gọi hàm SQL `confirm_payment`. Mã giao dịch ngân hàng là duy
nhất nên webhook có thể được SePay gửi lại mà không tạo thanh toán trùng.

Tiền cọc hiện chuyển vào tài khoản SePay của dự án. Tài khoản nhận tiền của
từng chủ sân được lưu trong hồ sơ để phục vụ vận hành và đối soát; việc hoàn
cọc vẫn do chủ sân thực hiện thủ công. Nếu SePay không gửi webhook, chủ sân có
thể xác nhận tay trong `/chu-san`.

## Kiến trúc cần giữ nguyên

- Next.js App Router, React 19, Tailwind CSS v4 và Supabase.
- Logic giá, kiểm tra lịch, tạo/hủy đơn, xác nhận thanh toán và duyệt hồ sơ nằm
  trong PostgreSQL functions. Next.js chỉ kiểm tra đầu vào, gọi RPC và dịch lỗi.
- Chống đặt trùng bằng exclusion constraint GiST trên `bookings`.
- Giá do server tính và đóng băng vào đơn; client không được gửi tổng tiền.
- Database lưu `timestamptz` UTC. Quy đổi giờ Hà Nội nằm trong SQL; frontend chỉ
  format ngày giờ.
- Không dùng ORM, Docker không phải yêu cầu bắt buộc, không có state manager
  hay thư viện form riêng.
- `SUPABASE_SERVICE_ROLE_KEY` chỉ được dùng ở webhook SePay.

## Chạy nhanh

Cần Node.js 24 trở lên và một project Supabase đã có quyền truy cập.

```bash
npm install
cp .env.example .env.local
# điền NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run setup:check
npm run dev
```

Mở <http://localhost:3000>. Hướng dẫn tạo database, tài khoản demo, Auth,
SePay, Telegram và deploy nằm trong [docs/dev-setup.md](docs/dev-setup.md).

Kiểm tra trước khi commit:

```bash
npm run lint
npm run typecheck
npm run build
# hoặc chạy cả ba
npm run ci
```

## Các route chính

| Route | Mục đích |
| --- | --- |
| `/` | Landing page và tìm nhanh lịch trống |
| `/tim-san` | Danh sách cụm sân, bộ lọc khu vực/môn |
| `/san/[slug]` | Lịch các sân con và form đặt |
| `/dat-san/[code]` | Checkout, QR chuyển khoản và trạng thái thanh toán |
| `/don-cua-toi` | Đơn của người chơi |
| `/chu-san` | Lịch, đơn và hoàn cọc cho chủ sân |
| `/dang-ky-san` | Gửi và theo dõi hồ sơ cụm sân |
| `/thong-bao` | Thông báo trong app |
| `/admin` | Duyệt hồ sơ và xem tổng quan vận hành |
| `/chinh-sach-huy` | Chính sách hủy và hoàn cọc |
| `/lien-he` | Kênh hỗ trợ |

Trang checkout nằm ngoài nhóm route có header/footer để giảm đường thoát trong
luồng thanh toán.

## Database

`supabase/migrations/` là nguồn thay đổi schema, RLS và functions hiện tại.
Sau khi link project, áp dụng bằng:

```bash
npm run db:login       # một lần trên máy
npm run db:link        # chọn hoặc nhập project ref
npm run db:dry
npm run db:push
npm run db:types
```

Sau `db push`, bật extension `pg_cron` trong Supabase rồi chạy
`supabase/05_cron.sql` trong SQL Editor để bật tự hết hạn đơn, hoàn tất đơn cũ
và realtime cho `bookings`/`notifications`.

Các file `supabase/01_schema.sql` đến `supabase/04_seed.sql` là bộ script dựng
thủ công cũ. Không chạy chúng cùng với migrations trên một database đã link.

## Phạm vi cố ý chưa có

Bản đồ, đánh giá sao, tìm đối, ví nội bộ, hoàn tiền tự động, upload ảnh sân,
Zalo OA, email cho người chơi và ứng dụng native nằm ngoài MVP hiện tại.
