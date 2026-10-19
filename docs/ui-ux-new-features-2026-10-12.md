# Rà soát UI/UX tính năng mới — 12/10/2026

Phạm vi: thay đổi sau lần rà soát 09/10: lý do duyệt hồ sơ chủ sân và gửi lại giấy tờ, danh sách suất tham gia đã xác nhận, quyền xóa sân/giải của admin, bộ lọc Hòa Lạc và Thạch Thất.

## Cải thiện

| Vấn đề | Kết quả |
| --- | --- |
| Chờ duyệt/chờ cọc bị giấu trong bộ lọc người tham gia | Ba nút trạng thái có số lượng; mặc định vẫn chỉ hiện suất đã xác nhận. |
| Số kết quả dùng tổng của mọi trạng thái, khó đọc khi tìm kiếm | Đếm theo trạng thái đang chọn; tìm tiếng Việt không dấu, xóa từ khóa giữ nguyên trạng thái. |
| Danh sách xác nhận trống khiến chủ sân tưởng chưa có đăng ký | Chỉ rõ đăng ký chờ duyệt/chờ cọc và có nút chuyển đến phần cần xử lý. |
| Xác nhận xóa dài trong hộp thoại trình duyệt | Hộp thoại trong website có tên cụ thể, hậu quả, điều kiện xóa và nút quay lại; focus, Escape và khóa thao tác khi đang gửi. |
| Hộp thoại có thể bị giới hạn bởi thẻ/bảng có hiệu ứng chuyển động | Hiển thị hộp thoại ở lớp chung của trang để không bị cắt hoặc lệch theo thẻ. |
| Không rõ kết quả xóa khi mạng gián đoạn | Lỗi hiển thị ngay trong hộp thoại; hướng dẫn kiểm tra danh sách trước khi gửi lại; giữ nguyên các kiểm tra quyền và tài chính trên server. |
| Nút “Từ chối” hồ sơ không khớp luồng bổ sung và gửi lại | Đổi thành “Yêu cầu bổ sung”, thống nhất với lý do chủ sân nhận. |
| Chọn tệp sai phải chờ gửi hồ sơ mới biết | Kiểm tra PDF/JPG/PNG, tệp rỗng và 10 MiB ngay khi chọn hoặc kéo thả; giữ tệp hợp lệ trước đó và khả năng dùng giấy tờ cũ. |
| “Tiếp theo” có thể vô tình gửi hồ sơ khi giấy tờ cũ đã đầy đủ | Tách định danh nút chuyển bước và gửi hồ sơ, chặn hành vi gửi mặc định; chỉ gửi khi người dùng bấm nút cuối. |
| Nút gửi dài bị bó hẹp trên điện thoại | Nút gửi và quay lại xếp dọc trên màn hình nhỏ; desktop giữ hàng ngang. |

## Kiểm tra

- Chromium headless, context riêng và dữ liệu đọc giả lập; các yêu cầu ghi được chặn trong trình duyệt.
- Kiểm tra 320/390/768/1024/1440px: bố cục, trạng thái mặc định, chuyển nhóm đăng ký, tìm kiếm/xóa, số lượng và xác nhận xóa.
- Kiểm tra Escape, trả focus, khóa trong lúc gửi, lỗi server/mạng và thông báo thành công.
- Giấy tờ sai định dạng/quá dung lượng không được gửi; chọn sai không làm mất tệp hợp lệ; chuyển bước không tự gửi; gửi lại vẫn dùng giấy tờ cũ khi yêu cầu.
- Bộ lọc Hòa Lạc/Thạch Thất vẫn hiện đủ.
- Cập nhật các kịch bản kiểm tra thao tác xóa để sử dụng hộp thoại mới và tên trang quản lý giải hiện tại.
- Lint, typecheck, production build và các nhóm giao diện liên quan được chạy trong bản checkout cô lập. Không thay đổi SQL, quyền xóa, thu/hoàn tiền hoặc trạng thái duyệt.

Ảnh kiểm tra: /tmp/san-ngon-new-feature-ux-20261012.
