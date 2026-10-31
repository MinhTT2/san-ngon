-- Chuyển tài khoản nhận cọc của luồng chủ sân cũ sang tài khoản hiện tại.
-- Thông tin người nhận đã snapshot trong đơn cũ nên không bị thay đổi.
update public.booking_operator
set bank = 'TPBank',
    account_number = '03411092005',
    account_name = 'HOANG DINH LAM'
where accepts_new_bookings = true;
