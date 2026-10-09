# Kết quả D8 — Tài khoản và tiện ích

Ngày 09/10/2026. Người dùng yêu cầu kiểm đến hết D9; project liên kết, dữ liệu thử, Chromium headless/context riêng. Các khoản tiền và chứng từ trong test đều giả.

**8 đạt / 0 không đạt / 2 một phần / 0 bị chặn.** Case nhiều biến thể chỉ tính đạt khi phần bắt buộc trong môi trường đã nêu đủ bằng chứng. Một phần không phải nghiệm thu xong.

Bản chụp mã/schema, index bằng chứng, lỗi harness và dọn dữ liệu xem [biên bản tổng hợp](test-results-d3-d9-2026-10-09.md). Các thay đổi sản phẩm của công việc khác không được gộp vào task kiểm thử này.

| Case | Kết quả | Bằng chứng, phạm vi và phần còn mở |
| --- | --- | --- |
| D8-01 | đạt | SQL trim/+84/invalid/other denied; fixture account lỗi/dirty/discard/retry và form normalize. |
| D8-02 | đạt | Avatar thật crop/keyboard/cancel/type/upload failure/retry/change/delete, ảnh vuông và chung account/community; không tự consent. |
| D8-03 | đạt | SQL hidden mặc định/public consent/revoke/banned; anonymous RPC và bảng không lộ private; JWT thật contact combinations. |
| D8-04 | đạt | 8 tổ hợp phone/zalo/facebook ở RPC anon thật; SQL unsafe URL/text và mô tả giờ; không mở profiles. |
| D8-05 | đạt | Fixture khám phá/cộng đồng: supported filters, empty/recovery/layout và link; SQL search_community/masking; UI không hứa chat/lịch trống. |
| D8-06 | một phần | Browser thật save/remove/privacy; fixture lỗi network/hết phiên và retry giữ UI. Chưa đủ double-click và hai tab thật đồng thời. |
| D8-07 | đạt | SQL 100/101 limit và hidden venue mask tên/slug/ảnh/địa chỉ; vẫn bỏ lưu được. |
| D8-08 | một phần | Browser HTTP completed ICS200/no-store/UTF8 fold/UTC/private404; SQL confirmed/pending và khác user. Chưa nhập vào ứng dụng lịch và chưa đủ cancelled HTTP. |
| D8-09 | đạt | SQL bổ sung cả bug/idea/support, title5/120 vs4/121, message20/3000 vs19/3001 bằng chữ Việt, loại sai, retry đổi nội dung. Suite trước kiểm URL/query, idempotence, 5/24h và10open; browser submit/retry/private đạt. |
| D8-10 | đạt | Browser admin trả lời/user lịch sử/role scope; SQL stale update/đóng thiếu response/hạn chế private và filter fixture. |

Dữ liệu thử đã dọn, kiểm lại cùng audit cuối; các phần thử qua dịch vụ thật còn mở như ghi trong bảng. Không kết luận sẵn sàng nhận tiền thật từ kết quả giả lập.
