# Mahō — timeline sản phẩm

## Mục tiêu

Ra mắt một storefront Mahjong có cá tính màu sắc rõ ràng, giúp khách hiểu sản phẩm trong 10 giây và tự ghép một bộ theo gu của mình trong dưới 2 phút.

## Timeline 6 tuần

| Tuần | Mốc | Việc chính | Đầu ra kiểm chứng |
|---|---|---|---|
| 1 | Định hướng | Chốt chân dung người chơi, danh mục set, giá, tồn kho, quy tắc mix edition và monogram | One-page brief + inventory sheet |
| 2 | Hệ nhận diện | Chốt logo, typography, token màu theo vai trò: ink (nền/chữ), jade (primary), saffron (điểm nhấn), coral (CTA/limited) | Figma mini design system + contrast check |
| 3 | Home v1 | Hero, collection cards, câu chuyện chất liệu, social proof, footer; mobile-first nhưng ưu tiên trải nghiệm desktop | Prototype click-through, 5-second test |
| 4 | Build your set | Chọn 1–4 edition, xem số tile/tổng, monogram, case, preview bộ đã ghép, lưu giỏ | Luồng hoàn chỉnh từ chọn đến cart |
| 5 | Commerce & content | PDP, giỏ hàng, checkout, tồn kho, email xác nhận, analytics funnel | Staging có đơn test và event tracking |
| 6 | QA & launch | Test responsive, keyboard, screen reader, ảnh sản phẩm, tốc độ; soft launch với 10 người chơi | Bug list = 0 blocker, launch checklist |

## Ưu tiên build your set

1. Chọn edition: tối đa 4 palette, tile count tự cập nhật.
2. Chọn hoàn thiện: tile finish, màu chữ, khay/case.
3. Cá nhân hóa: monogram 1–3 ký tự, xem preview.
4. Kiểm tra giá và tồn kho theo từng thành phần.
5. Lưu cấu hình vào giỏ bằng một `set_config` bất biến để giá đơn không đổi khi catalog cập nhật.

## Quy tắc màu

- **Ink `#211F1A`**: chữ, điều hướng, nền tương phản.
- **Jade `#0E5A4A`**: trạng thái chọn, thông tin tin cậy, sản phẩm core.
- **Saffron `#F6D36B`**: điểm nhấn khám phá và edition giới hạn.
- **Coral `#C84B5B`**: CTA nổi bật, badge mới, cảnh báo tồn kho thấp.
- **Paper `#FBF8F1` / Ivory `#FFFDF8`**: nền và bề mặt sản phẩm.

Không dùng màu chỉ để trang trí: mọi màu trên UI phải có vai trò, trạng thái hover/focus và kiểm tra tương phản.

## Tiêu chí nghiệm thu

- Home: người mới nói đúng sản phẩm và CTA chính sau 5 giây.
- Builder: thêm/bỏ edition không mất lựa chọn; reload không làm sai tổng; keyboard dùng được.
- Commerce: không thể mua cấu hình vượt tồn kho; giá snapshot trong cart/order.
- Responsive: không có overflow ở 320px; desktop có preview set cạnh panel lựa chọn.
