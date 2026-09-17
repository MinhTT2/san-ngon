# Sân Ngon — bối cảnh cho agent viết code

Đọc hết file này trước khi sửa bất cứ thứ gì. Nó giải thích **vì sao** code trông như hiện tại, để bạn không "sửa" đúng những chỗ cố ý.

## Sản phẩm

Marketplace hai phía đặt sân thể thao ở Hà Nội: bóng đá, cầu lông, pickleball, tennis. Người chơi xem lịch trống theo thời gian thực rồi chốt sân bằng tiền cọc chuyển khoản. Chủ sân không phải nghe điện thoại.

**Đây là sản phẩm web, không phải app.** Bố cục desktop là bố cục chính, điện thoại là bản rút gọn. Viết Tailwind theo hướng mobile-first nhưng thiết kế nghĩ từ desktop xuống.

Bối cảnh: một người sáng lập thuê Daniel viết phần kỹ thuật. Daniel cũng dùng bản này nộp đồ án môn khởi nghiệp. Deadline demo **28/09/2026**, một người code.

Mọi quyết định kiến trúc đều nghiêng về "ít thứ có thể hỏng" chứ không phải "đúng chuẩn kỹ thuật".

## Năm nguyên tắc không được phá

1. **Logic nghiệp vụ nằm trong Postgres, không nằm trong TypeScript.** Tính giá, kiểm khung trống, tạo đơn, xác nhận thanh toán đều là hàm SQL. Tầng Next.js chỉ xác thực đầu vào, gọi hàm, dịch lỗi sang tiếng Việt.

2. **Chống đặt trùng bằng ràng buộc loại trừ GiST trên `bookings`.** Không bao giờ thay bằng `select ... if empty then insert` — có khe hở race condition và nó chắc chắn lộ ra khi demo. Đây cũng là lý do dự án **không dùng ORM**: Prisma không diễn đạt được ràng buộc này.

3. **Giá do server tính.** `create_booking` tra `price_rules` rồi đóng băng vào `bookings.total_amount`. Không nhận số tiền từ client.

4. **Mọi quy đổi múi giờ nằm trong SQL** bằng `at time zone 'Asia/Ho_Chi_Minh'`. Database lưu `timestamptz` UTC. Frontend chỉ format, tuyệt đối không cộng trừ giờ bằng JavaScript.

5. **`SUPABASE_SERVICE_ROLE_KEY` chỉ dùng trong `app/api/webhooks/sepay/route.ts`.** Nó bỏ qua toàn bộ RLS.

## Cấu trúc route

```
app/
  layout.tsx                   html, body, globals.css
  (site)/                      nhóm route có header và footer
    layout.tsx
    page.tsx                   LANDING PAGE, trang chủ
    tim-san/                   danh sách cụm sân
    san/[slug]/                lịch một cụm sân
    don-cua-toi/               bảng trên desktop, thẻ trên điện thoại
    chu-san/                   lưới 7 ngày trên desktop
    dang-nhap/                 Google và email OTP
  dat-san/[code]/              THANH TOÁN — cố ý nằm ngoài (site)
  api/bookings/route.ts
  api/webhooks/sepay/route.ts
  auth/callback/route.ts
```

**Trang thanh toán không có header và footer.** Đó là lựa chọn, không phải quên: trang checkout bớt đường thoát càng tốt. Đừng "sửa" bằng cách kéo nó vào nhóm `(site)`.

## Thư viện dùng chung

```
lib/
  constants.ts     hằng số nghiệp vụ, nhãn môn, thông báo lỗi tiếng Việt
  types.ts         kiểu dữ liệu khớp với bảng
  format.ts        tiền, giờ, ngày — chỉ format, không tính
  sepay.ts         URL ảnh QR, dò mã đơn trong nội dung chuyển khoản
  notify.ts        Telegram và email, không bao giờ ném lỗi
  use-availability.ts  một nguồn dữ liệu cho cả hai bố cục lưới
  supabase/        client, server, admin
components/
  slot-cell.tsx            ô khung giờ, 4 trạng thái
  slot-picker-mobile.tsx   giờ theo hàng dọc
  slot-picker-desktop.tsx  sân theo hàng ngang, cả ngày một khung hình
  booking-form.tsx         tên, số điện thoại, ghi chú
  site-header.tsx          header trắng dùng chung, có mark
  site-footer.tsx
  pitch-night.tsx          minh họa hero — THAY BẰNG ẢNH THẬT khi có
  pitch-thumb.tsx          hình mặt sân cho thẻ sân
  status-badge.tsx
```

## Mô hình dữ liệu

`profiles → venues → courts → price_rules`, và `courts → bookings → payments`, `bookings → notifications`.

Đơn gắn vào **sân con** (`courts`), không phải cụm sân — khung giờ bị chiếm là của một sân cụ thể. Muốn biết đơn thuộc cụm nào thì đi qua `courts.venue_id`.

Một đơn đặt **đúng một sân**. Nhóm muốn hai sân cùng giờ phải tạo hai đơn. Đánh đổi có ý thức (DB-09).

