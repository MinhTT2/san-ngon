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

-- Cancelled bookings still preserve history.
-- Seed history on a draft without changing the real payment acceptance gate.
set local session_replication_role=replica;
insert into bookings(id,code,court_id,user_id,starts_at,ends_at,total_amount,deposit_amount,status,customer_phone) values
  ('ed120010-0000-4000-8000-000000000012','SANZXY987','ed120010-0000-4000-8000-000000000011','ed120010-0000-4000-8000-000000000003',now()+interval '4 days',now()+interval '4 days 1 hour',100000,100000,'cancelled','0900000003');
set local session_replication_role=origin;
select set_config('request.jwt.claim.sub','ed120010-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
  begin
    perform admin_delete_venue('ed120010-0000-4000-8000-000000000010');
    raise exception 'TEST: deleted venue with booking history';
  exception when raise_exception then if sqlerrm <> 'VENUE_HAS_BOOKINGS' then raise; end if; end;
  assert exists(select 1 from venues where id='ed120010-0000-4000-8000-000000000010');
end $$;
reset role;
delete from bookings where id='ed120010-0000-4000-8000-000000000012';
insert into tournaments(id,manager_id,court_id,title,description,sport,address,starts_at,ends_at,registration_deadline,payment_deadline,capacity,entry_fee,deposit_amount) values
  ('ed120010-0000-4000-8000-000000000013','ed120010-0000-4000-8000-000000000003','ed120010-0000-4000-8000-000000000011','Giải kiểm tra xóa sân','Thể lệ kiểm tra đủ dài','badminton','Hòa Lạc, Hà Nội',now()+interval '5 days',now()+interval '5 days 2 hours',now()+interval '4 days',now()+interval '5 days',4,0,0);
set local role authenticated;
do $$ begin
  begin
    perform admin_delete_venue('ed120010-0000-4000-8000-000000000010');
    raise exception 'TEST: deleted venue with tournament';
  exception when raise_exception then if sqlerrm <> 'VENUE_HAS_TOURNAMENTS' then raise; end if; end;
end $$;
reset role;
delete from tournaments where id='ed120010-0000-4000-8000-000000000013';

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
  assert not has_function_privilege('anon','public.admin_delete_venue(uuid)','execute');
  assert not has_table_privilege('authenticated','public.venues','delete');
end $$;
rollback;
