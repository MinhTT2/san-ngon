# Thiết lập và vận hành bản demo

Tài liệu này dành cho người dựng một môi trường Sân Ngon mới. Dự án dùng
Supabase từ xa; không cần Docker để phát triển. Docker chỉ là lựa chọn khi muốn
chạy bản Next.js production cục bộ.

## 1. Chuẩn bị

- Node.js 24.x
- Một project Supabase
- Supabase CLI 2.x (`npm run db:*` dùng CLI trong devDependencies)
- Vercel CLI nếu cần kéo biến môi trường production
- Docker Desktop chỉ khi chạy `docker compose`

Clone repo và cài dependency:

```bash
git clone <repository-url>
cd san-ngon
npm install
cp .env.example .env.local
```

Điền tối thiểu hai biến để chạy giao diện:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Kiểm tra cấu hình:

```bash
npm run setup:check
```

Lệnh này bắt buộc Supabase URL/key, đồng thời chỉ báo các nhóm thanh toán và
Telegram còn thiếu; thiếu các nhóm tuỳ chọn không chặn `npm run dev`.

## 2. Áp dụng database

Link CLI với project Supabase rồi xem trước migration:

```bash
npm run db:login       # chỉ cần chạy một lần
npm run db:link        # nhập project ref khi được hỏi
npm run db:dry
npm run db:push
npm run db:types
```

Migration tạo schema, RLS, storage bucket `venue-documents`, functions nghiệp vụ
và quyền admin. Khi database đã có dữ liệu, chỉ chạy các migration mới bằng
`npm run db:push`; không chạy lại bộ SQL thủ công theo số thứ tự.

Sau đó bật `pg_cron` trong **Supabase → Database → Extensions**, rồi chạy
`supabase/05_cron.sql` trong SQL Editor. Script này đăng ký:

- tự hết hạn đơn chờ thanh toán mỗi 2 phút;
- tự chuyển đơn đã qua giờ sang `completed` mỗi giờ;
- realtime cho `bookings` và `notifications`.

## 3. Tài khoản và dữ liệu demo

Trong **Supabase → Authentication → Users**, tạo hai user khác nhau: một admin
và một chủ sân. Sửa hai email ở đầu `supabase/demo-roles.sql`, rồi chạy file đó
trong SQL Editor để gán role. Tiếp theo sửa email chủ sân ở đầu
`supabase/demo-seed.sql` và chạy file để tạo cụm sân demo, sân con và bảng giá.

Không lưu mật khẩu hoặc dữ liệu tài khoản thật trong repository. Các script demo
không ghi đè cụm sân nếu chủ sân đã có dữ liệu.

## 4. Cấu hình Supabase Auth

Trong **Authentication → Providers**:

- bật Email để đăng ký bằng email, mật khẩu và mã OTP xác nhận;
- trong **Email Templates → Confirm signup**, giữ `{{ .Token }}` trong nội dung
  thư để người dùng nhập mã 6 số; không dùng chỉ link `{{ .ConfirmationURL }}`;
- bật Google nếu muốn nút đăng nhập Google hoạt động;
- cấu hình SMTP riêng nếu cần gửi đủ email cho buổi demo, vì quota mặc định của
  Supabase thấp.

Trong **Authentication → URL Configuration**:

- đặt **Site URL** thành domain production;
- thêm `http://localhost:3000/**` và `https://<domain>/**` vào **Redirect URLs**.

Với Google OAuth, Authorized redirect URI ở Google Cloud là
`https://<project-ref>.supabase.co/auth/v1/callback`.

Callback của app là `/auth/callback`. Tham số `next` chỉ chấp nhận đường dẫn
nội bộ để không tạo open redirect.

## 5. Biến môi trường

| Nhóm | Biến | Bắt buộc khi nào |
| --- | --- | --- |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Luôn luôn |
| Supabase server | `SUPABASE_SERVICE_ROLE_KEY` | Webhook SePay; không đưa vào client |
| SePay | `SEPAY_WEBHOOK_API_KEY` | Nhận và xác thực webhook |
| QR chuyển khoản | `NEXT_PUBLIC_SEPAY_ACCOUNT`, `NEXT_PUBLIC_SEPAY_BANK`, `NEXT_PUBLIC_SEPAY_ACCOUNT_NAME` | Hiển thị checkout |
| Site | `NEXT_PUBLIC_SITE_URL` | Nên điền domain thật khi deploy |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` | Báo đơn mới cho chủ sân |
| Email chủ sân | `RESEND_API_KEY`, `EMAIL_FROM` | Tuỳ chọn; gửi email khi tiền cọc được xác nhận |
| Supabase CLI | `SUPABASE_PROJECT_REF` | Tiện cho CLI/MCP, không phải secret của app |

Chỉ biến có tiền tố `NEXT_PUBLIC_` mới được đưa xuống trình duyệt. Đặc biệt,
không đưa `SUPABASE_SERVICE_ROLE_KEY`, SePay webhook key hay Telegram token vào
client hoặc commit vào git.

## 6. SePay

Tài khoản ngân hàng nhận cọc là tài khoản của người sáng lập/dự án. Khi bàn
giao, chỉ thay biến môi trường; không sửa logic đối soát trong code.

Trong SePay, tạo webhook tiền vào:

```text
https://<domain>/api/webhooks/sepay
```

Dùng API key tương ứng với `SEPAY_WEBHOOK_API_KEY`. Webhook trả `200` cho giao
dịch không liên quan để SePay không retry vô ích; chỉ trả `401` khi sai key và
`500` khi database không xác nhận được.

Test local bằng ngrok:

```bash
npx ngrok http 3000
```

Trỏ webhook tới URL ngrok, tạo một đơn thật trong môi trường test và chuyển
khoản với đúng mã đơn hiển thị trên checkout. Không dùng tài khoản production
để thử tuỳ tiện.

## 7. Telegram và email

Tạo bot Telegram bằng `/newbot` với BotFather, điền ba biến Telegram rồi sau
khi deploy đăng ký webhook:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://<domain>/api/webhooks/telegram" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

Chủ sân vào `/chu-san`, bấm **Tạo link kết nối**, mở link Telegram và bấm
**Start**. Link hết hạn sau 10 phút và chỉ dùng một lần. Chưa cấu hình Telegram
không làm hỏng việc xác nhận thanh toán.

Nếu có `RESEND_API_KEY`, webhook cũng gửi email báo đơn mới cho chủ sân. Người
chơi vẫn xem thông báo trong app; MVP chưa gửi email cho người chơi.

## 8. Chạy và kiểm tra

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run ci
```

Chạy Docker production cục bộ nếu cần:

```bash
cp .env.example .env.docker
# điền biến vào .env.docker
docker compose --env-file .env.docker up --build
```

Các biến `NEXT_PUBLIC_*` được nhúng lúc build image, nên đổi chúng phải chạy
lại `up --build`. `.env.docker` không được commit.

## 9. Deploy Vercel

Link project rồi kéo biến development bằng Vercel CLI nếu cần:

```bash
npm run vercel:login
npm run vercel:link
npm run env:pull
```

Trên Vercel, khai báo các biến runtime tương ứng trong `.env.example`, đặt
`NEXT_PUBLIC_SITE_URL` là domain thật và cập nhật Supabase Redirect URLs. Sau
khi deploy, cập nhật URL webhook SePay và Telegram về domain production.
