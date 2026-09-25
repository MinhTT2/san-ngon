# SePay: demo một chủ sân và chuyển sang OAuth

Hiện chỉ **một chủ sân** được nhận đơn, có thể có nhiều cụm sân. Tiền cọc
được chuyển vào một tài khoản, nhận giao dịch qua một webhook SePay. SePay đã cấp OAuth trong ticket #6725 ngày 25/09/2026. Demo vẫn chạy luồng
cũ cho đến khi chủ sân hoàn tất kết nối.

## Chọn chủ sân vận hành

Migration `20260925000001_single_booking_operator.sql` chọn chủ sân hiện tại
nếu có đúng một chủ sân sở hữu cụm sân `active`. Nếu database mới hoặc có
nhiều chủ sân hoạt động, không tự chọn: đơn mới bị chặn đến khi cấu hình
bằng SQL. Không thay đổi đơn hoặc hồ sơ đã có.

Sau khi tạo tài khoản chủ sân, chọn người nhận đơn trong SQL Editor:

```sql
-- Thay email thật của chủ sân demo.
insert into public.booking_operator (owner_id)
select p.id from public.profiles p join auth.users u on u.id = p.id
where lower(u.email) = lower('owner@example.com') and p.role = 'owner'
on conflict (singleton) do nothing;

-- Phải có đúng một dòng và đúng người trước khi nhận tiền.
select u.email, p.payout_bank, p.payout_account
from public.booking_operator o join public.profiles p on p.id = o.owner_id
join auth.users u on u.id = p.id;
```

Bảng chỉ có tối đa một dòng; trình duyệt không được đọc hoặc sửa trực tiếp.
`venue_accepts_bookings` chỉ trả boolean để trang sân biết có cho đặt không.
Trigger trên `bookings` chặn đơn của chủ sân khác, kể cả gọi RPC trực tiếp.
Các chủ sân khác vẫn gửi hồ sơ/quản lý sân nhưng trang sân chưa mở form đặt.

Không đổi operator hoặc tài khoản nhận cọc khi còn đơn chờ chuyển khoản hay
giao dịch cần đối soát. Không dùng việc đổi operator để vận hành luân phiên
nhiều tài khoản ngân hàng trong giai đoạn demo.

## Tài khoản và webhook

