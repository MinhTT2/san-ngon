-- All fixtures and singleton changes below are rolled back.
-- Run against the linked schema; every fixture/config change is rolled back.
-- For pre-deploy checks, wrap the candidate migration and this script in one transaction.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

insert into auth.users(id) values
  ('e0210000-0000-4000-8000-000000000001'),
  ('e0210000-0000-4000-8000-000000000002'),
  ('e0210000-0000-4000-8000-000000000003');
update public.profiles set role = 'owner', owner_application_status = 'active',
  payout_bank = 'MB', payout_account = '1234567890'
where id = 'e0210000-0000-4000-8000-000000000001';
update public.profiles set phone = '0900000999'
where id = 'e0210000-0000-4000-8000-000000000002';

-- The singleton is changed only inside this short rollback transaction.
insert into public.booking_operator(owner_id, bank, account_number, account_name, accepts_new_bookings, multi_owner_enabled)
values ('e0210000-0000-4000-8000-000000000001', 'MBBank', '1234567890', 'ROLLBACK CHECK', true, false)
on conflict(singleton) do update set owner_id = excluded.owner_id, bank = excluded.bank,
  account_number = excluded.account_number, account_name = excluded.account_name,
  accepts_new_bookings = true, multi_owner_enabled = false;
insert into public.venues(id, owner_id, slug, name, address, district, status)
values ('e0210000-0000-4000-8000-000000000010', 'e0210000-0000-4000-8000-000000000001',
  'refund-receipts-rollback', 'Booking input rollback', 'Rollback fixture', 'Test', 'active');
insert into public.courts(id, venue_id, name, sport, slot_minutes, open_time, close_time) values
  ('e0210000-0000-4000-8000-000000000030', 'e0210000-0000-4000-8000-000000000010', '30 minutes', 'badminton', 30, null, null),
  ('e0210000-0000-4000-8000-000000000060', 'e0210000-0000-4000-8000-000000000010', '60 minutes', 'badminton', 60, '06:00', '22:00'),
  ('e0210000-0000-4000-8000-000000000090', 'e0210000-0000-4000-8000-000000000010', '90 minutes', 'badminton', 90, null, null),
  ('e0210000-0000-4000-8000-000000000120', 'e0210000-0000-4000-8000-000000000010', '120 minutes', 'badminton', 120, null, null);
insert into public.price_rules(court_id, days, start_time, end_time, price_per_hour)
select id, '{0,1,2,3,4,5,6}'::int[], '05:00'::time, '23:00'::time, 100500
from public.courts where venue_id = 'e0210000-0000-4000-8000-000000000010';





insert into public.bookings(code,court_id,user_id,starts_at,ends_at,status,refund_status,total_amount,deposit_amount,customer_phone,created_at)
select code,'e0210000-0000-4000-8000-000000000060','e0210000-0000-4000-8000-000000000003',
 now()+interval '2 days'+i*interval '1 day',now()+interval '2 days 1 hour'+i*interval '1 day',
 'cancelled','needed',100000,100000,'0901234567',now()-interval '1 day'
from unnest(array['SANRFD234','SANRFD235','SANRFD236','SANRFD237','SANRFD238']) with ordinality t(code,i);
insert into public.sepay_events(transaction_key,booking_id,amount,raw)
 select 'refund-test-'||code,id,case code when 'SANRFD235' then 30000 when 'SANRFD236' then 130000 else 100000 end,'{}'
 from public.bookings where code in ('SANRFD234','SANRFD235','SANRFD236','SANRFD237');
insert into public.booking_refund_legacy select id from public.bookings where code='SANRFD237';
update public.bookings set refund_status='done' where code='SANRFD237';
do $$ begin
 assert not has_function_privilege('anon','public.get_booking_refund(text)','execute');
 assert not has_function_privilege('authenticated','public.mark_refund_done(text)','execute');
 assert not has_table_privilege('authenticated','public.booking_refunds','insert');
 assert not has_table_privilege('authenticated','public.booking_refunds','select');
 assert not has_column_privilege('authenticated','public.bookings','refund_status','update');
