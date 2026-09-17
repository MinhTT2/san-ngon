# Sân Ngon

Nền tảng đặt sân bóng ở Hà Nội. Người chơi tự xem lịch trống và chốt sân bằng tiền cọc chuyển khoản, chủ sân không phải trực điện thoại.

Đây là **xương sườn**: tầng dữ liệu hoàn chỉnh, các route API lõi, lưới lịch hai bố cục, và kênh thông báo. Phần giao diện còn nhiều `TODO` kèm ngày trong kế hoạch.

## Chạy lần đầu

```bash
npm install
cp .env.example .env.local   # điền giá trị thật
npm run dev
```

## Supabase

Chạy lần lượt trong SQL Editor, không gộp:

1. `supabase/01_schema.sql`
2. `supabase/02_rls.sql`
3. `supabase/03_functions.sql`
4. Đăng nhập vào app một lần để có user, rồi `supabase/04_seed.sql`
5. Bật extension `pg_cron` ở Database › Extensions, rồi `supabase/05_cron.sql`

Kiểm tra tầng dữ liệu đã đúng:

```sql
select * from get_venue_availability(
  (select id from venues where slug = 'san-my-dinh'),
  current_date + 1
) limit 20;
```

Ra danh sách khung giờ kèm giá là xong. Ra rỗng nghĩa là seed chưa chạy.

## SePay

Đây là mắt xích duy nhất phụ thuộc bên ngoài và có thể mất vài ngày duyệt. Làm trước mọi thứ khác.

1. Đăng ký tại sepay.vn, liên kết tài khoản ngân hàng **cá nhân** (MB, OCB, TPBank, ACB, VPBank).
2. Webhook → URL `https://<domain>/api/webhooks/sepay`, xác thực **API Key**, sự kiện **tiền vào**.
3. Test local bằng `npx ngrok http 3000`, dán URL ngrok vào SePay.
4. Tự chuyển khoản 2.000đ với nội dung `SANTEST01`, xem log.

## Telegram

1. Nhắn `/newbot` cho @BotFather, lấy token.
2. Chủ sân nhắn cho bot một lần — không có cách nào nhắn trước cho người lạ.
3. Lấy `chat_id` qua `https://api.telegram.org/bot<token>/getUpdates`, lưu vào `profiles.telegram_chat_id`.

Hệ thống phải chạy được cả khi chưa có `chat_id`: `sendTelegram` trả về `NOT_CONFIGURED` và không ném lỗi.

## Nguyên tắc không được phá

**Giá tính ở database, không ở TypeScript.** `create_booking` tự tra `price_rules`. Client gửi `total` lên cũng bị bỏ qua.

**Chống đặt trùng bằng ràng buộc loại trừ GiST**, không bằng kiểm tra trong code. Đây là lý do dự án không dùng ORM.

**Mọi quy đổi múi giờ nằm trong SQL.** Frontend chỉ format, không tính toán ngày giờ.

**`SUPABASE_SERVICE_ROLE_KEY` chỉ xuất hiện trong route webhook.** Không bao giờ import vào component.

## Màn hình đã có

| Đường dẫn | Màn |
| --- | --- |
| `/` | Landing page |
| `/tim-san` | Danh sách cụm sân |
| `/san/[slug]` | Lịch cụm sân, tự đổi bố cục theo bề rộng |
| `/dat-san/[code]` | QR, đếm ngược, tự nhảy khi tiền vào |
| `/don-cua-toi` | Bảng trên desktop, thẻ trên điện thoại |
| `/chu-san` | Lưới 7 ngày và đơn hôm nay |
| `/dang-nhap` | Google và email OTP |

Luồng người chơi đi được từ đầu tới cuối: vào landing, tìm sân, chọn giờ, nhập thông tin, quét QR, nhận xác nhận, xem lại đơn.

Đây là sản phẩm **web**, không phải app. Bố cục desktop là chính, điện thoại là bản rút gọn.
