# Sân Ngon — bối cảnh cho agent viết code

Đọc hết file này trước khi sửa bất cứ thứ gì. Nó giải thích **vì sao** code trông như hiện tại, để bạn không "sửa" đúng những chỗ cố ý.

## Sản phẩm

Marketplace hai phía đặt sân thể thao ở Hà Nội: bóng đá, cầu lông, pickleball, tennis. Người chơi xem lịch trống theo thời gian thực rồi chốt sân bằng tiền cọc chuyển khoản. Chủ sân không phải nghe điện thoại.

**Đây là sản phẩm web, không phải app.** Bố cục desktop là bố cục chính, điện thoại là bản rút gọn. Viết Tailwind theo hướng mobile-first nhưng thiết kế nghĩ từ desktop xuống.

Bối cảnh: một người sáng lập thuê Daniel viết phần kỹ thuật. Daniel cũng dùng bản này nộp đồ án môn khởi nghiệp. Deadline demo **28/09/2026**, một người code.

Mọi quyết định kiến trúc đều nghiêng về "ít thứ có thể hỏng" chứ không phải "đúng chuẩn kỹ thuật".

## Sáu nguyên tắc không được phá

1. **Logic nghiệp vụ nằm trong Postgres, không nằm trong TypeScript.** Tính giá, kiểm khung trống, tạo đơn, xác nhận thanh toán đều là hàm SQL. Tầng Next.js chỉ xác thực đầu vào, gọi hàm, dịch lỗi sang tiếng Việt.

2. **Chống đặt trùng bằng ràng buộc loại trừ GiST trên `bookings`.** Không bao giờ thay bằng `select ... if empty then insert` — có khe hở race condition và nó chắc chắn lộ ra khi demo. Đây cũng là lý do dự án **không dùng ORM**: Prisma không diễn đạt được ràng buộc này.

3. **Giá do server tính.** `create_booking` tra `price_rules` rồi đóng băng vào `bookings.total_amount`. Không nhận số tiền từ client.

4. **Mọi quy đổi múi giờ nằm trong SQL** bằng `at time zone 'Asia/Ho_Chi_Minh'`. Database lưu `timestamptz` UTC. Frontend chỉ format, tuyệt đối không cộng trừ giờ bằng JavaScript.

5. **Client dùng `SUPABASE_SERVICE_ROLE_KEY` chỉ được gọi từ `app/api/webhooks/sepay/route.ts`.** Khởi tạo trong `lib/supabase/admin.ts`; nó bỏ qua toàn bộ RLS. Trang admin dùng phiên người dùng và RPC kiểm tra quyền, không dùng service role.

6. **Người đặt không được `update` thẳng bảng `bookings`.** Policy chỉ cho chủ
   sân sửa, và có cả `with check`. Thiếu `with check` thì từ trình duyệt khách
   tự đổi `status` thành `confirmed` và hạ `total_amount` về 0 — đặt sân không
   mất đồng nào. Mọi đường hủy đi qua `cancel_booking()`.

## Luồng sản phẩm hiện tại

`/dang-ky-san` là đăng ký **tài khoản chủ sân**, không còn là form tạo cụm
sân. Người dùng gửi thông tin đại diện, loại hình đăng ký, giấy tờ xác minh
và tài khoản nhận tiền; admin duyệt trong `/admin`. Khi
`owner_application_status = 'active'`, chủ sân mới được tạo cụm sân.

`create_venue` tạo cụm ở trạng thái `draft`, cùng sân con và giá chung. Chủ
sân lưu 3–8 ảnh thật qua `set_venue_images` thì cụm chuyển sang `active` và
nhận đặt. Không thêm bước duyệt từng cụm vào luồng mới. `review_venue` còn
phục vụ hồ sơ cụm `pending` từ luồng cũ.

`venue-documents` là bucket giấy tờ riêng tư, admin đọc bằng signed URL;
`venue-photos` là bucket ảnh sân công khai. Ảnh JPEG/PNG/WebP tối đa 5 MiB mỗi
ảnh, lưu đường dẫn vào `venues.images`. Không trộn hai bucket.

