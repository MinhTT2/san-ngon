-- Run with supabase db query --linked --file scripts/check-admin-delete-venue.sql.
-- Disposable fixtures; all writes roll back, including successful deletions.
begin;
insert into auth.users(id) values
  ('ed120010-0000-4000-8000-000000000001'),
  ('ed120010-0000-4000-8000-000000000002'),
  ('ed120010-0000-4000-8000-000000000003');
update profiles set role='admin' where id='ed120010-0000-4000-8000-000000000001';
update profiles set role='owner',owner_application_status='active' where id='ed120010-0000-4000-8000-000000000002';
insert into venues(id,owner_id,name,slug,address,district,status,open_time,close_time) values
  ('ed120010-0000-4000-8000-000000000010','ed120010-0000-4000-8000-000000000002','Xóa sân kiểm tra','admin-delete-venue-rollback','Địa chỉ kiểm tra','Hòa Lạc','draft','06:00','23:00');
insert into courts(id,venue_id,name,sport) values
  ('ed120010-0000-4000-8000-000000000011','ed120010-0000-4000-8000-000000000010','Sân kiểm tra','badminton');
insert into price_rules(court_id,start_time,end_time,price_per_hour) values
  ('ed120010-0000-4000-8000-000000000011','06:00','23:00',100000);
insert into court_closures(court_id,starts_at,ends_at,reason) values
  ('ed120010-0000-4000-8000-000000000011',now()+interval '3 days',now()+interval '3 days 1 hour','Khóa kiểm tra');
insert into venue_favorites(user_id,venue_id) values
  ('ed120010-0000-4000-8000-000000000003','ed120010-0000-4000-8000-000000000010');

