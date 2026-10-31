-- Tài khoản 03411092005 được ngân hàng nhận diện là MBBank.
update public.vip_receiver set bank='MBBank', account_number='03411092005', account_name='HOANG DINH LAM' where singleton=true;
update public.subscription_receiver set bank='MBBank', account_number='03411092005', account_name='HOANG DINH LAM' where singleton=true;
update public.booking_operator set bank='MBBank', account_number='03411092005', account_name='HOANG DINH LAM' where account_number='03411092005';
update public.vip_purchases set bank='MBBank', account_number='03411092005', account_name='HOANG DINH LAM' where status='awaiting_payment';
