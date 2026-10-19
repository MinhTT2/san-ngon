-- Disposable fixtures and all changes are rolled back, including notifications.
begin;
insert into auth.users(id) values
 ('ed120000-0000-4000-8000-000000000001'),
 ('ed120000-0000-4000-8000-000000000002'),
 ('ed120000-0000-4000-8000-000000000003'),
 ('ed120000-0000-4000-8000-000000000004');
update profiles set role='admin' where id='ed120000-0000-4000-8000-000000000001';
update profiles set role='owner',owner_application_status='active' where id='ed120000-0000-4000-8000-000000000002';
update profiles set role='owner',owner_application_status='active' where id='ed120000-0000-4000-8000-000000000004';
insert into venues(id,owner_id,name,slug,address,district,open_time,close_time)
values('ed120000-0000-4000-8000-000000000010','ed120000-0000-4000-8000-000000000002',
 'Sân test xóa giải','test-admin-delete-tournament','Địa chỉ kiểm tra','Cầu Giấy','06:00','23:00');
insert into courts(id,venue_id,name,sport)
values('ed120000-0000-4000-8000-000000000011','ed120000-0000-4000-8000-000000000010','Sân test','badminton');
insert into tournaments(id,manager_id,court_id,title,description,sport,address,starts_at,ends_at,
 registration_deadline,payment_deadline,capacity,entry_fee,deposit_amount,status)
