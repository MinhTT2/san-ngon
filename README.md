# Sân Ngon

Nền tảng đặt sân bóng ở Hà Nội. Người chơi tự xem lịch trống và chốt sân bằng tiền cọc chuyển khoản, chủ sân không phải trực điện thoại.

Đây là **xương sườn**: tầng dữ liệu hoàn chỉnh, các route API lõi, lưới lịch hai bố cục, và kênh thông báo. Phần giao diện còn nhiều `TODO` kèm ngày trong kế hoạch.

## Chạy nhanh bằng Docker

Cần Docker Desktop (Docker Engine + Docker Compose v2). Docker chỉ chạy app
Next.js; database vẫn là project Supabase từ xa.

```bash
git clone <repository-url>
cd san-ngon
cp .env.example .env.docker
```

Điền giá trị thật trong `.env.docker`, ít nhất là:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Muốn chạy đầy đủ trang thanh toán và webhook thì điền thêm các biến SePay,
`SUPABASE_SERVICE_ROLE_KEY` và các biến Telegram/email tương ứng.

Khởi động bản production:

```bash
docker compose --env-file .env.docker up --build
```

Mở <http://localhost:3000>. Dừng container bằng lệnh sau:

```bash
docker compose --env-file .env.docker down
```

Các biến `NEXT_PUBLIC_*` được nhúng vào client khi build, nên phải chạy lại
`up --build` sau khi đổi chúng. `.env.docker` chứa secret và không được commit.

## Chạy development không dùng Docker

Cần Node.js 24 trở lên:

```bash
npm install
cp .env.example .env.local   # điền giá trị thật
npm run dev
```

Kiểm tra trước khi đẩy code:

```bash
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run build      # next build
npm run ci         # cả ba
```

## Supabase

Chạy lần lượt trong SQL Editor, không gộp:

1. `supabase/01_schema.sql`
2. `supabase/02_rls.sql`
3. `supabase/03_functions.sql`
4. Đăng nhập vào app một lần để có user, rồi `supabase/04_seed.sql`
5. Bật extension `pg_cron` ở Database › Extensions, rồi `supabase/05_cron.sql`

Khi cập nhật bản này, chạy lại `supabase/03_functions.sql` để cập nhật đăng ký
nhiều môn, xác nhận tay và đánh dấu hoàn cọc. Các hàm dùng `create or replace`
nên không tạo dữ liệu trùng.

Hồ sơ chủ sân phải kèm giấy tờ kinh doanh. Với database đã chạy trước đó, chạy
thêm migration `supabase/migrations/20260921000001_business_license.sql`.

Nếu database đã chạy từ trước khi có tự liên kết Telegram, chạy thêm
`supabase/migrations/20260918000003_telegram_link.sql` một lần.

Kiểm tra tầng dữ liệu đã đúng:

```sql
select * from get_venue_availability(
  (select id from venues where slug = 'san-my-dinh'),
  current_date + 1
) limit 20;
```

Ra danh sách khung giờ kèm giá là xong. Ra rỗng nghĩa là seed chưa chạy.

## Đăng nhập

Hai cách: Google và link gửi qua email. Cần bật trong Supabase trước, xem phần
Supabase Auth bên dưới.

`/auth/callback` chỉ nhận `next` là đường dẫn nội bộ. Giá trị tuyệt đối từ link
email bị bỏ qua, không ghép vào redirect.

Đăng xuất là `POST /auth/dang-xuat`, không phải GET: một thẻ `<img>` trên trang
khác không đá được người dùng ra ngoài. Cookie phiên do server xoá nên vẫn chạy
khi JavaScript hỏng.

## Supabase Auth

Authentication › Providers:

- **Email** — bật. Mặc định Supabase chỉ gửi được vài thư mỗi giờ, đủ để thử
  chứ không đủ để demo. Cắm SMTP riêng ở Project Settings › Auth › SMTP.
- **Google** — bật, dán Client ID và Client Secret của Google Cloud. Trong
  Google Cloud, Authorized redirect URI là
  `https://<project-ref>.supabase.co/auth/v1/callback`.

Authentication › URL Configuration:

- **Site URL**: domain production.
- **Redirect URLs**: thêm `http://localhost:3000/**` và `https://<domain>/**`.
  Thiếu dòng này thì bấm link trong email xong bị đá về Site URL, mất luôn
  khung giờ đang chọn.

