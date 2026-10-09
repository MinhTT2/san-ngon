begin;
set local statement_timeout='30s';
set local lock_timeout='5s';
insert into auth.users(id) values
  ('e0920000-0000-4000-8000-000000000001'),
  ('e0920000-0000-4000-8000-000000000002');
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
  'ux-remaining-rollback', 'Booking input rollback', 'Rollback fixture', 'Test', 'active');
insert into public.courts(id, venue_id, name, sport, slot_minutes, open_time, close_time) values
  ('e0920000-0000-4000-8000-000000000030', 'e0920000-0000-4000-8000-000000000010', '30 minutes', 'badminton', 30, null, null),
  ('e0920000-0000-4000-8000-000000000060', 'e0920000-0000-4000-8000-000000000010', '60 minutes', 'badminton', 60, '06:00', '22:00'),
  ('e0920000-0000-4000-8000-000000000090', 'e0920000-0000-4000-8000-000000000010', '90 minutes', 'badminton', 90, null, null),
  ('e0920000-0000-4000-8000-000000000120', 'e0920000-0000-4000-8000-000000000010', '120 minutes', 'badminton', 120, null, null);
insert into public.price_rules(court_id, days, start_time, end_time, price_per_hour)
select id, '{0,1,2,3,4,5,6}'::int[], '05:00'::time, '23:00'::time, 100500
from public.courts where venue_id = 'e0920000-0000-4000-8000-000000000010';