Theo mục SePay trong [hướng dẫn thiết lập](dev-setup.md#6-sepay), cấu hình:

- `SEPAY_WEBHOOK_API_KEY`: khóa riêng của webhook hiện tại.
- `NEXT_PUBLIC_SEPAY_BANK`: tên ngân hàng đúng trường `gateway` SePay gửi,
  ví dụ `MBBank`, không dùng tên viết tắt `MB`.
- `NEXT_PUBLIC_SEPAY_ACCOUNT`: số tài khoản nhận cọc thật, 6–30 chữ số.
- `NEXT_PUBLIC_SEPAY_ACCOUNT_NAME`: tên chủ tài khoản thực tế.

Đối chiếu với bên nhận tiền của chủ sân demo trước khi nhận cọc. Tài khoản
trong hồ sơ chủ sân không tự thay QR. Khi đổi biến public cần build/deploy
lại để checkout và webhook cùng dùng thông tin mới. Không thay cấu hình
ngân hàng chỉ để vượt kiểm tra.

Webhook chỉ xử lý tiền vào đúng ngân hàng và số tài khoản đã cấu hình.
Sai người nhận trả HTTP 200, `success: true`, `skipped: wrong_receiver`;
payload không hợp lệ cũng bị bỏ qua. Mã giao dịch và số tiền phải hợp lệ;
không làm tròn giao dịch thiếu tiền lên thành đủ cọc. Sai khóa trả 401,
database lỗi trả 500. Giữ nội dung chuyển khoản `SANxxxxxx` như checkout.

## Kiểm tra và nghiệm thu

```bash
npm run setup:check
npm run ci
npx supabase db query --linked --file scripts/check-booking-holds.sql
node scripts/check-sepay-webhook.mjs http://localhost:3000
```

SQL tạo dữ liệu kiểm tra trong transaction rồi rollback: một chủ sân được
nhận đơn ở nhiều cụm, chủ sân khác bị chặn, giá server, thiếu tiền không xác
nhận, retry không trùng thông báo, tiền đến muộn không khôi phục lịch.
Script webhook chỉ gửi payload bị bỏ qua, không xác nhận đơn thật.

Nghiệm thu thực tế trên môi trường thử:

1. Tạo đơn, kiểm tra QR và tên người nhận trong ứng dụng ngân hàng.
2. Người giữ tài khoản chuyển một khoản nhỏ đúng số cọc và mã đơn.
3. Mở checkout và đơn của người chơi: trạng thái tự đổi sau webhook; mất
   mạng rồi quay lại vẫn thấy trạng thái đúng.
4. Gửi lại webhook cùng giao dịch: không có thêm thông báo hoặc thanh toán.
5. Kiểm tra đơn ở trang chủ sân; nếu webhook hỏng, xác nhận tay chỉ áp dụng
   khi đã kiểm tra tiền vào và đơn còn thời gian giữ chỗ.

Chuyển khoản thật do người giữ tài khoản thực hiện. Các script không thay
thế bước này. Danh sách đơn và lịch chủ sân đã có realtime, tải lại khi nối
mạng hoặc quay lại tab.

## OAuth đã được duyệt

Scopes: `bank-account:read webhook:read webhook:write`.
Redirect đăng ký: `https://san-ngon.vercel.app/api/sepay/callback`.
Bốn biến server trong `.env.example` phải có trên production. Không đưa
client secret/token vào chat, Git hay biến `NEXT_PUBLIC_*`. Khóa mã hóa
64 ký tự hex phải được sao lưu; đổi khóa sẽ làm token hiện tại không đọc được.

Áp dụng migration `20260925000002_sepay_oauth.sql`, rồi gọi RPC quản trị
`initialize_legacy_receiver(p_bank,p_account,p_name)` với đúng ba biến
ngân hàng hiện tại. Không đổi tài khoản trong lúc chuyển đổi.

Chủ sân đã được duyệt mở `/chu-san/thanh-toan`, cấp quyền SePay, chọn tài
khoản đang hoạt động. Hệ thống tạo webhook có khóa riêng, đọc lại xác minh
trước khi đánh dấu sẵn sàng. Thử lại sẽ tái sử dụng webhook đúng URL/khóa.
Một chủ sân dùng một tài khoản; hiện chưa hỗ trợ đổi sang ngân hàng khác.
Token hết hạn được refresh phía server; từ chối quyền hoặc refresh lỗi thì
chủ sân kết nối lại. Ngắt kết nối bị chặn khi còn đơn chờ cọc còn hạn.

Chủ sân demo tiếp tục hoạt động qua cấu hình cũ đến khi tự kết nối OAuth.
Các chủ sân khác chưa nhận đơn dù đã kết nối: cờ `multi_owner_enabled`
mặc định tắt. Sau kiểm thử SQL, OAuth thực tế, QR và chuyển khoản thật đạt,
quản trị mới chạy:

```sql
update public.booking_operator set multi_owner_enabled = true where singleton;
```

Muốn dừng nhận đơn mới từ chủ sân thứ hai, đặt cờ lại false. Không xóa
kết nối, token hoặc webhook để các đơn đã tạo tiếp tục đối soát. Giữ
webhook cũ và cấu hình cũ đến khi xử lý xong mọi đơn/giao dịch cũ.

Các kiểm tra tự động bổ sung:

```bash
node scripts/check-sepay-crypto.mjs
npx supabase db query --linked --file scripts/check-booking-holds.sql
```

SQL rollback kiểm tra hai chủ sân, snapshot người nhận, webhook A không
xác nhận B, retry cả thiếu cọc, chặn đọc token/sửa kết nối, không quay lại
luồng cũ khi ngắt OAuth, và cờ nghiệm thu trước mở nhiều chủ sân.
