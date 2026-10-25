-- Run against the linked schema; every fixture/config change is rolled back.
-- For pre-deploy checks, wrap the candidate migration and this script in one transaction.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

insert into auth.users(id) values
  ('e0270000-0000-4000-8000-000000000001'),
  ('e0270000-0000-4000-8000-000000000002'),
  ('e0270000-0000-4000-8000-000000000003');
update public.profiles set role = 'owner', owner_application_status = 'active',
  payout_bank = 'MB', payout_account = '1234567890'
where id = 'e0270000-0000-4000-8000-000000000001';
update public.profiles set phone = '0900000999'
where id = 'e0270000-0000-4000-8000-000000000002';

-- The singleton is changed only inside this short rollback transaction.
insert into public.booking_operator(owner_id, bank, account_number, account_name, accepts_new_bookings, multi_owner_enabled)
values ('e0270000-0000-4000-8000-000000000001', 'MBBank', '1234567890', 'ROLLBACK CHECK', true, false)
on conflict(singleton) do update set owner_id = excluded.owner_id, bank = excluded.bank,
  account_number = excluded.account_number, account_name = excluded.account_name,
  accepts_new_bookings = true, multi_owner_enabled = false;
insert into public.venues(id, owner_id, slug, name, address, district, status)
values ('e0270000-0000-4000-8000-000000000010', 'e0270000-0000-4000-8000-000000000001',
  'moderation-rollback', 'Booking input rollback', 'Rollback fixture', 'Test', 'active');
insert into public.courts(id, venue_id, name, sport, slot_minutes, open_time, close_time) values
  ('e0270000-0000-4000-8000-000000000030', 'e0270000-0000-4000-8000-000000000010', '30 minutes', 'badminton', 30, null, null),
  ('e0270000-0000-4000-8000-000000000060', 'e0270000-0000-4000-8000-000000000010', '60 minutes', 'badminton', 60, '06:00', '22:00'),
  ('e0270000-0000-4000-8000-000000000090', 'e0270000-0000-4000-8000-000000000010', '90 minutes', 'badminton', 90, null, null),
  ('e0270000-0000-4000-8000-000000000120', 'e0270000-0000-4000-8000-000000000010', '120 minutes', 'badminton', 120, null, null);
insert into public.price_rules(court_id, days, start_time, end_time, price_per_hour)
select id, '{0,1,2,3,4,5,6}'::int[], '05:00'::time, '23:00'::time, 100500
from public.courts where venue_id = 'e0270000-0000-4000-8000-000000000010';




update public.profiles set role='admin' where id='e0270000-0000-4000-8000-000000000002';
insert into public.bookings(code,court_id,user_id,starts_at,ends_at,status,total_amount,deposit_amount,customer_phone,created_at)
 values('SANMOD234','e0270000-0000-4000-8000-000000000060','e0270000-0000-4000-8000-000000000003',
 now()+interval '2 days',now()+interval '2 days 1 hour','pending',100000,100000,'0901234567',now()-interval '1 day');

insert into public.community_profiles(user_id,display_name,phone,location,sport,skill_level,is_public)
 values('e0270000-0000-4000-8000-000000000003','Moderation fixture','0901111111','Moderation rollback','badminton','beginner',true);
insert into public.tournaments(id,manager_id,court_id,title,description,sport,address,starts_at,ends_at,registration_deadline,payment_deadline,capacity,entry_fee,deposit_amount,status)
 values('e0270000-0000-4000-8000-000000000201','e0270000-0000-4000-8000-000000000001','e0270000-0000-4000-8000-000000000060',
 'Moderation fixture','Description rollback','badminton','Rollback address',now()+interval '10 days',now()+interval '10 days 2 hours',now()+interval '9 days',now()+interval '9 days',8,100000,100000,'published');