update public.courts set is_active=false where venue_id='e0920000-0000-4000-8000-000000000010' and slot_minutes<>30;
insert into public.price_rules(court_id,days,start_time,end_time,price_per_hour,priority,label) values('e0920000-0000-4000-8000-000000000030','{0,1,2,3,4,5,6}','10:00','11:00',140000,3,'Priority winner');
insert into public.bookings(code,court_id,user_id,starts_at,ends_at,total_amount,deposit_amount,status,refund_status,customer_name,customer_phone)
select 'SANUX'||lpad(i::text,4,'0'),'e0920000-0000-4000-8000-000000000030','e0920000-0000-4000-8000-000000000002',now()-make_interval(days=>i),now()-make_interval(days=>i)+interval '1 hour',100500,100500,'cancelled',case when i=35 then 'done'::public.refund_status else 'needed'::public.refund_status end,'Khách rollback','0900000002' from generate_series(1,35) i;
update public.courts set name='Renamed court' where id='e0920000-0000-4000-8000-000000000030';
insert into storage.objects(bucket_id,name) values('payment-receipts','e0920000-0000-4000-8000-000000000002/e0920000-0000-4000-8000-000000000080.png');
select set_config('request.jwt.claim.sub','e0920000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare d date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date+1; j jsonb; x uuid;
begin
 j:=public.get_owner_reconciliation_export('e0920000-0000-4000-8000-000000000010',d-41,d);
 assert (j->'rows'->0->>'court_name')='30 minutes','CSV keeps booked court name';
 assert (j->>'total')::int=35 and jsonb_array_length(j->'rows')=35,'export all scoped history';
 begin perform public.get_owner_reconciliation_export('e0920000-0000-4000-8000-000000000010',d,d-1); raise exception 'CHECK_FAILED date range'; exception when invalid_parameter_value then assert sqlerrm='INVALID_DATE_RANGE'; end;
 j:=public.get_owner_operating_calendar('e0920000-0000-4000-8000-000000000010');
 assert jsonb_array_length(j->'days')=7 and (j->>'until')::timestamptz-(j->>'from')::timestamptz=interval '7 days','SQL operating dates';
 j:=public.get_owner_price_preview('e0920000-0000-4000-8000-000000000030',d);
 assert (select (row->>'price')::int=70000 from jsonb_array_elements(j->'rows') row where (row->>'starts_at')::timestamptz=(d+'10:00'::time) at time zone 'Asia/Ho_Chi_Minh'),'SQL priority preview';
 j:=public.search_venues_for_time('Booking input rollback','badminton',null,d,null,true,'name',1,'10:00',90);
 assert (j->>'total')::int=1 and (j->'venues'->0->>'available_slots')::int=1,'three continuous slots';
 j:=public.search_venues_for_time('Booking input rollback','badminton',null,d,null,true,'name',1,'10:00',120);
 assert (j->>'total')::int=0,'four slots not offered';
 j:=public.search_venues_for_time('Booking input rollback','badminton',null,d,null,true,'name',1,'10:15',30);
 assert (j->>'total')::int=0,'exact starting time';
 x:=public.close_court('e0920000-0000-4000-8000-000000000030',d,'10:30','11:00','Rollback closure');
 j:=public.search_venues_for_time('Booking input rollback','badminton',null,d,null,true,'name',1,'10:00',90);
 assert (j->>'total')::int=0,'blocked middle rejects duration';
 perform public.reopen_court('e0920000-0000-4000-8000-000000000030',x);
 j:=public.get_owner_refund_page('e0920000-0000-4000-8000-000000000010','needed','',2);
 assert (j->>'total')::int=34 and jsonb_array_length(j->'rows')=4 and (j->>'done')::int=1,'refund history pagination';
 j:=public.get_owner_refund_page('e0920000-0000-4000-8000-000000000010','done','SANUX0035',1);
 assert (j->>'total')::int=1 and (j->'rows'->0->>'court_name')='30 minutes','done refund lookup keeps booked court name';
end $$;
reset role;
select set_config('request.jwt.claim.sub','e0920000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$
declare x uuid; n int;
begin
 begin perform public.get_owner_reconciliation_export('e0920000-0000-4000-8000-000000000010',current_date-40,current_date); raise exception 'CHECK_FAILED export scope'; exception when insufficient_privilege then null; end;
 begin perform public.get_owner_price_preview('e0920000-0000-4000-8000-000000000030',null); raise exception 'CHECK_FAILED owner permission'; exception when insufficient_privilege then null; end;
 begin perform public.get_owner_refund_page('e0920000-0000-4000-8000-000000000010','all','',1); raise exception 'CHECK_FAILED refund permission'; exception when insufficient_privilege then null; end;
 x:=public.submit_payment_support('e0920000-0000-4000-8000-000000000081','SANUX0035','Rollback receipt inquiry with enough content','e0920000-0000-4000-8000-000000000002/e0920000-0000-4000-8000-000000000080.png');
 assert x=public.submit_payment_support(x,'SANUX0035','Rollback receipt inquiry with enough content','e0920000-0000-4000-8000-000000000002/e0920000-0000-4000-8000-000000000080.png'),'support replay idempotent';
 assert (select count(*)=1 from public.feedback where id=x),'one inquiry';
 begin perform public.submit_payment_support(x,'SANUX0035','Rollback receipt inquiry with enough content',null); raise exception 'CHECK_FAILED replay mismatch'; exception when invalid_parameter_value then assert sqlerrm='FEEDBACK_CONFLICT'; end;
 begin perform public.submit_payment_support('e0920000-0000-4000-8000-000000000082','SANUX0035','Rollback receipt inquiry with enough content','e0920000-0000-4000-8000-000000000001/e0920000-0000-4000-8000-000000000080.png'); raise exception 'CHECK_FAILED another uploader'; exception when invalid_parameter_value then assert sqlerrm='INVALID_RECEIPT'; end;
 begin insert into storage.objects(bucket_id,name) values('payment-receipts','e0920000-0000-4000-8000-000000000001/e0920000-0000-4000-8000-000000000080.png'); raise exception 'CHECK_FAILED other folder'; exception when insufficient_privilege then null; end;
 assert (select count(*)=1 from public.feedback where receipt_path is not null),'receipt is attached for delete guard';
end $$;
reset role;
select set_config('request.jwt.claim.sub','e0920000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 assert (select count(*)=0 from storage.objects where bucket_id='payment-receipts'),'other owner cannot read receipt';
 assert (select count(*)=0 from public.feedback where user_id='e0920000-0000-4000-8000-000000000002'),'other owner cannot read inquiry';
 begin perform public.submit_payment_support('e0920000-0000-4000-8000-000000000083','SANUX0035','Rollback receipt inquiry with enough content',null); raise exception 'CHECK_FAILED another booking'; exception when invalid_parameter_value then assert sqlerrm='BOOKING_NOT_FOUND'; end;
end $$;
reset role;
do $$ begin
 assert not has_function_privilege('anon','public.get_owner_refund_page(uuid,text,text,int)','EXECUTE'),'anonymous refunds forbidden';
 assert not has_function_privilege('anon','public.submit_payment_support(uuid,text,text,text)','EXECUTE'),'anonymous support forbidden';
 assert not (select public from storage.buckets where id='payment-receipts'),'private bucket';
end $$;
rollback;
