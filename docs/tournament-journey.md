# Giải đấu: flow end-to-end và trải nghiệm người dùng

## Phạm vi

Đánh giá và hoàn thiện ngày 05/10/2026. Tính năng hiện tại giải quyết **tổ chức,
đăng ký, duyệt suất, thu cọc, hoàn tiền và quyết toán**. Đây chưa phải phần mềm
xếp nhánh, chia bảng, ghi tỉ số hoặc công bố nhà vô địch. Lịch trận và thể thức
thi đấu được công bố trong thể lệ; không hứa những công cụ chưa có.

Một giải giữ một sân con trong toàn bộ khoảng tổ chức. Một tài khoản có một
đăng ký còn hiệu lực cho mỗi giải; thể lệ phải ghi một suất là người hay đội.
Đăng ký lại tạo mã cọc mới, không làm mất giao dịch và nghĩa vụ hoàn của lần cũ.

## Vai trò

| Vai trò | Trách nhiệm | Không được làm |
| --- | --- | --- |
| Người tham gia | Xem thể lệ, gửi đăng ký, đóng cọc, tự hủy, kiểm tra tiền hoàn | Tự duyệt, tự xác nhận cọc, xem liên hệ người khác |
| Người tổ chức | Đề xuất giải, sửa khi chưa công khai, duyệt/từ chối/hủy suất, nhận hoặc trả quyết toán | Xác nhận chủ sân đã thu/hoàn tiền thay chủ sân |
| Chủ sân | Tự công khai tại sân mình, quản lý giải tại sân, nhận cọc, thu phần còn lại, hoàn và quyết toán | Duyệt đề xuất người chơi thay admin |
| Admin | Bố trí sân, duyệt đề xuất người chơi, chốt thỏa thuận, hỗ trợ đối soát | Bỏ qua kiểm tra quyền, lịch trống hoặc điều kiện nhận tiền trong SQL |

Người tổ chức có quyền quản lý riêng cho giải, không được đổi role tài khoản.
Chủ sân và người tổ chức có thể là cùng một người; trường hợp này không có
chuyển quyết toán giữa hai bên và tiền thuê nội bộ bằng 0.

## Flow End-to-End

### 1. Tạo hoặc đề xuất giải

Chủ sân mở `/giai-dau/tao`, chọn sân đang hoạt động của mình, nhập lịch, quy mô,
hạn đăng ký, hạn cọc, lệ phí/cọc và thể lệ. Trước khi công khai phải xác nhận
lịch và chính sách sẽ cố định. SQL kiểm tra quyền, môn, lịch trống, tình trạng
nhận tiền/phí website rồi công khai và giữ lịch trong một giao dịch. Thất bại
không để lại một giải công khai hoặc một khung giữ sân dở dang.

Người chơi dùng cùng trang để gửi đề xuất địa điểm. Đề xuất `pending` chưa
hiển thị trong khám phá công khai. Người đề xuất theo dõi ở tab **Tôi tổ chức**,
có thể sửa/gửi lại khi đang chờ hoặc bị từ chối.

### 2. Bố trí sân và chốt thỏa thuận

Admin mở đề xuất ở `/admin/giai-dau`, chọn sân đúng môn, ghi tiền thuê, tiền thuê
khi hủy, nội dung thỏa thuận và xác nhận hai bên đã đồng ý. Duyệt thành công
công khai giải, giữ lịch sân và cấp quyền quản lý cho người đề xuất. Nếu từ
chối, chỉ cần lý do, không bắt nhập một thỏa thuận thuê sân giả.

Cọc luôn về chủ sân được chọn, không về người đề xuất. Giá thuê của giải là
thỏa thuận riêng, không phải giá đơn đặt sân thường.

### 3. Khám phá và gửi đăng ký

Người chơi vào `/giai-dau`, lọc môn và thời điểm rồi mở giải. Trang chi tiết
hiển thị lịch, sân, thể lệ, lệ phí, cọc, phần còn lại và chính sách hủy. Liên kết
sân mở trang sân thực tế. Bấm đăng ký yêu cầu đăng nhập và giữ đúng trang đích.

Điền tên người/đại diện, điện thoại, khu vực, tên đội và ghi chú, xác nhận đã
đọc thể lệ rồi gửi. Điện thoại `+84` được chuẩn hóa thành `0`, SQL kiểm tra lại.
Đăng ký `pending` **chưa giữ suất, chưa có QR và chưa chuyển tiền**.

### 4. Duyệt suất

Chủ sân hoặc người tổ chức mở tab **Người tham gia**, tìm theo tên/đội/điện
thoại và lọc trạng thái. Đăng ký chờ duyệt được mở sẵn; duyệt và từ chối là hai
thao tác tách biệt. Từ chối có lý do hiển thị cho người tham gia.