## Cấu trúc route

```text
app/
  layout.tsx                   html, body, globals.css
  (site)/                      header/footer của website
    page.tsx                   landing page
    tim-san/                   tìm kiếm, bộ lọc, số khung trống, phân trang
    san/[slug]/                lịch sân con và form đặt
    don-cua-toi/                đơn của người chơi
    dang-nhap/, dang-ky/        Google hoặc email/mật khẩu; OTP khi đăng ký
    dang-ky-san/               gửi và theo dõi hồ sơ chủ sân
    thong-bao/                 thông báo trong website
    chinh-sach-huy/, lien-he/   chính sách và hỗ trợ
  (owner)/                     header quản lý, sidebar, không footer
    chu-san/                   tổng quan, lịch 7 ngày, thống kê, hoàn cọc
      quan-ly/                 cụm sân, sân con, giá chung và ảnh
      lich/                    lịch từng sân, khóa/mở lại khung giờ
      don/                     danh sách đơn
    tao-cum-san/               tạo cụm sau khi tài khoản được duyệt
  admin/                       tổng quan và duyệt hồ sơ
    owners/[id]/               chi tiết hồ sơ chủ sân
  dat-san/[code]/              checkout, ngoài (site)
  api/                         xác thực đầu vào và gọi RPC
  auth/callback/route.ts       đổi code lấy phiên đăng nhập
  auth/dang-xuat/route.ts       POST, xóa phiên phía server
```

**Checkout có header riêng gọn: logo, tiến trình đặt sân và nút về trang
chủ; không có footer.** Về trang chủ không hủy giữ chỗ; muốn trả lịch ngay
phải dùng nút hủy.

## Thư viện dùng chung

```
lib/
  constants.ts     hằng số nghiệp vụ, nhãn môn, thông báo lỗi tiếng Việt
  database.types.ts  kiểu Supabase sinh bằng npm run db:types
  types.ts         kiểu nghiệp vụ và kết quả RPC
  format.ts        tiền, giờ, ngày — chỉ format, không tính
  sepay.ts         URL ảnh QR, dò mã đơn trong nội dung chuyển khoản
  notify.ts        Telegram và email, không bao giờ ném lỗi
  use-availability.ts  một nguồn dữ liệu cho cả hai bố cục lưới
  owner-management.ts  xác thực đầu vào quản lý cụm/sân con
  stats.ts        đọc kết quả thống kê SQL
  supabase/        client, server, admin
components/
  brand-mark.tsx           logo: mặt sân phối cảnh, dùng chung header/loader
  brand-loader.tsx         màn chờ, vòng cung xoay quanh mark, nền mờ
  hero-carousel.tsx        ba cảnh sân thay nhau ở hero
  pitch-scenes.tsx         bóng đá / cầu lông / pickleball — THAY BẰNG ẢNH THẬT
  reveal.tsx               hiện dần khi cuộn tới (IntersectionObserver)
  count-up.tsx             số đếm tăng dần
  slot-cell.tsx            ô khung giờ, 4 trạng thái
  slot-picker-mobile.tsx   giờ theo hàng dọc
  slot-picker-desktop.tsx  sân theo hàng ngang, cả ngày một khung hình
  booking-form.tsx         tên, số điện thoại, ghi chú
  site-header.tsx          header trắng dùng chung, có mark
  site-footer.tsx
  pitch-night.tsx          minh họa hero — THAY BẰNG ẢNH THẬT khi có
  pitch-thumb.tsx          hình mặt sân cho thẻ sân
  status-badge.tsx
  venue-gallery.tsx       ảnh thật trên trang cụm sân
  venue-photo-manager.tsx upload, sắp xếp và lưu bộ ảnh
  dashboard-sidebar.tsx  điều hướng khu chủ sân/admin
```

## Mô hình dữ liệu

`profiles → venues → courts → price_rules`, `courts → bookings → payments`,
`bookings → notifications` và `courts → court_closures`. Hồ sơ xác minh chủ
sân nằm trên `profiles`; trạng thái hồ sơ và trạng thái cụm sân là hai việc
khác nhau.

