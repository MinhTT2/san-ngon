# Database kiểm thử cô lập

Workflow `SQL isolation` tạo Supabase local bằng Docker **trên GitHub Actions**, dùng
Node 24 và CLI đã khóa trong package-lock. Không yêu cầu Docker trên máy phát triển,
không tạo Supabase project trả phí, không sao chép database vận hành hoặc file `.env`.

`node scripts/run-sql-ci.mjs --preflight` kiểm inventory offline. Chạy stack thật chỉ
được phép trong Linux CI; script không nhận URL database, project ref hoặc `--linked`.
Nó tạo workdir mới bằng `supabase init`, chỉ chép migrations được Git theo dõi, lọc
biến môi trường truyền cho CLI và chạy SQL bằng `psql` trong đúng container database tạm. Không đưa `.temp`
liên kết project, khóa OAuth, token/Vault, SePay, SMTP hoặc Telegram vào container.

Lần khởi tạo áp dụng toàn bộ lịch sử migrations vào database mới. Sau đó tắt cron
của stack thử và chạy 19 bài SQL có `BEGIN/ROLLBACK`: giữ chỗ/giá/quyền, thanh toán,
giải/hồ sơ, sổ tiền/hoàn, hàng đợi, audit/cảnh báo, báo cáo và dữ liệu cá nhân.
Cuối cùng hai kết nối đồng thời đặt chồng cùng sân: một commit, một bị GiST chặn.
Không dùng SELECT-then-INSERT để giả lập chống trùng. Hủy container/volume khi xong;
GitHub runner cũng bị hủy sau job.

Workflow chạy khi đổi migrations/SQL checks và có thể chạy thủ công trong Actions.
Không bỏ qua bài lỗi hoặc sửa migration đã áp dụng chỉ để làm CI xanh: xác định
schema hoặc fixture đã lỗi thời, rồi sửa có hồi quy. CI này không nghiệm thu SMTP,
OAuth, tiền chuyển thật, backup/restore, network region hoặc tải thực tế.
