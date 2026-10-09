-- Run against the linked schema; every fixture/config change is rolled back.
-- For pre-deploy checks, wrap the candidate migration and this script in one transaction.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

insert into auth.users(id) values
  ('e0910000-0000-4000-8000-000000000001'),
  ('e0910000-0000-4000-8000-000000000002'),
  ('e0910000-0000-4000-8000-000000000003');
update public.profiles set role = 'owner', owner_application_status = 'active',
  payout_bank = 'MB', payout_account = '1234567890'
where id = 'e0910000-0000-4000-8000-000000000001';
update public.profiles set phone = '0900000999'
where id = 'e0910000-0000-4000-8000-000000000002';

-- The singleton is changed only inside this short rollback transaction.
insert into public.booking_operator(owner_id, bank, account_number, account_name, accepts_new_bookings, multi_owner_enabled)
values ('e0910000-0000-4000-8000-000000000001', 'MBBank', '1234567890', 'ROLLBACK CHECK', true, false)
on conflict(singleton) do update set owner_id = excluded.owner_id, bank = excluded.bank,
  account_number = excluded.account_number, account_name = excluded.account_name,
  accepts_new_bookings = true, multi_owner_enabled = false;
insert into public.venues(id, owner_id, slug, name, address, district, status)
values ('e0910000-0000-4000-8000-000000000010', 'e0910000-0000-4000-8000-000000000001',
  'booking-input-guards-rollback', 'Booking input rollback', 'Rollback fixture', 'Test', 'active');
insert into public.courts(id, venue_id, name, sport, slot_minutes, open_time, close_time) values
  ('e0910000-0000-4000-8000-000000000030', 'e0910000-0000-4000-8000-000000000010', '30 minutes', 'badminton', 30, null, null),
  ('e0910000-0000-4000-8000-000000000060', 'e0910000-0000-4000-8000-000000000010', '60 minutes', 'badminton', 60, '06:00', '22:00'),
  ('e0910000-0000-4000-8000-000000000090', 'e0910000-0000-4000-8000-000000000010', '90 minutes', 'badminton', 90, null, null),
  ('e0910000-0000-4000-8000-000000000120', 'e0910000-0000-4000-8000-000000000010', '120 minutes', 'badminton', 120, null, null);
insert into public.price_rules(court_id, days, start_time, end_time, price_per_hour)
select id, '{0,1,2,3,4,5,6}'::int[], '05:00'::time, '23:00'::time, 100500
from public.courts where venue_id = 'e0910000-0000-4000-8000-000000000010';



update public.profiles set role='owner',owner_application_status='active',payout_bank='MB',payout_account='1234567890' where id='e0910000-0000-4000-8000-000000000002';
insert into public.venues(id,owner_id,slug,name,address,district,status) values('e0910000-0000-4000-8000-000000000011','e0910000-0000-4000-8000-000000000002','owner-search-other-rollback','Other fixture','Fixture','Test','active');
insert into public.bookings(code,court_id,user_id,starts_at,ends_at,status,total_amount,deposit_amount,customer_name,customer_phone)
select case when i=-1 then 'SANXYZ234' else 'SAN'||public.gen_booking_code() end,
 'e0910000-0000-4000-8000-000000000060','e0910000-0000-4000-8000-000000000003',
 (((now() at time zone 'Asia/Ho_Chi_Minh')::date+i)::timestamp+interval '18 hours') at time zone 'Asia/Ho_Chi_Minh',
 (((now() at time zone 'Asia/Ho_Chi_Minh')::date+i)::timestamp+interval '19 hours') at time zone 'Asia/Ho_Chi_Minh',
 (case when i<0 then 'completed' when i=2 then 'pending' else 'confirmed' end)::public.booking_status,
 100000,100000,case when i=-1 then 'Khách %_ cũ' else 'Khách kiểm tra' end,
 case when i=-1 then '0912345678' else '0900000002' end
from generate_series(-5,35) i where i<>0;

update public.bookings set status='cancelled',refund_status='needed' where code='SANXYZ234';

do $$ begin
 assert not has_function_privilege('anon','public.search_owner_bookings(uuid,text,text,date,date,int,boolean,boolean)','EXECUTE');