Duyệt giữ một suất và đóng băng lệ phí/cọc, chủ sân nhận tiền, ngân hàng và số
tài khoản. Hạn cọc riêng bằng khoảng giữ suất sau duyệt nhưng không vượt hạn
cọc cuối của giải. SQL khóa và kiểm tra quy mô, không thể duyệt vượt số suất.
Không yêu cầu cọc thì duyệt xong là xác nhận tham gia ngay.

### 5. Đóng cọc và tự động xác nhận

Người chơi thấy tiến trình **Đã gửi → Được duyệt → Xác nhận cọc**, QR, đúng người
nhận, số tiền, mã `GIAI` và hạn cọc ngay gần đầu trang. Tab **Đã đăng ký** có
lịch, địa điểm, trạng thái và hạn cọc; cả danh sách lẫn chi tiết cập nhật
realtime, khi quay lại tab và tới hạn.

SePay nhận chuyển khoản rồi gửi webhook. SQL đối chiếu mã, người nhận, số tiền,
hạn và mã giao dịch; đủ cọc trong một giao dịch thì xác nhận tham gia. Retry
không thu lại hoặc xác nhận hai lần. Client không được ghi `paid_at`.

Chuyển thiếu không cộng dồn; thiếu/thừa/trùng/muộn đều có sổ đối soát. Khi đã
chuyển tiền mà chưa thấy xác nhận, người chơi được nhắc **không chuyển lại**.
Hết hạn ẩn QR và trả suất ngay trong kết quả đọc SQL, không phải chờ cron.

### 6. Tham gia và thu phần còn lại

Người tham gia kiểm tra lịch, địa điểm và thể lệ trước ngày ra sân. Phần còn
lại nộp trực tiếp hoặc dùng nội dung riêng, không chuyển lại mã cọc `GIAI`.

Từ lúc bắt đầu, chủ sân ghi đã thu phần còn lại kèm chứng từ; SQL tự tính số
tiền. Người vắng/được miễn cần ghi lý do. Người tổ chức không thể tự ghi rằng
chủ sân đã nhận khoản này. Không ghi thu hoặc miễn hai lần.

### 7. Hủy và hoàn

Tự hủy suất trước ít nhất 24 giờ được hoàn cọc; muộn hơn không được hoàn.
Giải cũ giữ chính sách đã công bố và mốc hoàn đã đóng băng trên đăng ký. Ban
tổ chức hủy suất hoặc giải phải hoàn toàn bộ tiền đã nhận; hủy giải trả lịch
sân. Đây là chính sách riêng, không thay mốc hủy đơn sân thường.

Chủ sân mở **Giao dịch & hoàn tiền**, chuyển trả tiền thực tế rồi mới xác nhận
đã hoàn. SQL đối chiếu số tiền còn cần hoàn để tránh xác nhận bằng màn hình cũ.
Người tham gia vẫn xem được giải đã hủy và giao dịch các lần đăng ký trước;
không được xem số điện thoại người khác hoặc sổ quyết toán riêng.

### 8. Kết thúc và quyết toán

Chủ sân/người tổ chức mở tab **Quyết toán**. SQL tính tiền ngân hàng và phần
còn lại đã thu, trừ nghĩa vụ hoàn và tiền thuê, rồi trừ các lần quyết toán.
Chỉ quyết toán sau khi kết thúc/hủy và xử lý xong thu/hoàn.

Số dương: chủ sân trả người tổ chức. Số âm: người tổ chức bù chủ sân. Bên trả
chuyển tiền thật rồi ghi chứng từ; bên nhận kiểm tra và xác nhận. Website
không tự chuyển tiền. Chủ sân tự tổ chức không phát sinh chuyển giữa hai bên.
Hạn đối soát là 7 ngày sau giờ kết thúc.

## Đánh giá UI/UX

Trước bản hoàn thiện, nền nghiệp vụ đã có đủ các bước nhưng trải nghiệm còn
khó vận hành: tất cả việc quản lý/thu/hoàn/quyết toán xếp trên một trang dài,
không tìm/lọc người tham gia, trạng thái cọc khó phân biệt với xác nhận tham
gia, form thời gian trả lỗi chung và QR ở dưới phần nội dung dài.

Bản này tập trung vào các điểm đó:

- Tách bốn khu vực quản lý bằng điều hướng có URL; người chơi không thấy công cụ quản lý.
- Đưa đăng ký và QR gần đầu trang, chỉ hiện QR khi còn được phép thanh toán.
- Hiển thị bước tiếp theo, hạn cọc và mốc hoàn chính xác của đăng ký.
- Có tìm tên không dấu và lọc trạng thái; duyệt có lời nhắn tùy chọn, từ chối cần lý do.
- Công cụ thu/hoàn chỉ hiện cho người có trách nhiệm; chủ sân tự tổ chức không thấy chuyển quyết toán hai bên.
- QR lỗi có thông tin chuyển khoản thay thế và nút tải lại; không cản việc kiểm tra người nhận và mã cọc.
- Người quản lý hủy suất của chính mình vẫn theo chính sách tự hủy, không hứa hoàn như hủy suất người khác.
- Chặn cọc vượt lệ phí và thứ tự thời gian sai ngay ở form, API trả lỗi cụ thể.
- Từ chối đề xuất không bị các trường thuê sân cản trở; duyệt công khai có xác nhận.
- Danh sách đã đăng ký cập nhật realtime và có lịch/địa điểm/hạn cọc.
- Hiển thị đúng đang diễn ra/đã kết thúc và lọc giải đã kết thúc ngay cả trước cron.
- Dùng bố cục thao tác gọn, nền phẳng và token sẵn có; không thêm thư viện.

Không gọi sản phẩm là “hoàn hảo” chỉ vì các kiểm tra kỹ thuật đạt. Các câu hỏi
về độ dễ hiểu vẫn cần quan sát một chủ sân và một nhóm người chơi thật, nhất
là cách mô tả “suất”, lý do từ chối và quy trình hoàn/đối soát.

## Kiểm tra Lặp Lại

Không kết nối Chrome cá nhân. Dùng Chromium headless và context riêng cho từng
vai trò. Các giao dịch kiểm tra là giả lập, không gọi ngân hàng chuyển tiền.

```sh
node scripts/check-tournament-journey.mjs
npx supabase db query --linked --file scripts/check-tournaments.sql
npm run lint
npm run typecheck
npm run build
```

Kiểm tra trình duyệt yêu cầu app production chạy local và migration mới đã
áp dụng. Script cố ý yêu cầu opt-in vì tạo tài khoản/sân/giải tạm trong project
Supabase liên kết, rồi xóa trong `finally`. Không chạy đồng thời với lệnh
Supabase CLI khác dùng cùng project. Project kiểm tra phải đủ điều kiện nhận
giải của chủ sân mới; **không bật cờ nghiệm thu nhiều chủ sân chỉ để chạy test**.

```sh
RUN_TOURNAMENT_E2E=1 \
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
CHROMIUM_EXECUTABLE=/path/to/chromium \
node scripts/check-tournament-browser.mjs http://localhost:3100
```

Script kiểm tra công khai, đăng ký, duyệt, nhận cọc giả lập và retry, realtime,
hoàn, từ chối và đăng ký lại, hết hạn, hủy giải, thỏa thuận admin, thu phần còn
lại và xác nhận quyết toán hai bên. Bố cục được kiểm tra ở 390/768/1024/1440px.
Ảnh kiểm tra nằm trong `output/tournament-journey`, không phải ảnh dữ liệu thật.

`scripts/check-tournament-e2e.mjs --live` kiểm tra thêm đăng nhập thực tế cả bốn
vai trò, QR lỗi và webhook giả lập qua app local. Script tự chạy app trên cổng
3110, cần production build và hai biến Playwright như trên; không chạy đồng
thời với bài kiểm tra trình duyệt hoặc lệnh Supabase CLI khác.

Nghiệm thu chuyển khoản ngân hàng thật, xác nhận webhook thật và quy trình hoàn
thủ công vẫn là điều kiện riêng trước khi nhận tiền từ người dùng.

## Xử lý lỗi công khai giải (05/10/2026)

Form hiển thị danh sách mục cần sửa thay cho thông báo nhập liệu chung. Bấm
lý do để tới đúng ô, sửa rồi gửi lại trên cùng form; lỗi đã sửa được bỏ khỏi
danh sách. SQL dùng giờ server để phân biệt giờ bắt đầu đã qua, hạn đăng ký
đã qua và thứ tự các mốc không hợp lệ. Tạo/công khai vẫn là một giao dịch:
thất bại không để lại đề xuất chờ duyệt hoặc khóa sân.

Kiểm tra bổ sung trong `check-tournament-e2e.mjs`: tên/thể lệ không đủ dài sau
khi bỏ khoảng trắng, hạn đăng ký trong quá khứ, liên kết tới ô lỗi, giữ sân
và lịch đã chọn, sửa rồi công khai; giải hiện ở danh sách công khai, Tôi tổ
chức, chủ sân và admin. Kiểm tra SQL bao gồm năm lỗi thời gian và toàn bộ
ràng buộc quyền/lịch/cọc cũ. API ghi mã lỗi RPC để đối chiếu lần lỗi tiếp
theo, không ghi dữ liệu biểu mẫu hoặc nội dung giao dịch ngân hàng.

Ba lần gửi bị từ chối trên production trước bản sửa không có nội dung lỗi
trong log, nên chưa kết luận nguyên nhân riêng của các lần đó. Đã xác nhận
luồng chủ sân công khai tại sân của mình chạy thành công trên production;
không thêm bước admin duyệt hoặc bỏ các điều kiện công khai.