Đơn gắn vào **sân con** (`courts`), không phải cụm sân — khung giờ bị chiếm là của một sân cụ thể. Muốn biết đơn thuộc cụm nào thì đi qua `courts.venue_id`.

Một đơn đặt **đúng một sân**. Nhóm muốn hai sân cùng giờ phải tạo hai đơn. Đây là giới hạn có chủ đích của MVP.

`sport` nằm ở cấp sân con nên một địa chỉ trộn nhiều môn được: sân bóng và sân cầu lông cùng một cụm, mỗi sân bảng giá riêng, lịch riêng.

`open_time` và `close_time` có ở cả `venues` và `courts`. Bản ở `courts` nullable — luôn dùng `coalesce(c.open_time, v.open_time)`.

## Hàm SQL

| Hàm | Ai gọi được | Việc |
| --- | --- | --- |
| `search_venues`, `get_venue_calendar` | anon, authenticated | tìm sân và giới hạn ngày do SQL tính |
| `get_venue_availability` | anon, authenticated | lịch trống cả cụm; chỉ trả trạng thái, không lộ thông tin khách |
| `create_booking` | authenticated | tạo đơn, tự tính giá |
| `cancel_booking` | authenticated | hủy đơn, tự quyết cọc có được hoàn |
| `register_owner` | authenticated | gửi hồ sơ xác minh chủ sân |
| `review_owner`, `review_venue` | authenticated, kiểm tra admin trong SQL | duyệt hồ sơ chủ sân/cụm sân |
| `create_venue`, `update_venue`, `delete_venue` | authenticated, kiểm tra quyền trong SQL | quản lý cụm sân |
| `create_court`, `update_court`, `delete_court` | authenticated, kiểm tra chủ sân | quản lý sân con và giá chung |
| `set_venue_images` | authenticated, kiểm tra chủ sân | lưu bộ ảnh; công khai cụm nháp khi đủ ảnh |
| `get_owner_court_schedule`, `close_court`, `reopen_court` | authenticated, kiểm tra chủ sân | xem lịch vận hành và khóa/mở lịch |
| `confirm_payment_manual`, `mark_refund_done` | authenticated, kiểm tra chủ sân | xác nhận cọc còn hạn, đánh dấu đã hoàn |
| `get_owner_stats`, `get_admin_stats` | authenticated, kiểm tra vai trò/phạm vi | thống kê vận hành |
| `confirm_payment` | chỉ service role | webhook xác nhận tiền vào |
| `expire_pending_bookings`, `complete_past_bookings` | chỉ pg_cron | tác vụ nền |

`register_venue` còn trong SQL lịch sử; luồng mới gọi `register_owner` rồi
`create_venue`. Đọc bản định nghĩa cuối trong migrations trước khi sửa RPC,
không lấy `supabase/03_functions.sql` làm nguồn hiện tại.

## Luồng thanh toán

Mã đơn dạng `SANxxxxxx` (sau tiền tố là 6 ký tự, bỏ O I 0 1) nằm trong nội
dung chuyển khoản. Đối soát theo mã đơn, số tiền và mã giao dịch; không có
callback thanh toán qua trình duyệt. SePay gửi webhook tới endpoint của app,
xác thực bằng header API key, không dùng chữ ký payload.

SePay bắn webhook → `extractRefCode` dò mã bằng regex → `confirm_payment` đối chiếu → đổi trạng thái đơn → Telegram báo chủ sân.

Trang `/dat-san/[code]` không polling trạng thái thanh toán. Nó đăng ký
realtime trên chính dòng đơn đó. Lịch chọn sân dùng realtime, tải lại khi
focus, mỗi 15 giây và khi tới hạn giữ chỗ; đừng áp quy tắc checkout cho lịch.

`pending` chỉ chiếm lịch khi `expires_at > now()`. SQL giải phóng giữ chỗ hết
hạn trước khi tạo đơn mới; cron dọn trạng thái mỗi phút để danh sách/realtime
được cập nhật. Webhook muộn không khôi phục đơn hết hạn, mà đánh dấu cần hoàn.
Xác nhận tay cũng chỉ dùng được với đơn `pending` còn hạn.