end $$;
select set_config('request.jwt.claim.sub','e0910000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare r jsonb; ids1 jsonb; today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date; begin
 r:=public.search_owner_bookings('e0910000-0000-4000-8000-000000000010');
 assert (r->>'total')::int=30 and jsonb_array_length(r->'rows')=30, 'default upcoming range comes from SQL';
 assert (r->>'pending')::int=1 and (r->>'confirmed')::int=29, 'counts span all matching rows';
 assert (r->>'from')::date=today and (r->>'to')::date=today+30, 'Vietnam dates';
 r:=public.search_owner_bookings('e0910000-0000-4000-8000-000000000010',p_show_history=>true);
 assert (r->>'total')::int=40 and (r->>'pages')::int=2 and jsonb_array_length(r->'rows')=30;
 assert (r->>'confirmed')::int=38, 'summary is not just page count';
 ids1:=r->'rows';
 r:=public.search_owner_bookings('e0910000-0000-4000-8000-000000000010',p_page=>2,p_show_history=>true);
 assert jsonb_array_length(r->'rows')=10 and (r->>'total')::int=40;
 assert not exists(select 1 from jsonb_array_elements(ids1) a join jsonb_array_elements(r->'rows') b on a->>'id'=b->>'id'), 'stable pages do not repeat orders';
 r:=public.search_owner_bookings('e0910000-0000-4000-8000-000000000010',p_page=>999999,p_show_history=>true);
 assert (r->>'page')::int=2, 'page clamped in SQL';
 r:=public.search_owner_bookings('e0910000-0000-4000-8000-000000000010',p_query=>' sanxyz234 ');
 assert (r->>'total')::int=1 and r->'rows'->0->>'customer_phone'='0912345678' and r->>'from' is null, 'old code search ignores default upcoming filter';
 r:=public.search_owner_bookings('e0910000-0000-4000-8000-000000000010',p_query=>'+84 (912) 345-678');
 assert (r->>'total')::int=1, 'formatted Vietnam phone search';
 r:=public.search_owner_bookings('e0910000-0000-4000-8000-000000000010',p_query=>'%_');
 assert (r->>'total')::int=1, 'wildcards are literal';
 r:=public.search_owner_bookings('e0910000-0000-4000-8000-000000000010',p_from=>today-2,p_to=>today);
 assert (r->>'total')::int=2, 'bounded date range includes old orders';
 r:=public.search_owner_bookings('e0910000-0000-4000-8000-000000000010',p_status=>'pending',p_show_history=>true);
 assert (r->>'total')::int=1 and (r->>'pending')::int=1;
 r:=public.search_owner_bookings('e0910000-0000-4000-8000-000000000010',p_refund_needed=>true);
 assert (r->>'total')::int=1 and r->'rows'->0->>'code'='SANXYZ234' and r->>'from' is null, 'old refunds visible without default upcoming limit';
 r:=public.search_owner_bookings('e0910000-0000-4000-8000-000000000010',p_query=>'no matching result');
 assert (r->>'total')::int=0 and (r->>'page')::int=1 and (r->>'pages')::int=1 and r->'rows'='[]'::jsonb;
 begin perform public.search_owner_bookings('e0910000-0000-4000-8000-000000000010',p_from=>today,p_to=>today-1); raise exception 'CHECK_FAILED'; exception when others then if sqlerrm<>'INVALID_DATE_RANGE' then raise; end if; end;
 begin perform public.search_owner_bookings('e0910000-0000-4000-8000-000000000010',p_query=>repeat('a',101)); raise exception 'CHECK_FAILED'; exception when others then if sqlerrm<>'QUERY_TOO_LONG' then raise; end if; end;
 begin perform public.search_owner_bookings('e0910000-0000-4000-8000-000000000010',p_status=>'fake'); raise exception 'CHECK_FAILED'; exception when others then if sqlerrm<>'INVALID_STATUS' then raise; end if; end;
 begin perform public.search_owner_bookings('e0910000-0000-4000-8000-000000000011'); raise exception 'CHECK_FAILED'; exception when others then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','e0910000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
 begin perform public.search_owner_bookings('e0910000-0000-4000-8000-000000000010'); raise exception 'CHECK_FAILED'; exception when others then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.profiles set banned_until='infinity' where id='e0910000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','e0910000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 begin perform public.search_owner_bookings('e0910000-0000-4000-8000-000000000010'); raise exception 'CHECK_FAILED'; exception when others then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
end $$;
reset role;
rollback;
