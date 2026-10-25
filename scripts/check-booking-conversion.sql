-- Run against the linked schema; every fixture/config change is rolled back.
-- For pre-deploy checks, wrap the candidate migration and this script in one transaction.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

insert into auth.users(id) values
  ('e0260000-0000-4000-8000-000000000001'),
  ('e0260000-0000-4000-8000-000000000002'),
  ('e0260000-0000-4000-8000-000000000003');
update public.profiles set role = 'owner', owner_application_status = 'active',
  payout_bank = 'MB', payout_account = '1234567890'
where id = 'e0260000-0000-4000-8000-000000000001';
update public.profiles set phone = '0900000999'
where id = 'e0260000-0000-4000-8000-000000000002';

-- The singleton is changed only inside this short rollback transaction.
insert into public.booking_operator(owner_id, bank, account_number, account_name, accepts_new_bookings, multi_owner_enabled)
values ('e0260000-0000-4000-8000-000000000001', 'MBBank', '1234567890', 'ROLLBACK CHECK', true, false)
on conflict(singleton) do update set owner_id = excluded.owner_id, bank = excluded.bank,
  account_number = excluded.account_number, account_name = excluded.account_name,
  accepts_new_bookings = true, multi_owner_enabled = false;
insert into public.venues(id, owner_id, slug, name, address, district, status)
values ('e0260000-0000-4000-8000-000000000010', 'e0260000-0000-4000-8000-000000000001',
  'booking-conversion-rollback', 'Booking input rollback', 'Rollback fixture', 'Test', 'active');
insert into public.courts(id, venue_id, name, sport, slot_minutes, open_time, close_time) values
  ('e0260000-0000-4000-8000-000000000030', 'e0260000-0000-4000-8000-000000000010', '30 minutes', 'badminton', 30, null, null),
  ('e0260000-0000-4000-8000-000000000060', 'e0260000-0000-4000-8000-000000000010', '60 minutes', 'badminton', 60, '06:00', '22:00'),
  ('e0260000-0000-4000-8000-000000000090', 'e0260000-0000-4000-8000-000000000010', '90 minutes', 'badminton', 90, null, null),
  ('e0260000-0000-4000-8000-000000000120', 'e0260000-0000-4000-8000-000000000010', '120 minutes', 'badminton', 120, null, null);
insert into public.price_rules(court_id, days, start_time, end_time, price_per_hour)
select id, '{0,1,2,3,4,5,6}'::int[], '05:00'::time, '23:00'::time, 100500
from public.courts where venue_id = 'e0260000-0000-4000-8000-000000000010';




update public.profiles set role='admin' where id='e0260000-0000-4000-8000-000000000002';
insert into public.bookings(code,court_id,user_id,starts_at,ends_at,status,total_amount,deposit_amount,customer_phone,created_at)
 values('SANFUN234','e0260000-0000-4000-8000-000000000060','e0260000-0000-4000-8000-000000000003',
 now()+interval '2 days',now()+interval '2 days 1 hour','pending',100000,100000,'0901234567',now()-interval '1 day');

insert into public.payments(booking_id,amount,ref_code,status,provider) select id,100000,code,'paid','sepay' from public.bookings where code='SANFUN234';
update public.bookings set paid_at=now(),status='confirmed' where code='SANFUN234';
select set_config('request.jwt.claim.sub','e0260000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare a jsonb;b jsonb;begin
 a:=public.get_booking_conversion(7);
 assert (a->>'created')::int>0 and (a->>'paid')::int>0;
 assert (a->>'created')::int=(a->>'paid')::int+(a->>'holding')::int+(a->>'ended')::int;
 assert jsonb_array_length(a->'daily')=7;
 assert (select sum((v->>'created')::int)=(a->>'created')::int from jsonb_array_elements(a->'daily')v);
 assert not(a ? 'rows') and a::text not like '%customer_phone%';
 begin perform public.get_booking_conversion(8);raise exception 'CHECK_FAILED';exception when invalid_parameter_value then null;end;
end $$;
reset role;
create temp table conversion_before as select public.get_booking_conversion(7) result;
grant select on conversion_before to authenticated;
update public.payments set provider='simulation' where ref_code='SANFUN234';
set local role authenticated;
do $$ declare r jsonb;begin
 r:=public.get_booking_conversion(7);
 assert (r->>'paid')::int=(select (result->>'paid')::int-1 from pg_temp.conversion_before);
 assert (select sum((v->>'paid')::int)=(r->>'paid')::int from jsonb_array_elements(r->'daily')v);
end $$;
reset role;
select set_config('request.jwt.claim.sub','e0260000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 assert not has_function_privilege('anon','public.get_booking_conversion(int)','execute');
 begin perform public.get_booking_conversion(7);raise exception 'CHECK_FAILED';exception when insufficient_privilege then null;end;
end $$;
rollback;
