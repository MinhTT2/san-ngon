-- Run against the linked schema; every fixture/config change is rolled back.
-- For pre-deploy checks, wrap the candidate migration and this script in one transaction.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

insert into auth.users(id) values
  ('e0900000-0000-4000-8000-000000000001'),
  ('e0900000-0000-4000-8000-000000000002'),
  ('e0900000-0000-4000-8000-000000000003');
update public.profiles set role = 'owner', owner_application_status = 'active',
  payout_bank = 'MB', payout_account = '1234567890'
where id = 'e0900000-0000-4000-8000-000000000001';
update public.profiles set phone = '0900000999'
where id = 'e0900000-0000-4000-8000-000000000002';

-- The singleton is changed only inside this short rollback transaction.
insert into public.booking_operator(owner_id, bank, account_number, account_name, accepts_new_bookings, multi_owner_enabled)
values ('e0900000-0000-4000-8000-000000000001', 'MBBank', '1234567890', 'ROLLBACK CHECK', true, false)
on conflict(singleton) do update set owner_id = excluded.owner_id, bank = excluded.bank,
  account_number = excluded.account_number, account_name = excluded.account_name,
  accepts_new_bookings = true, multi_owner_enabled = false;
insert into public.venues(id, owner_id, slug, name, address, district, status)
values ('e0900000-0000-4000-8000-000000000010', 'e0900000-0000-4000-8000-000000000001',
  'booking-input-guards-rollback', 'Booking input rollback', 'Rollback fixture', 'Test', 'active');
insert into public.courts(id, venue_id, name, sport, slot_minutes, open_time, close_time) values
  ('e0900000-0000-4000-8000-000000000030', 'e0900000-0000-4000-8000-000000000010', '30 minutes', 'badminton', 30, null, null),
  ('e0900000-0000-4000-8000-000000000060', 'e0900000-0000-4000-8000-000000000010', '60 minutes', 'badminton', 60, '06:00', '22:00'),
  ('e0900000-0000-4000-8000-000000000090', 'e0900000-0000-4000-8000-000000000010', '90 minutes', 'badminton', 90, null, null),
  ('e0900000-0000-4000-8000-000000000120', 'e0900000-0000-4000-8000-000000000010', '120 minutes', 'badminton', 120, null, null);
insert into public.price_rules(court_id, days, start_time, end_time, price_per_hour)
select id, '{0,1,2,3,4,5,6}'::int[], '05:00'::time, '23:00'::time, 100500
from public.courts where venue_id = 'e0900000-0000-4000-8000-000000000010';


create function pg_temp.expect_request_error(expected text, request uuid, court uuid,
  starts timestamptz, ends timestamptz, customer text default 'Check', phone text default '0900000002', note text default null)
returns void language plpgsql as $$
begin
  begin
    perform public.create_booking_once(request, court, starts, ends, customer, phone, note);
    raise exception 'CHECK_FAILED: expected %', expected;
  exception when others then if sqlerrm <> expected then raise; end if; end;
end $$;

do $$ begin
  assert not has_function_privilege('anon','public.create_booking_once(uuid,uuid,timestamptz,timestamptz,text,text,text)','EXECUTE');
  assert has_function_privilege('authenticated','public.create_booking_once(uuid,uuid,timestamptz,timestamptz,text,text,text)','EXECUTE');
  assert not has_table_privilege('authenticated','public.booking_requests','SELECT,INSERT,UPDATE,DELETE'), 'private request table';
  assert not has_table_privilege('anon','public.booking_requests','SELECT,INSERT,UPDATE,DELETE'), 'no anonymous request hashes';
end $$;
select set_config('request.jwt.claim.sub','e0900000-0000-4000-8000-000000000002',true);
set local role authenticated;

do $$
declare
  court constant uuid := 'e0900000-0000-4000-8000-000000000060';
  request constant uuid := 'e0900000-0000-4000-8000-000000000099';
  starts timestamptz;
  first public.bookings; again public.bookings; second public.bookings;
begin
  select min(a.starts_at) into starts from public.get_venue_availability('e0900000-0000-4000-8000-000000000010',(now() at time zone 'Asia/Ho_Chi_Minh')::date+1) a where a.court_id=court;
  first := public.create_booking_once(request,court,starts,starts+interval '1 hour','Check','0900000002');
  again := public.create_booking_once(request,court,starts,starts+interval '1 hour','  Check  ',' 0900000002 ','   ');
  assert to_jsonb(first)=to_jsonb(again), 'same intent returns exact original booking';
  assert first.total_amount=100500 and first.deposit_amount=100500, 'price calculated by original SQL';
  second := public.create_booking_once('e0900000-0000-4000-8000-000000000098',court,starts+interval '1 hour',starts+interval '2 hours','Check','0900000002');
  again := public.create_booking_once(request,court,starts,starts+interval '1 hour','Check','0900000002');
  assert again.id=first.id, 'replay works at pending limit';
  perform pg_temp.expect_request_error('REQUEST_CONFLICT',request,court,starts,starts+interval '1 hour','Changed');
  perform pg_temp.expect_request_error('REQUEST_CONFLICT',request,court,starts,starts+interval '1 hour','Check','0900000003');
  perform pg_temp.expect_request_error('REQUEST_CONFLICT',request,court,starts,starts+interval '1 hour','Check','0900000002','Changed');
  perform pg_temp.expect_request_error('REQUEST_CONFLICT',request,court,starts,starts+interval '2 hours');
  perform pg_temp.expect_request_error('REQUEST_CONFLICT',request,'e0900000-0000-4000-8000-000000000030',starts,starts+interval '1 hour');
  perform pg_temp.expect_request_error('REQUEST_ID_REQUIRED',null,court,starts,starts+interval '1 hour');
  perform pg_temp.expect_request_error('TOO_MANY_PENDING','e0900000-0000-4000-8000-000000000097',court,starts+interval '2 hours',starts+interval '3 hours');
  assert (select count(*)=2 from public.bookings where user_id=auth.uid()), 'retries/rejections never add holds';