end $$;
select set_config('request.jwt.claim.sub','e0210000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare r jsonb; local_time text:=to_char(now() at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD"T"HH24:MI'); begin
 r:=public.get_booking_refund('SANRFD235');assert (r->>'received')::int=30000 and (r->>'remaining')::int=30000,'short transfer is not the full deposit';
 r:=public.get_booking_refund('SANRFD236');assert (r->>'remaining')::int=130000,'overpayment stays in real money';
 r:=public.record_booking_refund('SANRFD234','e0210000-0000-4000-8000-000000000101',40000,'REFUND-ONE',local_time);
 assert (r->>'remaining')::int=60000 and r->>'status'='needed';
 r:=public.record_booking_refund('SANRFD234','e0210000-0000-4000-8000-000000000101',40000,'REFUND-ONE',local_time);
 assert jsonb_array_length(r->'records')=1,'same request does not append another receipt';
 begin perform public.record_booking_refund('SANRFD234','e0210000-0000-4000-8000-000000000101',50000,'REFUND-ONE',local_time);raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'REFUND_CONFLICT' then raise;end if;end;
 begin perform public.record_booking_refund('SANRFD234','e0210000-0000-4000-8000-000000000102',70000,'REFUND-TWO',local_time);raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'REFUND_EXCEEDS_REMAINING' then raise;end if;end;
 begin perform public.record_booking_refund('SANRFD235','e0210000-0000-4000-8000-000000000102',10000,'REFUND-ONE',local_time);raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'REFUND_CONFLICT' then raise;end if;end;
 begin perform public.record_booking_refund('SANRFD237','e0210000-0000-4000-8000-000000000102',10000,'REFUND-OLD',local_time);raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'LEGACY_REFUND_REVIEW' then raise;end if;end;
 begin perform public.record_booking_refund('SANRFD238','e0210000-0000-4000-8000-000000000102',10000,'REFUND-NO-MONEY',local_time);raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'REFUND_EXCEEDS_REMAINING' then raise;end if;end;
 begin perform public.record_booking_refund('SANRFD235','e0210000-0000-4000-8000-000000000102',0,'REFUND-ZERO',local_time);raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'INVALID_REFUND' then raise;end if;end;
 begin perform public.record_booking_refund('SANRFD235','e0210000-0000-4000-8000-000000000102',1,'REFUND-FUTURE','2099-01-01T10:00');raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'INVALID_REFUND' then raise;end if;end;
 r:=public.record_booking_refund('SANRFD234','e0210000-0000-4000-8000-000000000102',60000,'REFUND-TWO',local_time);
 assert (r->>'remaining')::int=0 and r->>'status'='done' and jsonb_array_length(r->'records')=2;
 r:=public.record_booking_refund('SANRFD234','e0210000-0000-4000-8000-000000000102',60000,'REFUND-TWO',local_time);
 assert jsonb_array_length(r->'records')=2,'replay after completion still succeeds';
end $$;
reset role;
do $$ begin
 assert (select count(*)=2 from public.notifications where booking_id=(select id from public.bookings where code='SANRFD234')),'no notification on retry';
 begin update public.booking_refunds set amount=1;raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'REFUND_IMMUTABLE' then raise;end if;end;
 assert (select transferred_at=date_trunc('minute',now()) from public.booking_refunds limit 1),'local Vietnam timestamp is converted in SQL';
end $$;
-- Capture retained deposits at cancellation; a later transfer only returns the extra.
insert into public.bookings(code,court_id,user_id,starts_at,ends_at,status,refund_status,total_amount,deposit_amount,customer_phone,created_at,paid_at)
values('SANRET234','e0210000-0000-4000-8000-000000000060','e0210000-0000-4000-8000-000000000003',
 now()+interval '20 days',now()+interval '20 days 1 hour','confirmed','none',100000,100000,'0901234567',now()-interval '1 day',now());
insert into public.sepay_events(transaction_key,booking_id,amount,raw)
 select 'refund-retained-original',id,100000,'{}' from public.bookings where code='SANRET234';
update public.bookings set status='cancelled',refund_status='none' where code='SANRET234';
insert into public.sepay_events(transaction_key,booking_id,amount,raw)
 select 'refund-retained-late',id,30000,'{}' from public.bookings where code='SANRET234';
update public.bookings set refund_status='needed' where code='SANRET234';
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.get_booking_refund('SANRET234');assert (r->>'received')::int=130000 and (r->>'remaining')::int=30000 and (r->>'retained')::int=100000;
end $$;
reset role;
select set_config('request.jwt.claim.sub','e0210000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.get_booking_refund('SANRFD234');assert jsonb_array_length(r->'records')=2 and not (r->>'can_record')::boolean,'player sees evidence but cannot write';
 begin perform public.record_booking_refund('SANRFD235',gen_random_uuid(),1,'NO-AUTH','2026-10-21T10:00');raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','e0210000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 begin perform public.get_booking_refund('SANRFD234');raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'BOOKING_NOT_FOUND' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.profiles set banned_until='infinity' where id='e0210000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','e0210000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 begin perform public.get_booking_refund('SANRFD234');raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end $$;
reset role;
rollback;