Idempotent theo `payments.bank_tx_id` unique; phải chịu được webhook gửi lại.

Webhook luôn trả 200 khi bỏ qua giao dịch. Chỉ 401 khi sai API key, 500 khi database lỗi.

**Tài khoản nhận cọc là của dự án/người sáng lập.** Checkout dùng
`NEXT_PUBLIC_SEPAY_BANK`, `NEXT_PUBLIC_SEPAY_ACCOUNT` và
`NEXT_PUBLIC_SEPAY_ACCOUNT_NAME`; webhook dùng `SEPAY_WEBHOOK_API_KEY`.
Khi bàn giao, cập nhật cả tài khoản, key, cấu hình webhook rồi deploy lại.
Tài khoản lưu trong hồ sơ chủ sân phục vụ vận hành/đối soát, chưa tự thay QR.
Hoàn cọc và chuyển tiền cho chủ sân là thao tác thủ công, không tự động.

## Giới hạn SePay trước khi được duyệt OAuth

Demo chỉ nhận đơn cho **một chủ sân**, có thể có nhiều cụm sân. Bảng
`booking_operator` cố định chủ sân đó bằng SQL; không tự mở nhận đơn cho chủ
sân khác. Một tài khoản ngân hàng và một webhook vẫn dùng biến môi trường.
Thông tin QR phải đúng bên nhận cọc thực tế. `NEXT_PUBLIC_SEPAY_BANK` phải
khớp trường `gateway` SePay gửi (ví dụ `MBBank`, không dùng `MB`).

**Chỉ triển khai nhiều tài khoản sau khi SePay phê duyệt ứng dụng OAuth**,
cấp `client_id`, `client_secret` và quyền đọc tài khoản, đọc/ghi webhook.
Trước đó không xây giao diện OAuth, endpoint kết nối hoặc migration nhiều
tài khoản; không thay bằng cấu hình thủ công nhiều chủ sân. Giới hạn service
role hiện tại giữ nguyên. Ngoại lệ cho route OAuth chỉ áp dụng khi bắt đầu
giai đoạn đã được duyệt. Xem [vận hành một chủ sân](docs/sepay-single-owner.md).

## Hằng số

| Thứ | Giá trị | Ở đâu |
| --- | --- | --- |
| Giữ chỗ | 15 phút | `bookings.expires_at`, `HOLD_MINUTES` |
| Cọc | mặc định 30%, làm tròn lên bội số 1.000 đồng | `venues.deposit_pct`, theo từng cụm sân |
| Khung liền nhau tối đa | 3 | `MAX_SLOTS` và `use-availability` |
| Đơn chờ tối đa mỗi người | 2 | `MAX_PENDING` và `create_booking` |
| Đặt trước | mặc định 30 ngày, cấu hình 1–180 ngày | `venues.booking_horizon_days` |
| Giờ vàng | 16:00–21:00 | chỉ để tô màu, giá thật ở `price_rules` |
| Hạn hủy được hoàn cọc | 2 giờ — **CHƯA CHỐT** | `CANCEL_WINDOW_HOURS`, chờ hỏi chủ sân |

## Thiết kế

Token màu khai báo trong `app/globals.css`, đồng bộ với design system riêng.

Xanh `pitch` `#0F3D2E` là màu mặt cỏ ban đêm dưới đèn cao áp — sẫm, ngả lam. Đừng đổi sang xanh lá tươi mặc định của framework.

**Vàng hổ phách chỉ dùng cho giờ vàng và trạng thái chờ.** Nó mang thông tin, không trang trí. Không có màu nào khác được thêm vào lưới lịch mà không khai báo token trước.

Hai họ chữ: Bricolage Grotesque cho tiêu đề, Be Vietnam Pro cho phần còn lại. Cả hai có dấu tiếng Việt đầy đủ. Không dùng Inter hay Roboto — dấu mũ chạm nhau ở cỡ 12–13px.