## SePay

Đây là mắt xích duy nhất phụ thuộc bên ngoài và có thể mất vài ngày duyệt. Làm trước mọi thứ khác.

1. Đăng ký tại sepay.vn, liên kết tài khoản ngân hàng **cá nhân** (MB, OCB, TPBank, ACB, VPBank).
2. Webhook → URL `https://<domain>/api/webhooks/sepay`, xác thực **API Key**, sự kiện **tiền vào**.
3. Test local bằng `npx ngrok http 3000`, dán URL ngrok vào SePay.
4. Tự chuyển khoản 2.000đ với nội dung `SANTEST01`, xem log.

## Telegram

1. Nhắn `/newbot` cho @BotFather, lấy token.
2. Điền `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` (không có `@`) và một
   chuỗi bí mật ngẫu nhiên vào `TELEGRAM_WEBHOOK_SECRET`.
3. Trỏ webhook một lần sau khi deploy:

   ```bash
   curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
     -d "url=https://<domain>/api/webhooks/telegram" \
     -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
   ```

4. Chủ sân vào `/chu-san`, bấm **Tạo link kết nối**, mở Telegram rồi bấm
   **Start**. App tự lưu `chat_id`; không cần chạy SQL hay lấy `getUpdates`.

Chủ sân vẫn phải bấm Start một lần vì Telegram không cho bot tự nhắn người chưa
từng mở cuộc trò chuyện. Mã trong deep link hết hạn sau 10 phút và chỉ dùng một lần.

Hệ thống phải chạy được cả khi chưa có `chat_id`: `sendTelegram` trả về `NOT_CONFIGURED` và không ném lỗi.

## Nguyên tắc không được phá

**Giá tính ở database, không ở TypeScript.** `create_booking` tự tra `price_rules`. Client gửi `total` lên cũng bị bỏ qua.

**Chống đặt trùng bằng ràng buộc loại trừ GiST**, không bằng kiểm tra trong code. Đây là lý do dự án không dùng ORM.

**Mọi quy đổi múi giờ nằm trong SQL.** Frontend chỉ format, không tính toán ngày giờ.

**`SUPABASE_SERVICE_ROLE_KEY` chỉ xuất hiện trong route webhook.** Không bao giờ import vào component.

**Người đặt không update thẳng bảng `bookings`.** Policy update chỉ dành cho chủ sân và có `with check`. Hủy đơn đi qua `cancel_booking()`. Nới chỗ này ra là khách tự xác nhận đơn được mà không cần trả tiền.

## Màn hình đã có

| Đường dẫn | Màn |
| --- | --- |
| `/` | Landing page |
| `/tim-san` | Danh sách cụm sân |
| `/san/[slug]` | Lịch cụm sân, tự đổi bố cục theo bề rộng |
| `/dat-san/[code]` | QR, đếm ngược, tự nhảy khi tiền vào |
| `/don-cua-toi` | Bảng trên desktop, thẻ trên điện thoại |
| `/chu-san` | Lưới 7 ngày và đơn hôm nay |
| `/thong-bao` | Thông báo trong app, badge chưa đọc |
| `/dang-nhap` | Đăng nhập Google và email OTP |
| `/dang-ky` | Tạo tài khoản bằng email OTP |
| `/dang-ky-san` | Form đăng sân; đã gửi rồi thì hiện bốn bước duyệt |
| `/chinh-sach-huy` | Điều kiện hoàn cọc |
| `/lien-he` | |

Luồng người chơi đi được từ đầu tới cuối: vào landing, tìm sân, chọn giờ, nhập thông tin, quét QR, nhận xác nhận, xem lại đơn, hủy đơn.

Chủ sân có thể xác nhận tay đơn chờ cọc khi SePay không gửi webhook và đánh dấu các khoản đã hoàn cọc là đã xử lý ở `/chu-san`.

Hồ sơ đăng sân vào thẳng trạng thái `pending`. Duyệt bằng SQL cho tới khi có trang admin:

```sql
update venues set status = 'active' where slug = '<slug>';
```

Đây là sản phẩm **web**, không phải app. Bố cục desktop là chính, điện thoại là bản rút gọn.
