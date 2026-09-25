# Thiết lập và vận hành bản demo

Tài liệu này dành cho người dựng một môi trường Sân Ngon mới. Dự án dùng
Supabase từ xa; luồng chính không cần Docker. Tài liệu này mô tả cách dựng
môi trường theo migrations và luồng sản phẩm hiện tại, không xác nhận cấu
hình nào đã được áp dụng trên production.

## 1. Chuẩn bị

- Node.js 24.x
- Một project Supabase, ưu tiên region Singapore
- Supabase CLI 2.x (`npm run db:*` dùng CLI trong devDependencies)
- Vercel CLI nếu cần kéo biến môi trường production

Clone repo và cài dependency:

```bash
git clone git@github.com:MinhTT2/san-ngon.git
cd san-ngon
npm ci
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

Lệnh này bắt buộc Supabase URL/key, đồng thời báo các nhóm thanh toán,
Telegram và email còn thiếu; thiếu các nhóm tuỳ chọn không chặn `npm run dev`.

## 2. Áp dụng database

Bật `pg_cron` trong **Supabase → Database → Extensions** trước khi áp dụng
migration giữ chỗ ngày 25/09. Link CLI với đúng project rồi xem trước migration:

```bash
npm run db:login       # chỉ cần chạy một lần
npm run db:link        # nhập project ref khi được hỏi
npm run db:status
npm run db:dry
npm run db:push
npm run db:types
```

Migrations tạo schema, RLS, functions nghiệp vụ, quyền admin và hai bucket:
`venue-documents` riêng tư cho giấy tờ, `venue-photos` công khai cho ảnh sân.
Kiểm tra danh sách migration trước khi push; không áp dụng file thuộc task
local chưa hoàn tất vào môi trường dùng chung. `db:types` sinh lại
`lib/database.types.ts`, cần xem diff trước khi commit.

Migration `20260925000000_booking_holds.sql` đăng ký dọn đơn hết hạn **mỗi
phút**. Không chạy lại nguyên file `supabase/05_cron.sql` sau đó: file cũ sẽ
đổi lịch này về mỗi hai phút. Để bổ sung job hoàn tất đơn và realtime trên
môi trường mới, chạy phần sau trong SQL Editor:

```sql
select cron.schedule(
  'complete-past-bookings', '15 * * * *',
  'select public.complete_past_bookings()'
);