end $$;
reset role;

-- A changed price/receiver and SQL session timezone must not change a replay.
update public.price_rules set price_per_hour=150000 where court_id='e0900000-0000-4000-8000-000000000060';
update public.booking_operator set bank='VCB',account_number='9999999999',account_name='CHANGED FIXTURE';
set local timezone='America/New_York';
set local role authenticated;
do $$ declare b public.bookings; again public.bookings; begin
  select * into b from public.bookings where user_id=auth.uid() order by starts_at limit 1;
  again := public.create_booking_once('e0900000-0000-4000-8000-000000000099',b.court_id,b.starts_at,b.ends_at,'Check','0900000002');
  assert again.id=b.id and again.total_amount=100500 and again.payment_account='1234567890', 'no reprice/receiver change on replay';
  perform public.cancel_booking((select code from public.bookings where user_id=auth.uid() order by starts_at desc limit 1),true);
end $$;
reset role;
update public.bookings set expires_at=now()-interval '1 minute' where id=(select booking_id from public.booking_requests where request_id='e0900000-0000-4000-8000-000000000099');
set local role authenticated;
do $$ declare b public.bookings; again public.bookings; begin
  for b in select * from public.bookings where user_id=auth.uid() order by starts_at loop
    again := public.create_booking_once(case when b.status='cancelled' then 'e0900000-0000-4000-8000-000000000098'::uuid else 'e0900000-0000-4000-8000-000000000099'::uuid end,b.court_id,b.starts_at,b.ends_at,'Check','0900000002');
    assert to_jsonb(again)=to_jsonb(b), 'cancelled/expired holds are not extended or reopened';
  end loop;
end $$;
reset role;
update public.profiles set banned_until='infinity' where id='e0900000-0000-4000-8000-000000000002';
set local role authenticated;
do $$ declare b public.bookings; begin
  -- RLS hides this user's bookings while banned; use known fixture time instead.
  perform pg_temp.expect_request_error('ACCOUNT_BANNED','e0900000-0000-4000-8000-000000000099','e0900000-0000-4000-8000-000000000060',now()+interval '1 day',now()+interval '2 days');
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.profiles set banned_until=null where id='e0900000-0000-4000-8000-000000000002';
update public.bookings set status='confirmed' where id=(select booking_id from public.booking_requests where request_id='e0900000-0000-4000-8000-000000000099');
select set_config('request.jwt.claim.sub','e0900000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare b public.bookings; again public.bookings; begin
  select * into b from public.bookings where user_id=auth.uid() and status='confirmed';
  again := public.create_booking_once('e0900000-0000-4000-8000-000000000099',b.court_id,b.starts_at,b.ends_at,'Check','0900000002');
  assert again.status='confirmed' and again.id=b.id, 'current payment status returned';
end $$;
reset role;
select set_config('request.jwt.claim.sub','e0900000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ declare starts timestamptz; b public.bookings; begin
  select min(a.starts_at) into starts from public.get_venue_availability('e0900000-0000-4000-8000-000000000010',(now() at time zone 'Asia/Ho_Chi_Minh')::date+1) a where a.court_id='e0900000-0000-4000-8000-000000000030';
  perform pg_temp.expect_request_error('SLOT_TAKEN','e0900000-0000-4000-8000-000000000099','e0900000-0000-4000-8000-000000000060',starts+interval '1 hour',starts+interval '2 hours');
  b := public.create_booking_once('e0900000-0000-4000-8000-000000000099','e0900000-0000-4000-8000-000000000030',starts,starts+interval '1 hour','Check','0900000002');
  assert b.user_id=auth.uid(), 'same request UUID belongs to each authenticated user separately';
  perform pg_temp.expect_request_error('TOO_MANY_SLOTS','e0900000-0000-4000-8000-000000000097','e0900000-0000-4000-8000-000000000030',starts+interval '1 hour',starts+interval '3 hours');
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
select pg_temp.expect_request_error('AUTH_REQUIRED','e0900000-0000-4000-8000-000000000099','e0900000-0000-4000-8000-000000000060',now()+interval '1 day',now()+interval '2 days');
reset role;
do $$ begin
  assert (select count(*)=3 from public.booking_requests where user_id::text like 'e0900000-%'), 'only three successful intents recorded';
  assert (select count(*)=3 from public.payments p join public.bookings b on b.id=p.booking_id where b.user_id::text like 'e0900000-%'), 'one payment per intent';
end $$;
rollback;
