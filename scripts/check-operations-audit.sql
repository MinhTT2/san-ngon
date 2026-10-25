-- Run against the linked schema; every fixture/config change is rolled back.
-- For pre-deploy checks, wrap the candidate migration and this script in one transaction.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

insert into auth.users(id) values
  ('e0230000-0000-4000-8000-000000000001'),
  ('e0230000-0000-4000-8000-000000000002'),
  ('e0230000-0000-4000-8000-000000000003');
update public.profiles set role = 'owner', owner_application_status = 'active',
  payout_bank = 'MB', payout_account = '1234567890'
where id = 'e0230000-0000-4000-8000-000000000001';
update public.profiles set phone = '0900000999'
where id = 'e0230000-0000-4000-8000-000000000002';

-- The singleton is changed only inside this short rollback transaction.
insert into public.booking_operator(owner_id, bank, account_number, account_name, accepts_new_bookings, multi_owner_enabled)
values ('e0230000-0000-4000-8000-000000000001', 'MBBank', '1234567890', 'ROLLBACK CHECK', true, false)
on conflict(singleton) do update set owner_id = excluded.owner_id, bank = excluded.bank,
  account_number = excluded.account_number, account_name = excluded.account_name,
  accepts_new_bookings = true, multi_owner_enabled = false;
insert into public.venues(id, owner_id, slug, name, address, district, status)
values ('e0230000-0000-4000-8000-000000000010', 'e0230000-0000-4000-8000-000000000001',
  'operations-audit-rollback', 'Booking input rollback', 'Rollback fixture', 'Test', 'active');
insert into public.courts(id, venue_id, name, sport, slot_minutes, open_time, close_time) values
  ('e0230000-0000-4000-8000-000000000030', 'e0230000-0000-4000-8000-000000000010', '30 minutes', 'badminton', 30, null, null),
  ('e0230000-0000-4000-8000-000000000060', 'e0230000-0000-4000-8000-000000000010', '60 minutes', 'badminton', 60, '06:00', '22:00'),
  ('e0230000-0000-4000-8000-000000000090', 'e0230000-0000-4000-8000-000000000010', '90 minutes', 'badminton', 90, null, null),
  ('e0230000-0000-4000-8000-000000000120', 'e0230000-0000-4000-8000-000000000010', '120 minutes', 'badminton', 120, null, null);
insert into public.price_rules(court_id, days, start_time, end_time, price_per_hour)
select id, '{0,1,2,3,4,5,6}'::int[], '05:00'::time, '23:00'::time, 100500
from public.courts where venue_id = 'e0230000-0000-4000-8000-000000000010';




update public.profiles set role='admin' where id='e0230000-0000-4000-8000-000000000002';
insert into public.bookings(code,court_id,user_id,starts_at,ends_at,status,total_amount,deposit_amount,customer_phone,created_at)
 values('SANAUD234','e0230000-0000-4000-8000-000000000060','e0230000-0000-4000-8000-000000000003',
 now()+interval '2 days',now()+interval '2 days 1 hour','pending',100000,100000,'0901234567',now()-interval '1 day');
select set_config('request.jwt.claim.sub','e0230000-0000-4000-8000-000000000001',true);
update public.bookings set status='confirmed',paid_at=now() where code='SANAUD234';
update public.bookings set status='confirmed' where code='SANAUD234';
update public.bookings set status='cancelled',refund_status='needed' where code='SANAUD234';
insert into public.sepay_events(transaction_key,booking_id,amount,raw)
 select 'audit-refund-fixture',id,100000,'{}' from public.bookings where code='SANAUD234';
set local role authenticated;
do $$ declare t text:=to_char(now() at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD"T"HH24:MI');begin
 perform public.record_booking_refund('SANAUD234','e0230000-0000-4000-8000-000000000101',100000,'AUDIT-REFUND-ONLY',t);
 perform public.record_booking_refund('SANAUD234','e0230000-0000-4000-8000-000000000101',100000,'AUDIT-REFUND-ONLY',t);
end $$;
reset role;
do $$ begin
 assert (select count(*)=3 from public.operations_audit where entity_code='SANAUD234'),'only changed state and first refund append a log';
 assert (select bool_and(actor_id='e0230000-0000-4000-8000-000000000001') from public.operations_audit where entity_code='SANAUD234'),'actor comes from the SQL session';
 assert not exists(select 1 from public.operations_audit where entity_code='SANAUD234' and (details ? 'reference' or details ? 'customer_phone' or details ? 'raw')),'no contact, bank reference or provider payload';
 assert not has_table_privilege('authenticated','public.operations_audit','insert');
 assert not has_table_privilege('authenticated','public.operations_audit','select');
 assert not has_function_privilege('anon','public.get_operations_audit(int,text)','execute');
 begin update public.operations_audit set details='{}' where entity_code='SANAUD234';raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'AUDIT_IMMUTABLE' then raise;end if;end;
 begin delete from public.operations_audit where entity_code='SANAUD234';raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'AUDIT_IMMUTABLE' then raise;end if;end;
end $$;
insert into public.operations_audit(actor_id,action,entity_id,details)
 select 'e0230000-0000-4000-8000-000000000001','venue.status_changed','e0230000-0000-4000-8000-000000000010','{"from":"draft","to":"active"}' from generate_series(1,35);
select set_config('request.jwt.claim.sub','e0230000-0000-4000-8000-000000000002',true);
insert into public.owner_subscriptions(owner_id,fee_required) values('e0230000-0000-4000-8000-000000000001',false) on conflict(owner_id) do nothing;
update public.owner_subscriptions set fee_required=true where owner_id='e0230000-0000-4000-8000-000000000001';
insert into public.sepay_connections(owner_id) values('e0230000-0000-4000-8000-000000000001');
update public.sepay_connections set status='reconnect' where owner_id='e0230000-0000-4000-8000-000000000001';
insert into public.owner_application_reviews(owner_id,reviewer_id,status,reason)
 values('e0230000-0000-4000-8000-000000000001','e0230000-0000-4000-8000-000000000002','rejected','Bổ sung giấy tờ rõ nét');
do $$ begin
 assert exists(select 1 from public.operations_audit where entity_id='e0230000-0000-4000-8000-000000000001' and action='subscription.fee_changed' and details->>'fee_required'='true');
 assert exists(select 1 from public.operations_audit where entity_id='e0230000-0000-4000-8000-000000000001' and action='sepay.status_changed' and details->>'to'='reconnect');
 assert exists(select 1 from public.operations_audit where entity_id='e0230000-0000-4000-8000-000000000001' and action='owner.reviewed' and not(details ? 'reason'));
end $$;
set local role authenticated;
do $$ declare r jsonb;begin
 r:=public.get_operations_audit(1,'sanaud234');assert (r->>'total')::int=3 and (r->>'page')::int=1;
 r:=public.get_operations_audit(99999,'SANAUD234');assert (r->>'page')::int=1;
 r:=public.get_operations_audit(1,'%_');assert (r->>'total')::int=0,'wildcards stay literal';
 r:=public.get_operations_audit(2,'e0230000-0000-4000-8000-000000000010');assert (r->>'total')::int=35 and jsonb_array_length(r->'rows')=5 and (r->>'pages')::int=2;
end $$;
reset role;
select set_config('request.jwt.claim.sub','e0230000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$begin
 begin perform public.get_operations_audit();raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end $$;
reset role;
rollback;
