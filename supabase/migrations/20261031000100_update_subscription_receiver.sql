-- Đổi tài khoản nhận phí website/chủ sân; hóa đơn đã tạo giữ snapshot cũ.
update public.subscription_receiver
set bank = 'TPBank',
    account_number = '03411092005',
    account_name = 'HOANG DINH LAM'
where singleton = true;
