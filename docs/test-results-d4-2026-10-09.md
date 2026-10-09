# Kết quả D4 — Chủ sân và vận hành

Ngày 09/10/2026. Người dùng yêu cầu kiểm đến hết D9; project liên kết, dữ liệu thử, Chromium headless/context riêng. Các khoản tiền và chứng từ trong test đều giả.

**7 đạt / 0 không đạt / 7 một phần / 0 bị chặn.** Case nhiều biến thể chỉ tính đạt khi phần bắt buộc trong môi trường đã nêu đủ bằng chứng. Một phần không phải nghiệm thu xong.

Bản chụp mã/schema, index bằng chứng, lỗi harness và dọn dữ liệu xem [biên bản tổng hợp](test-results-d3-d9-2026-10-09.md). Các thay đổi sản phẩm của công việc khác không được gộp vào task kiểm thử này.

| Case | Kết quả | Bằng chứng, phạm vi và phần còn mở |
| --- | --- | --- |
| D4-01 | một phần | Form owner ở UI fixture giữ dữ liệu; đăng ký API multipart/PDF thật tạo pending 201. Chưa chạy trọn ba bước bằng phiên thật và OAuth thật. |
| D4-02 | một phần | Pending giữ giấy tờ/role player; SQL resubmit giữ kết nối; callback mock về bước 3. Chưa rời/quay về sau cấp quyền SePay thật. |
| D4-03 | một phần | Pending không tạo cụm/nhận đơn; admin đọc giấy tờ thật; SQL trạng thái active cho phép nhận. Chưa duyệt sẵn sàng từ giao diện với OAuth thật. |
| D4-04 | một phần | Hai admin JWT thật cạnh tranh active/rejected: một 204, một OWNER_ALREADY_REVIEWED. Từ chối rồi register_owner gửi lại trở về pending/role player. RPC/API ở bản đã test không có trường lý do từ chối riêng; thay đổi local bổ sung sau snapshot chưa được tính đạt. Email thật chưa nghiệm thu. |
| D4-05 | đạt | Tạo draft 2 cầu lông + 1 pickleball thật; SQL kiểm số sân 0/21, giá dưới/trên, tên trống và số điện thoại sai, không để lại cụm một phần. |
| D4-06 | một phần | 9 PNG upload thật: 2/9 ảnh bị từ chối, 3 công khai, 8 lưu đúng thứ tự; SQL duplicate/stale/missing path; cross-owner bị chặn. JPEG/WebP và file hơn 5 MiB chưa test upload thật cho bucket ảnh sân. |
| D4-07 | đạt | Fixture UI mô phỏng từng ảnh hỏng/thử lại/lưu/bỏ thay đổi: giữ ảnh thành công, giữ thứ tự, không upload lại thành công hoặc công khai batch dở dang. |
| D4-08 | đạt | SQL rollback kiểm đổi môn/tắt sân/đổi giờ phá booking tương lai, xóa sân/cụm có lịch sử, tắt/xóa sân active cuối. Kiểm cả deferred constraint trước khi kết luận. |
| D4-09 | đạt | SQL create/update/delete sân không booking, duplicate tên, thiếu cặp giờ, giờ ngoài cụm, null kế thừa; fixture UI PATCH trạng thái/lưu và phục hồi lỗi. |
| D4-10 | đạt | SQL save/edit/delete giá: priority trước giá, cùng priority lấy giá cao; không xóa giá chung; UI lỗi/giữ draft và lịch giá phù hợp. |
| D4-11 | một phần | SQL đơn cũ 100.000 giữ giá; sửa giá rồi đơn mới 200.000; fixture form chưa lưu giữ draft. Chưa chạy đầy đủ stale màn hình mức giá bị xóa bằng API thật. |
| D4-12 | đạt | Ba lượt JWT thật khóa/đặt đồng thời mỗi lượt một thành công; mở lại; SQL khóa trùng/guard và lịch fixture xử lý stale. |
| D4-13 | đạt | Fixture calendar 320/390/768/1440: ngày/sân đổi nhanh, response đảo thứ tự, lỗi, chi tiết khách, focus và close/reopen retry. |
| D4-14 | một phần | Admin CRUD/self-protection SQL đạt; dashboard/bộ lọc/UI 7/30/90 và lỗi query đạt. Chưa đối chiếu toàn bộ chỉ tiêu tổng quan với dataset có kết quả mong đợi riêng. |

Dữ liệu thử đã dọn, kiểm lại cùng audit cuối; các phần thử qua dịch vụ thật còn mở như ghi trong bảng. Không kết luận sẵn sàng nhận tiền thật từ kết quả giả lập.