Không đổ bóng ở đâu cả. Viền 1px và nền phẳng.

Không thêm thư viện animation. Hiệu ứng trong app chỉ cần IntersectionObserver
và vài keyframe CSS trong `globals.css`; framer-motion nặng gần 50kb cho bấy
nhiêu là không đáng. Mọi hiệu ứng ẩn-rồi-hiện phải mặc định ĐÃ HIỆN trong CSS,
JS mới giấu đi — không thì JS hỏng là nội dung tàng hình.

`pitch-scenes.tsx` và `pitch-night.tsx` là hình tạm. Khi có ảnh thật của cụm sân đã onboard, chụp khoảng 18h lúc đèn đã bật, thay vào đúng chỗ đó. Không dùng ảnh stock.

## Trạng thái phạm vi

Đã có trong code: xác minh chủ sân và duyệt admin; tạo/quản lý cụm và sân
con; upload ảnh thật; khóa lịch; thống kê; lọc sân và số khung trống; hủy đơn;
đăng xuất; thông báo; xác nhận tiền tay; danh sách và xác nhận hoàn cọc.

Tại lần rà tài liệu **25/09/2026**, giao diện bảng giá theo ngày/giờ ở
`/chu-san/bang-gia/[id]`, quản lý tài khoản ở `/admin/users` và email báo đơn
mới từ webhook còn có thay đổi local chưa commit. Không coi các phần này đã
bàn giao chỉ vì có file trên máy. Giá chung đã sửa được trong quản lý sân;
email kết quả duyệt hồ sơ chủ sân đã có. Cập nhật mục này khi các task đó
được kiểm tra và push.

## Việc cần chốt trước demo

- Chốt mốc hủy được hoàn cọc với chủ sân; hiện cả SQL và giao diện dùng 2 giờ.
- Đồng bộ nội dung `/chinh-sach-huy` với checkout: trang này còn nói cọc
  chuyển thẳng cho chủ sân, trong khi QR dùng tài khoản của dự án. Chốt người
  thực hiện hoàn/chuyển tiền và cách đối soát trước khi nhận tiền thật.
- Kiểm tra luồng xác minh → tạo cụm nháp → lưu ảnh → tìm sân → đặt/cọc → hủy
  và hoàn theo [hướng dẫn demo](docs/dev-setup.md#8-chạy-và-kiểm-tra).
- Hoàn tất và kiểm tra các task bảng giá/tài khoản/email đang làm trước khi
  đưa vào kịch bản demo; chưa cần mở rộng phạm vi.

## Đã cố tình cắt

Bản đồ, đánh giá sao, tìm đối ghép kèo, hoàn tiền tự động, ví nội bộ, Zalo OA,
email thông báo đơn cho người chơi và app native. Email xác thực tài khoản
không thuộc phần bị cắt. Chưa đầu tư bộ test tự động nghiệp vụ; vẫn chạy
lint, typecheck, build và kiểm tra thủ công luồng chính.

Upload ảnh sân và admin tối thiểu đã được bổ sung vào MVP, không còn thuộc
phần cắt. Không mở rộng thành hệ thống quản trị toàn diện trước demo.

## Ràng buộc môi trường

Luồng chính dùng Node.js 24.x và Supabase từ xa, không yêu cầu Docker.
Repo có Dockerfile/Compose phụ trợ; không lấy chúng làm điều kiện phát triển.
Không ORM, không thư viện quản lý state, không react-hook-form. Tailwind v4,
token trong `app/globals.css`. Deploy Vercel, database Supabase region Singapore.

`supabase/migrations/` là nguồn thay đổi schema/RLS/functions. Bộ SQL đánh số
cũ và seed demo không thay thế migrations hiện tại. Thiết lập cron/realtime
và dữ liệu demo theo [docs/dev-setup.md](docs/dev-setup.md).

## Quy trình giao việc

Khi hoàn thành một task và các kiểm tra cần thiết đều đạt, commit thay đổi rồi push ngay lên `origin/main`. Không để task đã xong nằm lại chỉ ở máy local.
