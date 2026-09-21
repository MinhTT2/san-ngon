-- Thông báo riêng cho admin khi có hồ sơ chủ sân mới gửi.
alter type public.notif_kind add value if not exists 'owner_application';
