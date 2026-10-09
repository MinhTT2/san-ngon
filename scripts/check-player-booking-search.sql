-- Run against the linked schema; every fixture/config change is rolled back.
-- For pre-deploy checks, wrap the candidate migration and this script in one transaction.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

insert into auth.users(id) values
  ('e0920000-0000-4000-8000-000000000001'),
  ('e0920000-0000-4000-8000-000000000002'),
  ('e0920000-0000-4000-8000-000000000003');
update public.profiles set role = 'owner', owner_application_status = 'active',
  payout_bank = 'MB', payout_account = '1234567890'
where id = 'e0920000-0000-4000-8000-000000000001';
update public.profiles set phone = '0900000999'
where id = 'e0920000-0000-4000-8000-000000000002';

-- The singleton is changed only inside this short rollback transaction.
insert into public.booking_operator(owner_id, bank, account_number, account_name, accepts_new_bookings, multi_owner_enabled)
values ('e0920000-0000-4000-8000-000000000001', 'MBBank', '1234567890', 'ROLLBACK CHECK', true, false)
on conflict(singleton) do update set owner_id = excluded.owner_id, bank = excluded.bank,
  account_number = excluded.account_number, account_name = excluded.account_name,
  accepts_new_bookings = true, multi_owner_enabled = false;
insert into public.venues(id, owner_id, slug, name, address, district, status)
values ('e0920000-0000-4000-8000-000000000010', 'e0920000-0000-4000-8000-000000000001',
  'booking-input-guards-rollback', 'Booking input rollback', 'Rollback fixture', 'Test', 'active');
insert into public.courts(id, venue_id, name, sport, slot_minutes, open_time, close_time) values
  ('e0920000-0000-4000-8000-000000000030', 'e0920000-0000-4000-8000-000000000010', '30 minutes', 'badminton', 30, null, null),
  ('e0920000-0000-4000-8000-000000000060', 'e0920000-0000-4000-8000-000000000010', '60 minutes', 'badminton', 60, '06:00', '22:00'),
  ('e0920000-0000-4000-8000-000000000090', 'e0920000-0000-4000-8000-000000000010', '90 minutes', 'badminton', 90, null, null),
  ('e0920000-0000-4000-8000-000000000120', 'e0920000-0000-4000-8000-000000000010', '120 minutes', 'badminton', 120, null, null);
insert into public.price_rules(court_id, days, start_time, end_time, price_per_hour)
select id, '{0,1,2,3,4,5,6}'::int[], '05:00'::time, '23:00'::time, 100500
from public.courts where venue_id = 'e0920000-0000-4000-8000-000000000010';



update public.profiles set role='owner',owner_application_status='active',payout_bank='MB',payout_account='1234567890' where id='e0920000-0000-4000-8000-000000000002';
insert into public.venues(id,owner_id,slug,name,address,district,status) values('e0920000-0000-4000-8000-000000000011','e0920000-0000-4000-8000-000000000002','owner-search-other-rollback','Other fixture','Fixture','Test','active');
insert into public.bookings(code,court_id,user_id,starts_at,ends_at,status,total_amount,deposit_amount,customer_name,customer_phone)
select case when i=-1 then 'SANXYZ234' else 'SAN'||public.gen_booking_code() end,
 'e0920000-0000-4000-8000-000000000060','e0920000-0000-4000-8000-000000000003',
 (((now() at time zone 'Asia/Ho_Chi_Minh')::date+i)::timestamp+interval '18 hours') at time zone 'Asia/Ho_Chi_Minh',
 (((now() at time zone 'Asia/Ho_Chi_Minh')::date+i)::timestamp+interval '19 hours') at time zone 'Asia/Ho_Chi_Minh',
 (case when i<0 then 'completed' when i=2 then 'pending' else 'confirmed' end)::public.booking_status,
 100000,100000,case when i=-1 then 'Khách %_ cũ' else 'Khách kiểm tra' end,
 case when i=-1 then '0912345678' else '0900000002' end
from generate_series(-5,35) i where i<>0;

update public.bookings set status='cancelled',refund_status='needed' where code='SANXYZ234';

-- Add states which must be classified correctly without cron.
insert into public.bookings(code,court_id,user_id,starts_at,ends_at,status,total_amount,deposit_amount,customer_phone,expires_at)
select code,'e0920000-0000-4000-8000-000000000060',usr,
 (((now() at time zone 'Asia/Ho_Chi_Minh')::date+day)::timestamp+interval '20 hours') at time zone 'Asia/Ho_Chi_Minh',
 (((now() at time zone 'Asia/Ho_Chi_Minh')::date+day)::timestamp+interval '21 hours') at time zone 'Asia/Ho_Chi_Minh',status::public.booking_status,100000,100000,'0900000003',now()-interval '1 minute'
from (values ('SANAAA222',36,'pending','e0920000-0000-4000-8000-000000000003'::uuid),
 ('SANAAA333',-7,'confirmed','e0920000-0000-4000-8000-000000000003'::uuid),
 ('SANAAA444',37,'completed','e0920000-0000-4000-8000-000000000002'::uuid)) f(code,day,status,usr);