insert into public.tournament_registrations(id,tournament_id,user_id,full_name,phone,address,entry_fee,deposit_amount,code,status,paid_at)
 values('e0270000-0000-4000-8000-000000000301','e0270000-0000-4000-8000-000000000201','e0270000-0000-4000-8000-000000000003','Existing player','0901111111','Test address',100000,100000,'GIAIE02700000301','approved',now()),
 ('e0270000-0000-4000-8000-000000000302','e0270000-0000-4000-8000-000000000201','e0270000-0000-4000-8000-000000000002','Pending player','0901111111','Test address',100000,100000,'GIAIE02700000302','pending',null);
select set_config('request.jwt.claim.sub','e0270000-0000-4000-8000-000000000003',true);
set local role authenticated;
select public.submit_feedback('e0270000-0000-4000-8000-000000000401','report','Báo cáo nội dung','Nội dung có dấu hiệu không phù hợp.','/giai-dau/e0270000-0000-4000-8000-000000000201');
do $$ begin
 begin perform public.set_content_moderation('community',auth.uid(),true,'Unauthorized action',null);raise exception 'CHECK_FAILED';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','e0270000-0000-4000-8000-000000000002',true);
set local role authenticated;
select public.set_content_moderation('community','e0270000-0000-4000-8000-000000000003',true,'Nội dung cần được kiểm tra lại',null);
select public.set_content_moderation('tournament','e0270000-0000-4000-8000-000000000201',true,'Thông tin giải cần được kiểm tra',null);
do $$ begin
 assert not has_table_privilege('authenticated','public.content_moderation','select');
 assert not has_function_privilege('anon','public.get_content_moderation(text,uuid)','execute');
 begin perform public.set_content_moderation('community','e0270000-0000-4000-8000-000000000003',false,'Thử ghi với phiên bản cũ',null);raise exception 'CHECK_FAILED';exception when invalid_parameter_value then assert sqlerrm='CONTENT_CHANGED';end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
 assert public.get_community_profile('e0270000-0000-4000-8000-000000000003') is null;
 assert (public.search_community('','Moderation rollback',1)->>'total')::int=0;
 assert not exists(select 1 from public.tournaments where id='e0270000-0000-4000-8000-000000000201');
 assert public.get_tournament_capacity('e0270000-0000-4000-8000-000000000201')=0;
end $$;
reset role;
do $$ begin
 assert exists(select 1 from public.tournament_registrations where id='e0270000-0000-4000-8000-000000000301' and paid_at is not null and status='approved');
 assert exists(select 1 from public.tournaments where id='e0270000-0000-4000-8000-000000000201' and status='published');
 begin update public.tournament_registrations set status='approved' where id='e0270000-0000-4000-8000-000000000302';raise exception 'CHECK_FAILED';exception when invalid_parameter_value then assert sqlerrm='CONTENT_HIDDEN';end;
 -- Existing financial updates are not blocked or altered.
 update public.tournament_registrations set note='Updated without cancel' where id='e0270000-0000-4000-8000-000000000301';
end $$;
select set_config('request.jwt.claim.sub','e0270000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
 assert public.get_community_profile(auth.uid()) is not null;
 assert exists(select 1 from public.tournaments where id='e0270000-0000-4000-8000-000000000201');
end $$;
reset role;
select set_config('request.jwt.claim.sub','e0270000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 begin perform public.register_tournament('e0270000-0000-4000-8000-000000000201','{"full_name":"New player","phone":"0901111111","address":"Test address"}');raise exception 'CHECK_FAILED';exception when invalid_parameter_value then assert sqlerrm='CONTENT_HIDDEN';end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','e0270000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare s jsonb;begin
 s:=public.get_content_moderation('community','e0270000-0000-4000-8000-000000000003');
 perform public.set_content_moderation('community','e0270000-0000-4000-8000-000000000003',false,'Đã kiểm tra và khôi phục hồ sơ',(s->>'updated_at')::timestamptz);
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
 assert public.get_community_profile('e0270000-0000-4000-8000-000000000003') is not null;
 assert (public.get_community_profile('e0270000-0000-4000-8000-000000000003')->>'phone')='';
end $$;
rollback;
