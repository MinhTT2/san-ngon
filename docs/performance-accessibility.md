# Hiệu năng và khả năng truy cập

`scripts/check-accessibility-browser.mjs` dùng Chromium headless/context riêng,
axe WCAG 2/2.1/2.2 A/AA tại 390 và 1440 px trên trang chủ, tìm sân, chi tiết sân,
giải, đăng nhập, chính sách, dữ liệu cá nhân, báo cáo chủ sân và audit admin.
Kiểm thêm tràn ngang và bàn phím bỏ qua điều hướng. Đây là phần lỗi máy có thể
phát hiện, không chứng nhận WCAG; vẫn cần đọc màn hình, bàn phím và người dùng thật.

Đợt 21/10 sửa nhãn nút/link khớp chữ hiển thị (lịch, ảnh, video, tài khoản),
nhóm dt/dd đúng ngữ nghĩa, ô ngày báo cáo và tìm audit đủ chiều rộng mobile.
Hero chỉ tải ảnh slide đã xem, giữ ưu tiên ảnh đầu và chất lượng 65 qua bộ tối ưu;
slide mới vẫn có hình minh họa trong lúc tải, ảnh lỗi có fallback.

`scripts/measure-public-performance.mjs https://san-ngon.vercel.app` chỉ đọc,
không đăng nhập, chặn Google Analytics. Chromium 390×844, mạng 1,6 Mbps/150 ms,
CPU chậm 4 lần, reduced motion, cache HTTP tắt; lưu JSON trong output/automated-ui.
Ngưỡng hồi quy: CLS ≤ 0,1, JS ban đầu < 350 kB. Thời gian local với fixture
không được xem là hiệu năng production, số đo lab không phải p75 thực tế hay INP.

Trước thay đổi hero, hai lần đo production: LCP trang chủ 4,65–5,02 s,
CLS khoảng 0,002; tìm sân 1,12–1,23 s, CLS 0,019. JS khoảng 214 kB.
Ảnh LCP đầu khoảng 120 kB, tranh mạng với ảnh chưa hiện, JS và font.
Kết quả sau deploy được ghi cùng bàn giao cuối. Cần tiếp tục thu dữ liệu người
dùng thật để đánh giá mạng/thiết bị khác và tương tác trong phiên đặt sân.