select ('ed120000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'ed120000-0000-4000-8000-000000000002','ed120000-0000-4000-8000-000000000011',
 'Giải test xóa '||n,'Thể lệ kiểm tra đủ dài','badminton','Địa chỉ kiểm tra',
 now()+n*interval '1 day',now()+n*interval '1 day'+interval '2 hours',
 now()+interval '1 day',now()+interval '2 days',10,200000,100000,
 case n when 100 then 'pending' when 101 then 'rejected' when 102 then 'cancelled' when 103 then 'completed' else 'published' end
from generate_series(100,111) n;
-- A player organizer cannot gain permanent-delete permissions through management.
update tournaments set manager_id='ed120000-0000-4000-8000-000000000003' where id='ed120000-0000-4000-8000-000000000104';
insert into court_closures(court_id,starts_at,ends_at,reason,tournament_id)
select court_id,starts_at,ends_at,'Giải đấu test',id from tournaments
where id between 'ed120000-0000-4000-8000-000000000104' and 'ed120000-0000-4000-8000-000000000111';
insert into tournament_settlements(tournament_id,owner_id,venue_fee,agreed_at,due_at)
select id,manager_id,0,now(),ends_at+interval '7 days' from tournaments
where id between 'ed120000-0000-4000-8000-000000000104' and 'ed120000-0000-4000-8000-000000000111';
insert into tournament_registrations(id,tournament_id,user_id,full_name,phone,address,entry_fee,deposit_amount,code)
select ('ed120000-0000-4000-8000-'||lpad((n+100)::text,12,'0'))::uuid,
 ('ed120000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'ed120000-0000-4000-8000-000000000003',
 'Người chơi test','0900000003','Hà Nội',200000,100000,'GIAI'||lpad(n::text,12,'0')
from generate_series(104,110) n;
insert into notifications(user_id,kind,channel,title,body,tournament_id)
values('ed120000-0000-4000-8000-000000000003','tournament','app','Thông báo test','Thông báo trước khi xóa',
 'ed120000-0000-4000-8000-000000000104');

create function pg_temp.expect_delete_error(p_id uuid,p_error text)
returns void language plpgsql as $$
begin
  begin
    perform public.delete_tournament(p_id);
    raise exception 'TEST: expected %',p_error;
  exception when raise_exception then
    if sqlerrm<>p_error then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub','ed120000-0000-4000-8000-000000000003',true);
set local role authenticated;
select pg_temp.expect_delete_error('ed120000-0000-4000-8000-000000000104','FORBIDDEN');
reset role;
select set_config('request.jwt.claim.sub','ed120000-0000-4000-8000-000000000004',true);
set local role authenticated;
select pg_temp.expect_delete_error('ed120000-0000-4000-8000-000000000104','FORBIDDEN');
reset role;
update profiles set banned_until=now()+interval '1 day' where id='ed120000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','ed120000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.expect_delete_error('ed120000-0000-4000-8000-000000000104','FORBIDDEN');
do $$ begin
 begin
  delete from tournaments where id='ed120000-0000-4000-8000-000000000104';
  raise exception 'TEST: direct delete permitted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
update profiles set banned_until=null where id='ed120000-0000-4000-8000-000000000001';
update profiles set banned_until=now()+interval '1 day' where id='ed120000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','ed120000-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.expect_delete_error('ed120000-0000-4000-8000-000000000104','FORBIDDEN');
reset role;
select set_config('request.jwt.claim.sub','',true);
update profiles set banned_until=null where id='ed120000-0000-4000-8000-000000000002';

-- Keep QR references even when cancelled/expired; keep underpayments and refunded receipts.
update tournament_registrations set bank='TestBank',status='cancelled' where id='ed120000-0000-4000-8000-000000000205';
update tournament_registrations set paid_at=now() where id='ed120000-0000-4000-8000-000000000206';
update tournament_registrations set balance_received_at=now() where id='ed120000-0000-4000-8000-000000000207';
insert into tournament_payment_events(transaction_key,registration_id,amount,raw,outcome,refund_amount,refunded_amount,refund_status)
values('admin-delete-test:underpaid','ed120000-0000-4000-8000-000000000208',1000,'{}','underpaid',1000,1000,'done');
insert into tournament_transfers(tournament_id,amount,receipt,recorded_by)
values('ed120000-0000-4000-8000-000000000109',10000,'Chứng từ test','ed120000-0000-4000-8000-000000000002');
update tournament_registrations set balance_refund_due=10000 where id='ed120000-0000-4000-8000-000000000210';
update tournament_settlements set venue_fee=10000 where tournament_id='ed120000-0000-4000-8000-000000000111';
insert into incoming_transfers(transaction_key,receiver_owner_id,bank,account_number,bank_tx_id,amount,ref_codes,source,raw)
values('admin-delete-test:receipt','ed120000-0000-4000-8000-000000000002','testbank','12345678','987654321',1000,array['GIAI000000000108'],'tournament','{}');
select set_config('request.jwt.claim.sub','ed120000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 for n in 105..111 loop
  perform pg_temp.expect_delete_error(('ed120000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'TOURNAMENT_HAS_FINANCIAL_HISTORY');
 end loop;
 perform delete_tournament('ed120000-0000-4000-8000-000000000104');
end $$;
select pg_temp.expect_delete_error('ed120000-0000-4000-8000-000000000104','TOURNAMENT_NOT_FOUND');
reset role;
do $$ begin
 assert (select count(*)=7 from court_closures where tournament_id between 'ed120000-0000-4000-8000-000000000105' and 'ed120000-0000-4000-8000-000000000111');
end $$;
-- Admin can delete every status and all financial histories.
select set_config('request.jwt.claim.sub','ed120000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 for n in 100..111 loop
  if n<>104 then perform delete_tournament(('ed120000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid); end if;
 end loop;
end $$;
reset role;
do $$ begin
 assert not has_function_privilege('anon','public.delete_tournament(uuid)','execute');
 assert has_function_privilege('authenticated','public.delete_tournament(uuid)','execute');
 assert not exists(select 1 from tournaments where id between 'ed120000-0000-4000-8000-000000000100' and 'ed120000-0000-4000-8000-000000000111');
 assert not exists(select 1 from tournament_registrations where tournament_id='ed120000-0000-4000-8000-000000000104');
 assert not exists(select 1 from tournament_settlements where tournament_id='ed120000-0000-4000-8000-000000000104');
 assert not exists(select 1 from court_closures where tournament_id='ed120000-0000-4000-8000-000000000104');
 assert not exists(select 1 from court_closures where tournament_id between 'ed120000-0000-4000-8000-000000000100' and 'ed120000-0000-4000-8000-000000000111');
 assert not exists(select 1 from tournament_payment_events where transaction_key='admin-delete-test:underpaid');
 assert not exists(select 1 from tournament_transfers where tournament_id='ed120000-0000-4000-8000-000000000109');
 assert exists(select 1 from sepay_transfer_claims where transaction_key='admin-delete-test:underpaid');
 assert exists(select 1 from incoming_transfers where transaction_key='admin-delete-test:receipt');
 assert exists(select 1 from notifications where user_id='ed120000-0000-4000-8000-000000000003' and title='Thông báo test' and tournament_id is null);
 assert (select count(*)=1 from notifications where user_id='ed120000-0000-4000-8000-000000000002' and title='Giải đấu đã được xóa' and body like '%Giải test xóa 104%');
 assert exists(select 1 from notifications where user_id='ed120000-0000-4000-8000-000000000003' and title='Giải đấu đã được xóa' and tournament_id is null);
end $$;
rollback;
