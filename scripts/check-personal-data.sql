-- Run against the linked schema; every fixture/config change is rolled back.
-- For pre-deploy checks, wrap the candidate migration and this script in one transaction.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

insert into auth.users(id) values
  ('e0280000-0000-4000-8000-000000000001'),
  ('e0280000-0000-4000-8000-000000000002'),
  ('e0280000-0000-4000-8000-000000000003');
update public.profiles set role = 'owner', owner_application_status = 'active',
  payout_bank = 'MB', payout_account = '1234567890'
where id = 'e0280000-0000-4000-8000-000000000001';
update public.profiles set phone = '0900000999'
where id = 'e0280000-0000-4000-8000-000000000002';

-- The singleton is changed only inside this short rollback transaction.
insert into public.booking_operator(owner_id, bank, account_number, account_name, accepts_new_bookings, multi_owner_enabled)
values ('e0280000-0000-4000-8000-000000000001', 'MBBank', '1234567890', 'ROLLBACK CHECK', true, false)
on conflict(singleton) do update set owner_id = excluded.owner_id, bank = excluded.bank,
  account_number = excluded.account_number, account_name = excluded.account_name,
  accepts_new_bookings = true, multi_owner_enabled = false;
insert into public.venues(id, owner_id, slug, name, address, district, status)
values ('e0280000-0000-4000-8000-000000000010', 'e0280000-0000-4000-8000-000000000001',
  'personal-data-rollback', 'Booking input rollback', 'Rollback fixture', 'Test', 'active');
insert into public.courts(id, venue_id, name, sport, slot_minutes, open_time, close_time) values
  ('e0280000-0000-4000-8000-000000000030', 'e0280000-0000-4000-8000-000000000010', '30 minutes', 'badminton', 30, null, null),
  ('e0280000-0000-4000-8000-000000000060', 'e0280000-0000-4000-8000-000000000010', '60 minutes', 'badminton', 60, '06:00', '22:00'),
  ('e0280000-0000-4000-8000-000000000090', 'e0280000-0000-4000-8000-000000000010', '90 minutes', 'badminton', 90, null, null),
  ('e0280000-0000-4000-8000-000000000120', 'e0280000-0000-4000-8000-000000000010', '120 minutes', 'badminton', 120, null, null);
insert into public.price_rules(court_id, days, start_time, end_time, price_per_hour)
select id, '{0,1,2,3,4,5,6}'::int[], '05:00'::time, '23:00'::time, 100500
from public.courts where venue_id = 'e0280000-0000-4000-8000-000000000010';




update public.profiles set role='admin' where id='e0280000-0000-4000-8000-000000000002';
insert into public.bookings(code,court_id,user_id,starts_at,ends_at,status,total_amount,deposit_amount,customer_phone,created_at)
 values('SANPRI234','e0280000-0000-4000-8000-000000000060','e0280000-0000-4000-8000-000000000003',
 now()+interval '2 days',now()+interval '2 days 1 hour','pending',100000,100000,'0901234567',now()-interval '1 day');

select set_config('request.jwt.claim.sub','e0280000-0000-4000-8000-000000000003',true);
set local role authenticated;
select public.submit_data_request('e0280000-0000-4000-8000-000000000401','delete','Tôi cần xóa phần thông tin hồ sơ kết nối.');
select public.submit_data_request('e0280000-0000-4000-8000-000000000401','delete','Tôi cần xóa phần thông tin hồ sơ kết nối.');
do $$ declare e jsonb;begin
 e:=public.get_my_data_export();
 assert jsonb_array_length(e->'bookings')=1 and e->'bookings'->0->>'code'='SANPRI234';
 assert jsonb_array_length(e->'requests')=1;
 assert e->'account'->>'id'=auth.uid()::text;
 assert e::text not like '%access_token%' and e::text not like '%business_license_path%' and e::text not like '%webhook%';
 begin perform public.get_retention_review();raise exception 'CHECK_FAILED';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 assert (select count(*)=1 from public.operations_audit where entity_id='e0280000-0000-4000-8000-000000000401' and action='privacy.requested');
 assert not has_function_privilege('anon','public.get_my_data_export()','execute');
end $$;
select set_config('request.jwt.claim.sub','e0280000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare e jsonb;begin
 e:=public.get_my_data_export();assert jsonb_array_length(e->'bookings')=0,'owner export does not include customer bookings';
 begin perform public.submit_data_request('e0280000-0000-4000-8000-000000000401','delete','Tôi cần xóa phần thông tin hồ sơ kết nối.');raise exception 'CHECK_FAILED';exception when invalid_parameter_value then assert sqlerrm='FEEDBACK_CONFLICT';end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','e0280000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare stamp timestamptz;begin
 select updated_at into stamp from public.feedback where id='e0280000-0000-4000-8000-000000000401';
 begin perform public.review_feedback('e0280000-0000-4000-8000-000000000401','resolved','Xong rồi',stamp);raise exception 'CHECK_FAILED';exception when invalid_parameter_value then assert sqlerrm='PRIVACY_REPLY_REQUIRED';end;
 perform public.review_feedback('e0280000-0000-4000-8000-000000000401','reviewing','Đang kiểm tra phạm vi dữ liệu.',stamp);
end $$;
reset role;
-- Candidate counters have a baseline so existing operating data never affects expectations.
create temp table retention_before as select (public.get_retention_review()->>'total')::int total;
update public.profiles set owner_application_status='rejected',business_license_path='fixture/no-file.pdf' where id='e0280000-0000-4000-8000-000000000001';
insert into public.owner_application_reviews(owner_id,reviewer_id,status,reason,created_at)
 values('e0280000-0000-4000-8000-000000000001','e0280000-0000-4000-8000-000000000002','rejected','Hồ sơ rollback chưa đạt yêu cầu',now()-interval '91 days');
insert into public.feedback(id,user_id,category,title,message,status,reply,updated_at,booking_id) values
 ('e0280000-0000-4000-8000-000000000501','e0280000-0000-4000-8000-000000000003','support','Old support','Old support description fixture','closed','Đã giải quyết xong',now()-interval '181 days',null),
 ('e0280000-0000-4000-8000-000000000502','e0280000-0000-4000-8000-000000000003','support','Linked support','Linked support description fixture','closed','Đã giải quyết xong',now()-interval '181 days',(select id from public.bookings where code='SANPRI234'));
do $$ begin
 assert (public.get_retention_review()->>'total')::int=(select total+2 from retention_before);
end $$;
insert into public.notifications(user_id,kind,channel,title,body)
 select 'e0280000-0000-4000-8000-000000000003','new_booking','app','Export limit fixture','Không gửi nhà cung cấp' from generate_series(1,1001);
select set_config('request.jwt.claim.sub','e0280000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
 begin perform public.get_my_data_export();raise exception 'CHECK_FAILED';exception when invalid_parameter_value then assert sqlerrm='EXPORT_TOO_LARGE';end;
end $$;
rollback;