do $$
declare t text;
begin
  foreach t in array array['bookings', 'notifications'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

select jobname, schedule, active from cron.job
where jobname in ('expire-pending-bookings', 'complete-past-bookings');

select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public';
```

Kết quả cần có `expire-pending-bookings` chạy `* * * * *`,
`complete-past-bookings` chạy `15 * * * *`, cùng hai bảng realtime. Lịch trống
vẫn bỏ qua giữ chỗ hết hạn ngay cả khi cron chậm; cron cập nhật trạng thái
đơn để danh sách và sự kiện realtime theo kịp.

`supabase/01_schema.sql`–`04_seed.sql` là bộ dựng cũ, không chạy cùng
migrations. `supabase/demo-seed.sql` cũng chưa theo kịp điều kiện hồ sơ nhận
tiền và luồng ảnh bắt buộc; dùng giao diện để tạo dữ liệu demo bên dưới.

## 3. Tài khoản và dữ liệu demo

Sau khi cấu hình Auth ở mục 4, chuẩn bị ba tài khoản do bạn quản lý: admin,
chủ sân và người chơi. Dùng tài khoản tách biệt để kiểm tra đúng quyền.

Trong **Supabase → Authentication → Users**, tạo admin đầu tiên. Lấy UUID
của user đó và chạy trong SQL Editor (thay giá trị mẫu trước khi chạy):

```sql
insert into public.profiles (id, role)
values ('<UUID của admin trong auth.users>'::uuid, 'admin')
on conflict (id) do update set role = excluded.role;
```

Sau đó đi theo luồng thật:

1. Đăng ký tài khoản chủ sân qua `/dang-ky`, xác nhận OTP rồi gửi hồ sơ tại
   `/dang-ky-san`. Điền tài khoản nhận tiền và giấy tờ xác minh phù hợp.
2. Đăng nhập admin, mở `/admin?view=owners`, xem giấy tờ rồi duyệt hồ sơ.
3. Đăng nhập lại chủ sân, vào `/chu-san/quan-ly` tạo cụm và sân con. Cụm mới
   là `draft`, chưa xuất hiện công khai.
4. Thêm **3–8 ảnh thật** rồi lưu bộ ảnh để cụm thành `active`. Mỗi ảnh là
   JPEG/PNG/WebP, tối đa 5 MiB. Kiểm tra giờ hoạt động, môn, giá chung và cọc.
5. Dùng tài khoản người chơi tìm cụm ở `/tim-san` và đặt một khung tương lai.

`supabase/demo-roles.sql` có thể gán nhanh admin/chủ sân trong môi trường
riêng, nhưng nó bỏ qua bước duyệt hồ sơ và chưa điền thông tin nhận tiền.
Không dùng nó để chứng minh luồng onboarding đã hoạt động. Không lưu mật
khẩu, giấy tờ hay dữ liệu tài khoản thật trong repository.

## 4. Cấu hình Supabase Auth

Trong **Authentication → Providers**:

- bật Email để đăng ký bằng email, mật khẩu và mã OTP xác nhận;
- trong **Email Templates → Confirm signup**, giữ `{{ .Token }}` trong nội dung
  thư để người dùng nhập mã 6 số; không dùng chỉ link `{{ .ConfirmationURL }}`;
- bật Google nếu muốn nút đăng nhập Google hoạt động;
- đặt độ dài OTP là **6 số**, hết hạn sau **600 giây**;
- cấu hình SMTP riêng trước khi mở đăng ký. SMTP mặc định chỉ gửi tới thành viên
  được phép của project, giới hạn 2 email/giờ.

Mẫu tiếng Việt nằm ở `supabase/templates/confirmation.html`. Kiểm tra cấu hình
thật bằng `node scripts/configure-auth-email.mjs`; thêm `--apply` để đồng bộ
mẫu thư, độ dài mã và thời hạn. Script dùng token từ `supabase login` hoặc
`SUPABASE_ACCESS_TOKEN`, cùng project trong `.env.local`.

Để dùng Resend cho OTP và email kết quả duyệt hồ sơ chủ sân:

1. Xác minh tên miền gửi trên Resend (các bản ghi DNS Resend cung cấp).
2. Đặt `RESEND_API_KEY` và `EMAIL_FROM=San Ngon <no-reply@ten-mien-cua-ban>`
   trong `.env.local`; đặt cùng hai biến trên Vercel production.
3. Chạy `node scripts/configure-auth-email.mjs --apply`. Script cấu hình
   `smtp.resend.com:465`, user `resend`, tên gửi Sân Ngon, giới hạn 30 email/giờ
   và ít nhất 60 giây giữa hai lần gửi cho cùng người dùng.
4. Đăng ký bằng email do bạn quản lý, nhận mã 6 số, xác nhận và thử đăng nhập.
   Kiểm tra Resend Logs có trạng thái `delivered`; HTTP thành công chỉ chứng
   minh nhà cung cấp đã nhận yêu cầu gửi.

`onboarding@resend.dev` chỉ gửi thử tới email chủ tài khoản Resend; không dùng
địa chỉ này cho đăng ký công khai. Script không đưa khóa vào log và không đổi
cấu hình Google OAuth. Supabase Free không cho sửa mẫu thư khi còn dùng bộ gửi
mặc định: nếu chưa có SMTP và khóa Resend, `--apply` dừng trước khi thay đổi.

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
| Email | `RESEND_API_KEY`, `EMAIL_FROM` | Email duyệt hồ sơ; script có thể dùng để cấu hình SMTP Auth |
| Supabase CLI | `SUPABASE_PROJECT_REF` | Tiện cho CLI/MCP, không phải secret của app |

Chỉ biến có tiền tố `NEXT_PUBLIC_` mới được đưa xuống trình duyệt. Đặc biệt,
không đưa `SUPABASE_SERVICE_ROLE_KEY`, SePay webhook key hay Telegram token vào
client hoặc commit vào git.

## 6. SePay

**Hiện chỉ một chủ sân được nhận đơn.** Cấu hình `booking_operator` và nghiệm
thu theo [hướng dẫn một chủ sân](sepay-single-owner.md). Chưa được SePay duyệt
ứng dụng OAuth thì không triển khai kết nối nhiều tài khoản.

Tài khoản ngân hàng nhận cọc là tài khoản của người sáng lập/dự án. Tài
khoản trong hồ sơ chủ sân không thay QR trên checkout. Khi bàn giao, cập
nhật ba biến QR, `SEPAY_WEBHOOK_API_KEY`, tài khoản được chọn trong SePay và
URL webhook; deploy lại để biến public được đưa vào bundle.

Hoàn cọc và chuyển tiền cho chủ sân chưa tự động. Cần thống nhất người thực
hiện và cách đối soát; nội dung `/chinh-sach-huy` hiện còn mô tả tiền vào
thẳng chủ sân, cần đồng bộ trước khi nhận tiền thật.

Ứng dụng dùng **API Key của webhook**, không cần API Token dùng để gọi API
truy vấn giao dịch của SePay.

1. Trong SePay, liên kết tài khoản ngân hàng nhận cọc nếu chưa có.
2. Vào **Webhooks → + Thêm webhook**. Đặt tên `Sân Ngon`, chọn sự kiện
   **Có tiền vào** và URL `https://<domain>/api/webhooks/sepay`.
3. Chọn đúng tài khoản ngân hàng nhận cọc. Có thể để trống bộ lọc mã thanh
   toán: ứng dụng tự dò mã `SANxxxxxx` trong nội dung chuyển khoản.
4. Ở bước **Bảo mật**, chọn **API Key**. Dùng cùng một chuỗi bí mật cho key
   trong SePay và biến `SEPAY_WEBHOOK_API_KEY` của ứng dụng. Có thể tự sinh
   chuỗi bằng `openssl rand -hex 32`; không thêm tiền tố `Apikey` vào biến.
5. Hoàn tất cấu hình cảnh báo và nhấn **Thêm**. SePay sẽ gửi header
   `Authorization: Apikey <chuỗi bí mật>`.

Cấu hình `.env.local` và các biến tương ứng trên Vercel:

```dotenv
SEPAY_WEBHOOK_API_KEY=<key giống trong webhook SePay>
NEXT_PUBLIC_SEPAY_BANK=<tên ngân hàng khớp gateway SePay gửi, ví dụ MBBank>
NEXT_PUBLIC_SEPAY_ACCOUNT=<số tài khoản nhận cọc>
NEXT_PUBLIC_SEPAY_ACCOUNT_NAME=<tên chủ tài khoản>
```

Khởi động lại app khi đổi `.env.local`; trên Vercel cần deploy lại, đặc biệt
với các biến `NEXT_PUBLIC_` được đóng vào bundle lúc build. Không commit key.

Trong chi tiết webhook, bấm **Gửi thử**, rồi xem **Nhật ký webhooks**. Phản hồi
thành công phải có HTTP `200` và JSON `success: true`. Payload mẫu không khớp
mã đơn sẽ được bỏ qua, nên bước này chỉ kiểm tra kết nối và xác thực, chưa
chứng minh đã thanh toán một đơn thật. Sai key trả `401`, database lỗi trả
`500` để SePay thử lại.

Kiểm tra các phản hồi webhook an toàn, không xác nhận đơn hay chuyển tiền:

```bash
node scripts/check-sepay-webhook.mjs http://localhost:3000
```

Nguồn: [Hướng dẫn webhook SePay](https://docs.sepay.vn/tich-hop-webhooks.html).

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

Email kết quả duyệt hồ sơ chủ sân dùng `RESEND_API_KEY` và `EMAIL_FROM`.
Tại lần rà ngày 25/09/2026, phần gửi email báo đơn mới từ webhook SePay còn
là thay đổi local chưa commit; chỉ đưa vào kịch bản sau khi task đó đã được
kiểm tra và push. Người chơi xem thông báo đơn trên website; email xác thực
Auth là luồng riêng, vẫn cần SMTP.

## 8. Chạy và kiểm tra

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run ci
```

`npm run ci` chạy cả lint, typecheck và build. Với thay đổi chỉ tài liệu,
kiểm tra diff, đường dẫn và lệnh được nhắc đến; không cần chạy lại build app.
Repo chưa có bộ test nghiệp vụ tự động. Trước demo, kiểm tra thủ công trong
môi trường thử:

| Luồng | Kết quả cần thấy |
| --- | --- |
| Đăng ký/đăng nhập/đăng xuất | OTP xác nhận email hoạt động; Google nếu bật; đăng xuất xóa phiên |
| Hồ sơ chủ sân | Người chưa duyệt chưa tạo được cụm; admin đọc được giấy tờ và duyệt/từ chối |
| Tạo cụm và ảnh | Nháp chưa hiện ở tìm sân; lưu 3–8 ảnh thật thì công khai, có sân con và giá |
| Tìm và đặt | Bộ lọc/số khung trống khớp lịch ngày đã chọn; tiền cọc khớp giá SQL |
| Hai người chọn cùng khung | Chỉ một đơn giữ chỗ thành công; người còn lại nhận thông báo chọn giờ khác |
| Giữ chỗ hết hạn | Sau 15 phút, khung mở lại; về trang chủ không hủy, nút hủy trả lịch ngay |
| Tiền cọc | Đủ tiền và đúng mã xác nhận đơn; gửi lại cùng mã giao dịch không tạo thanh toán trùng |
| Tiền đến muộn/thiếu | Muộn không khôi phục đơn và có khoản cần hoàn; thiếu không xác nhận đơn |
| Xác nhận tay | Chủ sân xác nhận được đơn còn hạn sau khi kiểm tra tiền; đơn hết hạn bị từ chối |
| Hủy và hoàn | Trước mốc 2 giờ có khoản cần hoàn, muộn không; đánh dấu đã hoàn chỉ sau khi chuyển tiền |
| Khóa lịch | Khung khóa không đặt được; không khóa khoảng đang có đơn; mở lại trả lịch trống |
| Thông báo | Checkout cập nhật realtime; thông báo của đúng tài khoản; Telegram tới chủ sân đã kết nối |

Mốc hủy 2 giờ là giá trị tạm, chưa được chủ sân chốt. Các thử nghiệm thanh
toán dùng ngân hàng/môi trường thử đã thống nhất và lưu mã đơn để đối soát.
HTTP 200 từ webhook chỉ chứng minh đã nhận request, không chứng minh đơn
được xác nhận: cần đọc `result.reason` và xem trạng thái đơn.

Repo có Dockerfile/Compose phụ trợ, nhưng luồng phát triển và deploy demo
trong tài liệu này dùng Node.js, Supabase từ xa và Vercel.

## 9. Deploy Vercel

Link project rồi kéo biến development bằng Vercel CLI nếu cần.
Trước khi chạy `env:pull`, lưu bản cấu hình local cần giữ: lệnh ghi vào
`.env.local`. Không đưa file này vào git.

```bash
npm run vercel:login
npm run vercel:link
npm run env:pull
```

Trên Vercel, khai báo các biến runtime tương ứng trong `.env.example`, đặt
`NEXT_PUBLIC_SITE_URL` là domain thật và cập nhật Supabase Redirect URLs. Sau
khi deploy, cập nhật URL webhook SePay và Telegram về domain production.

Trình tự triển khai: xem `db:status`/`db:dry`, áp dụng migrations đã duyệt,
kiểm tra cron/realtime, khai báo biến trên Vercel, deploy rồi kiểm tra đăng
nhập → tìm sân → đặt → nhận cọc trên domain thật. Không coi build thành công
là bằng chứng Auth, Storage hay webhook đã được cấu hình đúng.
