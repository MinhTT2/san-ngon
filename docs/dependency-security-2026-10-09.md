# Kiểm tra và vá thư viện — 09/10/2026

Phạm vi A07 trong [báo cáo đánh giá](website-assessment-2026-10-09.md). Kết quả phản ánh audit tại thời điểm kiểm tra, không phải cam kết hết mọi lỗ hổng.

## Phần chạy website

| Thư viện | Trước → sau | Advisory và đường sử dụng |
| --- | --- | --- |
| Next.js | 15.5.25 → 15.5.27 | [GHSA-4jqv-mc3x-m676](https://github.com/advisories/GHSA-4jqv-mc3x-m676), [GHSA-mcj8-r9mp-w47p](https://github.com/advisories/GHSA-mcj8-r9mp-w47p): cache SSG/ISR khi tự host. Các trang có dữ liệu tài khoản/lịch dùng dynamic; triển khai mô tả trong repo dùng Vercel. Vẫn vá để tránh phụ thuộc vào cấu hình triển khai. |
| sharp | 0.35.4 → 0.35.5 | [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w): librsvg. Next sử dụng sharp trong tối ưu ảnh; SVG optimization mặc định bị chặn, upload sân chỉ nhận JPEG/PNG/WebP. Không coi giới hạn định dạng là thay thế bản vá. |
| source-map-js | 1.2.1 → 1.2.2 | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q): indexed source-map gây nghẽn vòng lặp xử lý. Dùng gián tiếp trong PostCSS/Tailwind; không thấy route nhận source-map từ khách. Vá cả dependency gián tiếp. |

Giữ Next ở nhánh 15.5, đồng bộ eslint-config-next 15.5.27. Khóa sharp/source-map-js bằng `overrides` để cây dependency không giữ bản cũ. Không đổi cấu hình host ảnh hoặc bật tối ưu SVG. Node 24 đáp ứng yêu cầu sharp `>=20.9.0`.

`npm audit --omit=dev`: **0 vulnerabilities** sau cập nhật. Có thể kiểm tra phiên bản bằng `npm ls next sharp source-map-js`.

## Giới hạn và công cụ phát triển

Audit toàn bộ cây còn **37 cảnh báo**: 1 low, 8 moderate, 27 high, 1 critical. Chúng nằm trong công cụ phát triển và dependency gián tiếp, chủ yếu Vercel CLI và ESLint; không có trong kết quả `--omit=dev`.

- Nhóm Vercel CLI gồm tar, undici, path-to-regexp, minimatch, smol-toml, các adapter build và parser liên quan. Tar có cảnh báo critical khi đọc/giải nén archive: cần xử lý riêng cho máy phát triển và pipeline triển khai, không kết luận an toàn chỉ vì là devDependency.
- Nhóm ESLint gồm braces/micromatch/fast-glob và js-yaml; xử lý cấu hình/pattern/file trong công cụ phát triển. Chưa thấy các module này được gọi trong route phục vụ người chơi.
- Đề xuất tự động của audit cho hai dependency trực tiếp là đổi Vercel 59 sang 54 và eslint-config-next 15 sang 14. Đợt này giữ tương thích Next 15; không áp dụng đề xuất đổi major khi chưa kiểm tra luồng lint/triển khai của các phiên bản đó.

Đây là ngoại lệ còn mở của A07. Cần kiểm kê CLI thực sự dùng tại deploy và thử bản vá tương thích trong một đợt riêng. Không gọi toàn bộ dependency là «đã sạch audit».

## Xác minh

- Lint, typecheck và kiểm tra hợp đồng API đặt sân.
- Production build bằng cấu hình fixture độc lập, không có khóa hoặc phiên Supabase thật.
- Trang chủ, tìm sân, chọn/đặt sân, checkout và báo lỗi/phục hồi trên Chromium headless.
- Tối ưu 3 ảnh thể thao có sẵn trong repo qua endpoint Next: kiểm kích thước, đọc ảnh bằng sharp và giải mã bằng Chromium. Kiểm tra host ngoài danh sách và SVG tiếp tục bị từ chối.

Bài kiểm tra ảnh được thêm vào runner/CI giao diện:

```sh
npm audit --omit=dev
npm run lint
npm run typecheck
node scripts/check-booking-inputs.mjs
npm run check:ui -- --only=check-image-optimizer,check-public-ui,check-booking-polish,check-checkout-ux,check-discovery-ux,check-query-errors
```

Trạng thái: **xác minh đạt ngày 09/10/2026**. Production build và toàn bộ các bài giao diện/ảnh liệt kê ở trên đạt. Ba ảnh được xử lý ở hai kiểu Accept header, đều đạt kích thước và giải mã; host ngoài danh sách và SVG trả 400 theo kỳ vọng. Kiểm tra queue cập nhật realtime cũng đạt.

Runner còn kiểm tra sớm rằng mỗi script được chọn nằm trong danh sách file Git theo dõi, tránh build xong mới gặp tham chiếu tới file chưa commit. Đã kiểm tra guard bằng index riêng thiếu script: từ chối trước khi build, không làm thay đổi staging của các task khác.