select set_config('request.jwt.claim.sub','ed120010-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
  begin
    perform admin_delete_venue('ed120010-0000-4000-8000-000000000010');
    raise exception 'TEST: owner deleted via admin RPC';
  exception when raise_exception then if sqlerrm <> 'FORBIDDEN' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','ed120010-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
  begin
    perform admin_delete_venue('ed120010-0000-4000-8000-000000000010');
    raise exception 'TEST: player deleted via admin RPC';
  exception when raise_exception then if sqlerrm <> 'FORBIDDEN' then raise; end if; end;
end $$;
reset role;

-- Seed paid/history orders on a draft without changing the payment acceptance gate.
set local session_replication_role=replica;
insert into bookings(id,code,court_id,user_id,starts_at,ends_at,total_amount,deposit_amount,status,customer_phone) values
  ('ed120010-0000-4000-8000-000000000012','SANZXY987','ed120010-0000-4000-8000-000000000011','ed120010-0000-4000-8000-000000000003',now()+interval '4 days',now()+interval '4 days 1 hour',100000,100000,'cancelled','0900000003');
insert into bookings(code,court_id,user_id,starts_at,ends_at,total_amount,deposit_amount,status,customer_phone)
  select 'SANTEST'||n,'ed120010-0000-4000-8000-000000000011','ed120010-0000-4000-8000-000000000003',
    now()+(10+n)*interval '1 day',now()+(10+n)*interval '1 day'+interval '1 hour',100000,100000,
    (array['pending','confirmed','completed','no_show'])[n]::booking_status,'0900000003'
  from generate_series(1,4) n;
set local session_replication_role=origin;
update bookings set payment_owner_id='ed120010-0000-4000-8000-000000000002',
  payment_bank='testbank',payment_account='12345678',paid_at=now(),refund_status='needed'
  where id='ed120010-0000-4000-8000-000000000012';
insert into payments(booking_id,amount,ref_code,bank_tx_id,status) values
  ('ed120010-0000-4000-8000-000000000012',100000,'SANZXY987','venue-delete-test','paid');
insert into sepay_events(transaction_key,booking_id,amount,raw) values
  ('legacy:987654321','ed120010-0000-4000-8000-000000000012',100000,'{}');
insert into incoming_transfers(transaction_key,receiver_owner_id,bank,account_number,bank_tx_id,amount,ref_codes,booking_id,source,raw) values
  ('testbank:12345678:987654321','ed120010-0000-4000-8000-000000000002','testbank','12345678','987654321',100000,array['SANZXY987'],'ed120010-0000-4000-8000-000000000012','booking','{}');
insert into incoming_transfer_notes(id,transfer_id,actor_id,note)
  select 'ed120010-0000-4000-8000-000000000015',id,'ed120010-0000-4000-8000-000000000001','Ghi chú đối soát cần được giữ lại' from incoming_transfers where transaction_key='testbank:12345678:987654321';
insert into notifications(user_id,booking_id,kind,channel,title) values
  ('ed120010-0000-4000-8000-000000000003','ed120010-0000-4000-8000-000000000012','new_booking','app','Thông báo đơn cần giữ');
insert into feedback(id,user_id,category,title,message,booking_id,receipt_path) values
  ('ed120010-0000-4000-8000-000000000014','ed120010-0000-4000-8000-000000000003','support','Đối soát SANZXY987','Yêu cầu đối soát cần được giữ lại','ed120010-0000-4000-8000-000000000012','ed120010-0000-4000-8000-000000000003/ed120010-0000-4000-8000-000000000014.jpg');
insert into booking_requests(user_id,request_id,payload_hash,booking_id) values
  ('ed120010-0000-4000-8000-000000000003','ed120010-0000-4000-8000-000000000016',decode(repeat('00',32),'hex'),'ed120010-0000-4000-8000-000000000012');
-- Owner deletion remains guarded, even though admin may permanently delete.
select set_config('request.jwt.claim.sub','ed120010-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
  begin
    perform delete_venue('ed120010-0000-4000-8000-000000000010');
    raise exception 'TEST: owner deleted venue with booking history';
  exception when raise_exception then if sqlerrm <> 'VENUE_HAS_BOOKINGS' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','ed120010-0000-4000-8000-000000000001',true);
insert into tournaments(id,manager_id,court_id,title,description,sport,address,starts_at,ends_at,registration_deadline,payment_deadline,capacity,entry_fee,deposit_amount) values
  ('ed120010-0000-4000-8000-000000000013','ed120010-0000-4000-8000-000000000003','ed120010-0000-4000-8000-000000000011','Giải kiểm tra xóa sân','Thể lệ kiểm tra đủ dài','badminton','Hòa Lạc, Hà Nội',now()+interval '5 days',now()+interval '5 days 2 hours',now()+interval '4 days',now()+interval '5 days',4,0,0);
update tournaments set status='published' where id='ed120010-0000-4000-8000-000000000013';
insert into court_closures(court_id,starts_at,ends_at,reason,tournament_id)
  select court_id,starts_at,ends_at,'Giải kiểm tra',id from tournaments where id='ed120010-0000-4000-8000-000000000013';
insert into tournament_settlements(tournament_id,owner_id,venue_fee,agreed_at,due_at) values
  ('ed120010-0000-4000-8000-000000000013','ed120010-0000-4000-8000-000000000002',100000,now(),now()+interval '7 days');

update profiles set banned_until=now()+interval '1 day' where id='ed120010-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
  begin
    perform admin_delete_venue('ed120010-0000-4000-8000-000000000010');
    raise exception 'TEST: banned admin deleted venue';
  exception when raise_exception then if sqlerrm <> 'FORBIDDEN' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
update profiles set banned_until=null where id='ed120010-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','ed120010-0000-4000-8000-000000000001',true);
set local role authenticated;
select admin_delete_venue('ed120010-0000-4000-8000-000000000010');
do $$ begin
  begin
    perform admin_delete_venue('ed120010-0000-4000-8000-000000000010');
    raise exception 'TEST: missing venue accepted';
  exception when raise_exception then if sqlerrm <> 'VENUE_NOT_FOUND' then raise; end if; end;
end $$;
reset role;
do $$ begin
  assert not exists(select 1 from venues where id='ed120010-0000-4000-8000-000000000010');
  assert not exists(select 1 from courts where id='ed120010-0000-4000-8000-000000000011');
  assert not exists(select 1 from price_rules where court_id='ed120010-0000-4000-8000-000000000011');
  assert not exists(select 1 from court_closures where court_id='ed120010-0000-4000-8000-000000000011');
  assert not exists(select 1 from venue_favorites where venue_id='ed120010-0000-4000-8000-000000000010');
  assert not exists(select 1 from bookings where id='ed120010-0000-4000-8000-000000000012');
  assert not exists(select 1 from bookings where court_id='ed120010-0000-4000-8000-000000000011');
  assert not exists(select 1 from payments where bank_tx_id='venue-delete-test');
  assert not exists(select 1 from sepay_events where transaction_key='legacy:987654321');
  assert not exists(select 1 from booking_requests where request_id='ed120010-0000-4000-8000-000000000016');
  assert not exists(select 1 from tournaments where id='ed120010-0000-4000-8000-000000000013');
  assert not exists(select 1 from tournament_settlements where tournament_id='ed120010-0000-4000-8000-000000000013');
  assert exists(select 1 from incoming_transfers where transaction_key='testbank:12345678:987654321' and booking_id is null and amount=100000 and ref_codes=array['SANZXY987']);
  assert exists(select 1 from incoming_transfer_notes where id='ed120010-0000-4000-8000-000000000015');
  assert exists(select 1 from sepay_transfer_claims where transaction_key='testbank:12345678:987654321');
  assert exists(select 1 from feedback where id='ed120010-0000-4000-8000-000000000014' and booking_id is null and deleted_booking_code='SANZXY987' and receipt_path is not null);
  assert exists(select 1 from notifications where title='Thông báo đơn cần giữ' and user_id='ed120010-0000-4000-8000-000000000003' and booking_id is null);
  assert (select count(*)=2 from notifications where title='Cụm sân đã được xóa' and body like '%Xóa sân kiểm tra%');
  assert not has_function_privilege('anon','public.admin_delete_venue(uuid)','execute');
  assert not has_table_privilege('authenticated','public.venues','delete');
end $$;
rollback;
