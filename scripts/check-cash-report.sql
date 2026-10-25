-- Run against the linked schema; every fixture/config change is rolled back.
-- For pre-deploy checks, wrap the candidate migration and this script in one transaction.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

insert into auth.users(id) values
  ('e0250000-0000-4000-8000-000000000001'),
  ('e0250000-0000-4000-8000-000000000002'),
  ('e0250000-0000-4000-8000-000000000003');
update public.profiles set role = 'owner', owner_application_status = 'active',
  payout_bank = 'MB', payout_account = '1234567890'
where id = 'e0250000-0000-4000-8000-000000000001';
update public.profiles set phone = '0900000999'
where id = 'e0250000-0000-4000-8000-000000000002';

-- The singleton is changed only inside this short rollback transaction.
insert into public.booking_operator(owner_id, bank, account_number, account_name, accepts_new_bookings, multi_owner_enabled)
values ('e0250000-0000-4000-8000-000000000001', 'MBBank', '1234567890', 'ROLLBACK CHECK', true, false)
on conflict(singleton) do update set owner_id = excluded.owner_id, bank = excluded.bank,
  account_number = excluded.account_number, account_name = excluded.account_name,
  accepts_new_bookings = true, multi_owner_enabled = false;
insert into public.venues(id, owner_id, slug, name, address, district, status)
values ('e0250000-0000-4000-8000-000000000010', 'e0250000-0000-4000-8000-000000000001',
  'cash-report-rollback', 'Booking input rollback', 'Rollback fixture', 'Test', 'active');
insert into public.courts(id, venue_id, name, sport, slot_minutes, open_time, close_time) values
  ('e0250000-0000-4000-8000-000000000030', 'e0250000-0000-4000-8000-000000000010', '30 minutes', 'badminton', 30, null, null),
  ('e0250000-0000-4000-8000-000000000060', 'e0250000-0000-4000-8000-000000000010', '60 minutes', 'badminton', 60, '06:00', '22:00'),
  ('e0250000-0000-4000-8000-000000000090', 'e0250000-0000-4000-8000-000000000010', '90 minutes', 'badminton', 90, null, null),
  ('e0250000-0000-4000-8000-000000000120', 'e0250000-0000-4000-8000-000000000010', '120 minutes', 'badminton', 120, null, null);
insert into public.price_rules(court_id, days, start_time, end_time, price_per_hour)
select id, '{0,1,2,3,4,5,6}'::int[], '05:00'::time, '23:00'::time, 100500
from public.courts where venue_id = 'e0250000-0000-4000-8000-000000000010';




update public.profiles set role='admin' where id='e0250000-0000-4000-8000-000000000002';
insert into public.bookings(code,court_id,user_id,starts_at,ends_at,status,total_amount,deposit_amount,customer_phone,created_at)
 values('SANCAS234','e0250000-0000-4000-8000-000000000060','e0250000-0000-4000-8000-000000000003',
 now()+interval '2 days',now()+interval '2 days 1 hour','pending',100000,100000,'0901234567',now()-interval '1 day');

update public.bookings set status='cancelled',refund_status='needed' where code='SANCAS234';
insert into public.sepay_events(transaction_key,booking_id,amount,raw)
 select 'cash-report-receipt',id,100000,'{}' from public.bookings where code='SANCAS234';
insert into public.booking_refunds(id,booking_id,receiver_owner_id,actor_id,amount,reference,transferred_at)
 select 'e0250000-0000-4000-8000-000000000101',id,'e0250000-0000-4000-8000-000000000001','e0250000-0000-4000-8000-000000000001',40000,'=CSV-REFUND',now() from public.bookings where code='SANCAS234';
insert into public.incoming_transfers(transaction_key,receiver_owner_id,bank,account_number,bank_tx_id,amount,ref_codes,raw,source,expected_amount,needs_review,created_at)
 select 'cash-'||s.source,'e0250000-0000-4000-8000-000000000001','MB','123','cash-'||s.source,s.amount,array['CASH-CODE'],'{}',s.source,s.expected,true,
 ((now() at time zone 'Asia/Ho_Chi_Minh')::date)::timestamp at time zone 'Asia/Ho_Chi_Minh'
 from (values ('booking',100000,100000),('tournament',50000,50000),('subscription',299000,299000),('unknown',900000,null))s(source,amount,expected);
insert into public.incoming_transfers(transaction_key,receiver_owner_id,bank,account_number,bank_tx_id,amount,ref_codes,raw,source,expected_amount,created_at)
 values('cash-foreign','e0250000-0000-4000-8000-000000000002','MB','123','foreign',300000,'{PRIVATE}','{}','booking',300000,now());
insert into public.incoming_transfers(transaction_key,receiver_owner_id,bank,account_number,bank_tx_id,amount,ref_codes,raw,source,expected_amount,created_at)
 select 'cash-before','e0250000-0000-4000-8000-000000000001','MB','123','before',10000,'{BEFORE}','{}','booking',10000,
 (((now() at time zone 'Asia/Ho_Chi_Minh')::date)::timestamp at time zone 'Asia/Ho_Chi_Minh')-interval '1 second';
select set_config('request.jwt.claim.sub','e0250000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare r jsonb;d date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;begin
 r:=public.get_cash_report(d,d);
 assert (r->>'received')::int=449000 and (r->>'refunded')::int=40000;
 assert (r->>'booking_refund_due_now')::int=60000;
 assert (r->>'total')::int=4 and (r->>'review_count')::int=3;
 assert r::text not like '%PRIVATE%' and r::text not like '%BEFORE%';
 assert jsonb_array_length(r->'sources')=3;
 assert r=public.get_cash_report(d,d,1,true);
 begin perform public.get_cash_report(d,d+93);raise exception 'CHECK_FAILED';exception when invalid_parameter_value then null;end;
end $$;
reset role;
-- Whole result is counted before pagination; CSV refuses silent truncation.
insert into public.incoming_transfers(transaction_key,receiver_owner_id,bank,account_number,bank_tx_id,amount,ref_codes,raw,source,expected_amount,created_at)
 select 'cash-volume-'||n,'e0250000-0000-4000-8000-000000000001','MB','123','bulk-'||n,1,'{CASH-BULK}','{}','booking',1,now() from generate_series(1,5001)n;
set local role authenticated;
do $$ declare r jsonb;d date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;begin
 r:=public.get_cash_report(d,d,2);assert (r->>'total')::int=5005 and (r->>'page')::int=2 and jsonb_array_length(r->'rows')=30;
 begin perform public.get_cash_report(d,d,1,true);raise exception 'CHECK_FAILED';exception when invalid_parameter_value then assert sqlerrm='EXPORT_TOO_LARGE';end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','e0250000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
 assert not has_function_privilege('anon','public.get_cash_report(date,date,int,boolean)','execute');
 begin perform public.get_cash_report();raise exception 'CHECK_FAILED';exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.profiles set banned_until='infinity' where id='e0250000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','e0250000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 begin perform public.get_cash_report();raise exception 'CHECK_FAILED';exception when insufficient_privilege then null;end;
end $$;
rollback;