do $$ begin
 assert not has_function_privilege('anon','public.search_my_bookings(text,text,int,date,date)','EXECUTE');
end $$;
select set_config('request.jwt.claim.sub','e0920000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ declare r jsonb; ids jsonb; today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date; begin
 r:=public.search_my_bookings();
 assert (r->>'total')::int=42 and (r->>'matched')::int=35 and (r->>'pages')::int=2;
 assert (r->>'pending')::int=1 and (r->>'confirmed')::int=34 and (r->>'history')::int=7, 'SQL classifies expiry/past confirmed without cron';
 assert r->'rows'->0->>'status'='pending', 'pending orders first';
 assert jsonb_array_length(r->'rows')=30 and (r->>'now_ms')::bigint>0;
 ids:=r->'rows';
 r:=public.search_my_bookings(p_page=>2);
 assert jsonb_array_length(r->'rows')=5 and (r->>'total')::int=42;
 assert not exists(select 1 from jsonb_array_elements(ids) a join jsonb_array_elements(r->'rows') b on a->>'id'=b->>'id');
 r:=public.search_my_bookings(p_filter=>'all',p_page=>99999);
 assert (r->>'page')::int=2 and jsonb_array_length(r->'rows')=12;
 r:=public.search_my_bookings(p_filter=>'history');
 assert (r->>'matched')::int=7 and jsonb_array_length(r->'rows')=7;
 r:=public.search_my_bookings(p_filter=>'pending'); assert (r->>'matched')::int=1;
 r:=public.search_my_bookings(p_filter=>'confirmed'); assert (r->>'matched')::int=34;
 r:=public.search_my_bookings(p_query=>'sanxyz234',p_filter=>'all');
 assert (r->>'total')::int=1 and r->'rows'->0->>'refund_status'='needed';
 assert r->'rows'->0->'courts'->>'name'='60 minutes' and r->'rows'->0->'courts'->'venues'->>'slug'='booking-input-guards-rollback';
 assert not (r->'rows'->0 ? 'customer_phone') and not (r->'rows'->0 ? 'customer_name'), 'private result contains only needed fields';
 r:=public.search_my_bookings(p_query=>' cau long rollback ',p_filter=>'all'); assert (r->>'total')::int=42, 'unaccented multiword sport/venue search';
 r:=public.search_my_bookings(p_query=>'%_',p_filter=>'all'); assert (r->>'total')::int=0, 'no wildcard or contact search';
 r:=public.search_my_bookings(p_filter=>'all',p_from=>today-2,p_to=>today); assert (r->>'total')::int=2;
 r:=public.search_my_bookings(p_query=>'missing',p_filter=>'all'); assert (r->>'total')::int=0 and r->'rows'='[]'::jsonb and (r->>'page')::int=1;
 begin perform public.search_my_bookings(p_filter=>'fake'); raise exception 'CHECK_FAILED'; exception when others then if sqlerrm<>'INVALID_STATUS' then raise; end if; end;
 begin perform public.search_my_bookings(p_query=>repeat('a',101)); raise exception 'CHECK_FAILED'; exception when others then if sqlerrm<>'QUERY_TOO_LONG' then raise; end if; end;
 begin perform public.search_my_bookings(p_from=>today,p_to=>today-1); raise exception 'CHECK_FAILED'; exception when others then if sqlerrm<>'INVALID_DATE_RANGE' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','e0920000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.search_my_bookings(p_filter=>'all'); assert (r->>'total')::int=1 and r->'rows'->0->>'code'='SANAAA444','own data only even owner';
end $$;
reset role;
-- More than PostgREST's usual row cap: only the selected page crosses HTTP.
insert into public.bookings(code,court_id,user_id,starts_at,ends_at,status,total_amount,deposit_amount,customer_phone)
select 'SAN'||public.gen_booking_code(),'e0920000-0000-4000-8000-000000000060','e0920000-0000-4000-8000-000000000003',
 (((now() at time zone 'Asia/Ho_Chi_Minh')::date-i-100)::timestamp+interval '12 hours') at time zone 'Asia/Ho_Chi_Minh',
 (((now() at time zone 'Asia/Ho_Chi_Minh')::date-i-100)::timestamp+interval '13 hours') at time zone 'Asia/Ho_Chi_Minh',
 'completed',100000,100000,'0900000003' from generate_series(1,1001) i;
select set_config('request.jwt.claim.sub','e0920000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.search_my_bookings(p_filter=>'history',p_page=>9999);
 assert (r->>'total')::int=1043 and (r->>'matched')::int=1008 and (r->>'page')::int=34 and jsonb_array_length(r->'rows')=18, 'history beyond 1000-row read cap stays complete';
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
do $$ begin
 begin perform public.search_my_bookings(); raise exception 'CHECK_FAILED'; exception when others then if sqlerrm<>'AUTH_REQUIRED' then raise; end if; end;
end $$;
reset role;
update public.profiles set banned_until='infinity' where id='e0920000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub','e0920000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
 begin perform public.search_my_bookings(); raise exception 'CHECK_FAILED'; exception when others then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
end $$;
reset role;
rollback;
