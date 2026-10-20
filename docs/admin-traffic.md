# Thời lượng tài khoản và báo cáo truy cập

## Thời lượng trong Người dùng

`/admin/users` hiển thị tổng thời gian sử dụng và hoạt động gần nhất của từng tài khoản. Chỉ admin đọc được qua `admin_list_users`; bảng tổng thời gian không có quyền đọc/ghi trực tiếp cho trình duyệt.

Trình duyệt đã đăng nhập gửi trạng thái hoạt động mỗi 30 giây. SQL dùng đồng hồ server để cộng khoảng thời gian, không nhận số giây hoặc user ID từ client. Tab ẩn, mất focus, đăng xuất hoặc không có tương tác trong 5 phút sẽ ngừng tính. Mỗi tài khoản chỉ có một phiên đang được tính, tránh cộng trùng nhiều tab/thiết bị; phiên im lặng quá 45 giây hết hiệu lực. Thời gian là ước tính: mất mạng, đóng trình duyệt hoặc chuyển tab có thể làm mất một khoảng ngắn. Không dùng để tính phí hoặc xác định độ tin cậy của tài khoản.

Chỉ ghi nhận trên Vercel Production, từ lúc triển khai migration `20261019000200_user_activity.sql` và code mới. Không có dữ liệu lịch sử trước đó. Không lưu URL, nội dung nhập hay lịch sử thao tác. Không gửi định danh tài khoản sang GA4. Xóa tài khoản sẽ xóa cả tổng thời gian qua khóa ngoại.

## Kết nối báo cáo GA4

Trang `/admin/thong-ke-truy-cap` chỉ dành cho admin, đọc dữ liệu tổng hợp qua Google Analytics Data API ở server. Các khóa Google không được đưa vào client bundle. Chọn 7/30/90 ngày, gồm hôm nay theo múi giờ property; cache báo cáo thành công 10 phút. Người hoạt động theo từng ngày không được cộng lại để tính số người duy nhất cả kỳ.

Báo cáo mở rộng ngày 20/10/2026 gồm:

- Người hoạt động, người mới, lượt xem, phiên, phiên có tương tác, tỷ lệ tương tác/thoát, lượt xem mỗi phiên, tổng thời gian và thời gian tương tác trung bình mỗi người. So sánh với kỳ liền trước có cùng số ngày, không chồng lặp; tỷ lệ so theo điểm phần trăm. Kỳ trước bằng 0 không hiển thị phần trăm tăng vô hạn. Kỳ hiện tại có hôm nay chưa đủ ngày.
- Biểu đồ lượt xem và bảng người hoạt động theo ngày; kênh, nguồn/phương tiện, trang được xem và trang vào đầu tiên (chỉ trang công khai, không query/hash).
- Thiết bị, trình duyệt, hệ điều hành, ngôn ngữ, quốc gia/thành phố ước tính, giờ truy cập theo múi giờ property, phiên của người mới/quay lại theo cookie. Một người có thể thuộc nhiều nhóm; không cộng thành người duy nhất.
- Ba thao tác khám phá sân tên cố định; không gửi nội dung form hay thông tin đơn. Sự kiện chỉ có từ sau triển khai, có thể lặp, không phải phễu theo từng người hay bằng chứng tạo/thanh toán đơn.
- Người hoạt động trong 30 phút gần nhất, đọc riêng và cache 1 phút. Tải lại trang để cập nhật; không tự polling. Lỗi realtime không làm mất báo cáo theo kỳ.
- Gợi ý kiểm tra dựa trên mẫu truy cập (ít phiên, tương tác thấp, điện thoại nhiều hơn desktop), ghi rõ giới hạn và dẫn đến sổ vận hành khi cần đối soát.

Google cho tối đa 5 báo cáo/batch, 10 metric/báo cáo. Báo cáo dùng 4 batch (16 báo cáo), thêm 1 request realtime; OAuth chỉ xin quyền đọc. Các nhóm chi tiết lỗi hiển thị chưa tải được và giữ tổng quan, không thay bằng 0. Có thông báo nếu Google áp dụng ngưỡng, lấy mẫu hoặc gộp nhóm. Mỗi xếp hạng lấy tối đa 20 dòng; giờ lấy tối đa 24, ngày lấy đủ kỳ.

Không bật nhân khẩu học, Google Signals, cá nhân hóa quảng cáo, đo checkout hoặc giao dịch mua hàng. Không suy ra dữ liệu chưa thu thập từ lượt xem đang có. Đối soát thanh toán/doanh thu vẫn dùng SQL.

Thiết lập một lần:

1. Trong Google Cloud Console, chọn/tạo project, mở **APIs & Services → Library** và bật **Google Analytics Data API**.
2. Mở **IAM & Admin → Service Accounts**, tạo tài khoản dịch vụ cho báo cáo. Không cần cấp quyền quản trị project cho tài khoản này. Trong **Keys**, tạo khóa JSON; giữ file riêng tư.
3. Trong GA4, mở **Quản trị → Quản lý quyền truy cập thuộc tính**, thêm `client_email` trong file JSON với quyền **Người xem / Viewer** cho đúng property Sân Ngon.
4. Lấy **Property ID / Mã thuộc tính** dạng số tại phần thông tin thuộc tính. Đây không phải mã `G-...` và không phải ID luồng.
5. Trong Vercel → dự án `san-ngon` → **Settings → Environment Variables**, thêm cho **Production**:

   ```text
   GA4_PROPERTY_ID=<mã thuộc tính dạng số>
   GOOGLE_SERVICE_ACCOUNT_EMAIL=<client_email trong JSON>
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=<private_key đầy đủ trong JSON>
   ```

   Đặt khóa private ở loại **Sensitive**, giữ cả dòng BEGIN/END và xuống dòng; code cũng hỗ trợ chuỗi `\n`. Không thêm tiền tố `NEXT_PUBLIC_`, không commit file JSON và không gửi private key vào chat.
6. Redeploy Production, đăng nhập admin và mở **Thống kê truy cập**. Kiểm tra múi giờ property là Việt Nam (Asia/Ho_Chi_Minh), đối chiếu với GA4 cùng kỳ. Giữ **Tính năng đo lường nâng cao tắt** như cấu hình hiện tại.

Thiếu cấu hình hiển thị “Chưa kết nối”, lỗi quyền/quota/mạng có thông báo riêng; không thay lỗi bằng số 0 hoặc dữ liệu demo. GA4 có độ trễ, có khách ẩn danh và người chặn theo dõi, nên không khớp số tài khoản hay tổng thời gian nội bộ. Báo cáo không thay thế số liệu đơn hàng/doanh thu SQL.

## Kiểm tra

Kết quả mở rộng và các phần còn phụ thuộc quyền/cấu hình thật: [báo cáo ngày 20/10/2026](test-results-ga-operations-2026-10-20.md).

- `node scripts/check-ga4-report.mjs`: OAuth JWT chữ ký thật với khóa tạm, batch report/metrics và các trạng thái lỗi, hoàn toàn giả lập mạng Google.
- `node scripts/check-traffic-suite.mjs`: build index Git trong thư mục tạm, provider Google/Supabase giả lập, Chromium headless riêng. Kiểm tra quyền admin, 7/30/90 ngày, rỗng/lỗi quyền/quota/lỗi một phần/ngưỡng dữ liệu/realtime lỗi, responsive, sự kiện công khai và hồi quy đặt sân/checkout/khôi phục/refresh. Không sử dụng cookie hoặc khóa production.
- `supabase db query --linked --file scripts/check-user-activity.sql`: kiểm tra SQL trong transaction rollback, không giữ tài khoản hoặc thời lượng thử.
- Chromium headless/context riêng: admin/player/khách, thời lượng, focus/tab ẩn/idle/đăng xuất/nhiều tab, giao diện desktop/mobile, báo cáo trống/chưa kết nối/có số liệu giả lập và hồi quy GA4 không gửi dữ liệu riêng tư.
- `RUN_TRAFFIC_E2E=1 node scripts/check-admin-traffic.mjs /tmp/san-ngon-traffic.<bản-build-riêng>` chạy kiểm tra Auth/API/SQL thật với hai tài khoản tạm rồi xác minh đã dọn hết. Server test dùng `scripts/fixtures/ga4-fetch.mjs` để giả lập mọi request OAuth/Data API Google; không dùng thông tin Google thật.

Nghiệm thu ngày 19/10/2026: lint, typecheck và production build đạt trên Node 24 với bản chỉ chứa thay đổi task này. Migration đã áp dụng lên Supabase; kiểm tra SQL và Chromium/Auth/API đạt, đã xác minh xóa hết tài khoản và thời lượng thử. Chromium headless giữ mọi tab ở trạng thái visible/focused nên bài kiểm tra chủ động mô phỏng sự kiện blur/visibility; đồng hồ giả lập kiểm tra mốc idle 5 phút. Các kiểm tra báo cáo dùng dữ liệu Google giả lập, chưa xác nhận đọc được báo cáo GA4 thật do chưa cấu hình tài khoản dịch vụ/Property ID.
