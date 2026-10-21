# Metadata và URL công khai

Chi tiết sân đang active có title, mô tả, canonical không kèm ngày/bộ lọc,
Open Graph/Twitter với ảnh thật đã kiểm đường dẫn; thiếu ảnh dùng ảnh chia sẻ
chung. Query đọc sân được cache trong một lần render, vẫn kiểm trạng thái active.

Trang sân phát JSON-LD SportsActivityLocation; giải published/completed phát
SportsEvent. Chỉ lấy trường công khai bằng danh sách tường minh, không đưa
hồ sơ quản lý, đăng ký, điện thoại khách hoặc dữ liệu ngân hàng vào schema.
Không tự thêm tọa độ, đánh giá, khả năng còn chỗ hay kết quả giải chưa có.
JSON nhúng escape ký tự < để nội dung người đăng không thể đóng thẻ script.

Giải bị moderation ẩn hoặc chưa công khai dùng metadata chung/noindex,
không phát schema kể cả khi người quản lý được xem. Các view thao tác của
giải cũng noindex/nofollow và không phát schema.

Trang tìm sân/giải gốc giữ index. URL có tham số khác rỗng dùng
noindex/follow, canonical về trang danh sách gốc để tránh tổ hợp ngày, giờ,
từ khóa, phân trang và cách hiển thị trùng nhau. View giải của tài khoản
vẫn noindex/nofollow. Không chặn robots crawl các URL lọc vì crawler cần
đọc noindex; robots/header tiếp tục chặn khu riêng tư.

Sitemap chỉ lấy dữ liệu anonymous qua RLS: sân active, giải công khai;
không thêm tổ hợp bộ lọc hay trang thao tác. JSON-LD không bảo đảm rich result
hoặc thứ hạng Google. Nghiệm thu index/Search Console cần tài khoản vận hành.
