-- Yêu cầu VIP chưa chuyển/duyệt dùng tài khoản nhận mới; bản ghi đã xử lý giữ snapshot.
update public.vip_purchases
set bank = 'TPBank', account_number = '03411092005', account_name = 'HOANG DINH LAM'
where status = 'awaiting_payment'
  and bank = 'MBBank' and account_number = '0691920022005';