`sport` nằm ở cấp sân con nên một địa chỉ trộn nhiều môn được: sân bóng và sân cầu lông cùng một cụm, mỗi sân bảng giá riêng, lịch riêng.

`open_time` và `close_time` có ở cả `venues` và `courts`. Bản ở `courts` nullable — luôn dùng `coalesce(c.open_time, v.open_time)`.

## Luồng thanh toán

Mã đơn dạng `SANxxxxxx` (6 ký tự, bỏ O I 0 1) nằm trong nội dung chuyển khoản. **Đó là toàn bộ cơ chế đối soát** — không có callback URL, không có chữ ký.

SePay bắn webhook → `extractRefCode` dò mã bằng regex → `confirm_payment` đối chiếu → đổi trạng thái đơn → Telegram báo chủ sân.

Trang `/dat-san/[code]` không polling. Nó đăng ký realtime trên chính dòng đơn đó.

Idempotent theo `payments.bank_tx_id` unique. SePay retry tới 7 lần.

Webhook luôn trả 200 khi bỏ qua giao dịch. Chỉ 401 khi sai API key, 500 khi database lỗi.

**Tài khoản nhận cọc là của người sáng lập, không phải của Daniel.** Chính họ đăng ký SePay bằng ngân hàng của họ và đưa lại API key. Trong lúc dựng thì test bằng tài khoản của Daniel, đổi ba biến môi trường khi bàn giao, không sửa dòng code nào.

## Hằng số

| Thứ | Giá trị | Ở đâu |
| --- | --- | --- |
| Giữ chỗ | 15 phút | `bookings.expires_at`, `HOLD_MINUTES` |
| Cọc | 30% | `venues.deposit_pct`, theo từng cụm sân |
| Khung liền nhau tối đa | 3 | `MAX_SLOTS` và `use-availability` |
| Đơn chờ tối đa mỗi người | 2 | `MAX_PENDING` và `create_booking` |
| Đặt trước tối đa | 30 ngày | `venues.booking_horizon_days` |
| Giờ vàng | 16:00–21:00 | chỉ để tô màu, giá thật ở `price_rules` |
| Hạn hủy được hoàn cọc | 2 giờ — **CHƯA CHỐT** | `CANCEL_WINDOW_HOURS`, chờ hỏi chủ sân |

## Thiết kế

Token màu khai báo trong `app/globals.css`, đồng bộ với design system riêng.

Xanh `pitch` `#0F3D2E` là màu mặt cỏ ban đêm dưới đèn cao áp — sẫm, ngả lam. Đừng đổi sang xanh lá tươi mặc định của framework.

**Vàng hổ phách chỉ dùng cho giờ vàng và trạng thái chờ.** Nó mang thông tin, không trang trí. Không có màu nào khác được thêm vào lưới lịch mà không khai báo token trước.

Hai họ chữ: Bricolage Grotesque cho tiêu đề, Be Vietnam Pro cho phần còn lại. Cả hai có dấu tiếng Việt đầy đủ. Không dùng Inter hay Roboto — dấu mũ chạm nhau ở cỡ 12–13px.

Không đổ bóng ở đâu cả. Viền 1px và nền phẳng.

`pitch-night.tsx` là hình tạm. Khi có ảnh thật của cụm sân đã onboard, chụp khoảng 18h lúc đèn đã bật, thay vào đúng chỗ đó. Không dùng ảnh stock.

## Còn thiếu, theo thứ tự ưu tiên

- [ ] Trang `/dang-ky-san`: form đăng ký cụm sân, có ô tài khoản nhận cọc
- [ ] Trang trạng thái hồ sơ chờ duyệt, bốn bước
- [ ] Nút hủy đơn trong `/don-cua-toi`
- [ ] Bảng thông báo: badge chưa đọc trên header, trang danh sách
- [ ] Danh sách cần hoàn cọc cho chủ sân, lọc `refund_status = 'needed'`
- [ ] Nút chủ sân xác nhận tay khi webhook hỏng
- [ ] Bộ lọc thật ở `/tim-san` — hiện `?sport=` và `?q=` chỉ hiển thị lại, chưa lọc
- [ ] Badge số khung còn trống trên thẻ sân
- [ ] CRUD bảng giá cho chủ sân, hoặc nhập tay bằng SQL nếu hụt giờ
- [ ] `confirm_payment` nên trả thêm `owner_id` để ghi đúng dòng notification thất bại

## Đã cố tình cắt

Bản đồ, đánh giá sao, tìm đối ghép kèo, hoàn tiền tự động, ví nội bộ, trang quản trị riêng, test tự động, Zalo OA, email cho người chơi, upload ảnh sân.

Đừng thêm lại nếu không còn dư thời gian. Danh sách "còn thiếu" ở trên đi trước.

## Ràng buộc môi trường

Không Docker, không ORM, không thư viện quản lý state, không react-hook-form. Tailwind v4, token trong `app/globals.css`. Deploy Vercel, database Supabase region Singapore.
