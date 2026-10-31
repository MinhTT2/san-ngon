-- Đồng bộ bản ghi legacy đã ngừng nhận đơn để không còn hiển thị người nhận cũ.
update public.booking_operator
set bank = 'TPBank', account_number = '03411092005', account_name = 'HOANG DINH LAM'
where bank = 'MBBank' and account_number = '0691920022005';
