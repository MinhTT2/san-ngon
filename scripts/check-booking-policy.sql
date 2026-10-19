-- Run against the linked schema; every fixture/config change is rolled back.
-- For pre-deploy checks, wrap the candidate migration and this script in one transaction.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

insert into auth.users(id) values
  ('e0930000-0000-4000-8000-000000000001'),
  ('e0930000-0000-4000-8000-000000000002'),
  ('e0930000-0000-4000-8000-000000000003');
update public.profiles set role = 'owner', owner_application_status = 'active',
  payout_bank = 'MB', payout_account = '1234567890'
where id = 'e0930000-0000-4000-8000-000000000001';
update public.profiles set phone = '0900000999'
where id = 'e0930000-0000-4000-8000-000000000002';

-- The singleton is changed only inside this short rollback transaction.
insert into public.booking_operator(owner_id, bank, account_number, account_name, accepts_new_bookings, multi_owner_enabled)
values ('e0930000-0000-4000-8000-000000000001', 'MBBank', '1234567890', 'ROLLBACK CHECK', true, false)
on conflict(singleton) do update set owner_id = excluded.owner_id, bank = excluded.bank,
  account_number = excluded.account_number, account_name = excluded.account_name,
  accepts_new_bookings = true, multi_owner_enabled = false;
insert into public.venues(id, owner_id, slug, name, address, district, status)
values ('e0930000-0000-4000-8000-000000000010', 'e0930000-0000-4000-8000-000000000001',
  'booking-input-guards-rollback', 'Booking input rollback', 'Rollback fixture', 'Test', 'active');
insert into public.courts(id, venue_id, name, sport, slot_minutes, open_time, close_time) values
  ('e0930000-0000-4000-8000-000000000030', 'e0930000-0000-4000-8000-000000000010', '30 minutes', 'badminton', 30, null, null),
  ('e0930000-0000-4000-8000-000000000060', 'e0930000-0000-4000-8000-000000000010', '60 minutes', 'badminton', 60, '06:00', '22:00'),
  ('e0930000-0000-4000-8000-000000000090', 'e0930000-0000-4000-8000-000000000010', '90 minutes', 'badminton', 90, null, null),
  ('e0930000-0000-4000-8000-000000000120', 'e0930000-0000-4000-8000-000000000010', '120 minutes', 'badminton', 120, null, null);
insert into public.price_rules(court_id, days, start_time, end_time, price_per_hour)
select id, '{0,1,2,3,4,5,6}'::int[], '05:00'::time, '23:00'::time, 100500
from public.courts where venue_id = 'e0930000-0000-4000-8000-000000000010';




select set_config('request.jwt.claim.sub','e0930000-0000-4000-8000-000000000003',true);
set local role authenticated;
select public.create_booking_once('e0930000-0000-4000-8000-000000000101','e0930000-0000-4000-8000-000000000060',
 (((now() at time zone 'Asia/Ho_Chi_Minh')::date+2)::timestamp+interval '18 hours') at time zone 'Asia/Ho_Chi_Minh',
 (((now() at time zone 'Asia/Ho_Chi_Minh')::date+2)::timestamp+interval '19 hours') at time zone 'Asia/Ho_Chi_Minh','Policy customer','0900000003',null);
reset role;
do $$ declare b public.bookings; begin
 select * into b from public.bookings where user_id='e0930000-0000-4000-8000-000000000003';
 assert b.cancel_window_hours=2 and b.refund_working_days=3 and b.cancellation_policy_version='ordinary-2026-10-09' and b.policy_recorded_at is not null;
 assert not has_column_privilege('authenticated','public.bookings','cancel_window_hours','UPDATE');
 assert not has_column_privilege('authenticated','public.bookings','refund_working_days','UPDATE');
 assert not has_function_privilege('authenticated','public.freeze_booking_policy()','EXECUTE');
 begin update public.bookings set cancel_window_hours=0 where id=b.id;raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'BOOKING_POLICY_IMMUTABLE' then raise;end if;end;
 begin update public.bookings set refund_working_days=1 where id=b.id;raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'BOOKING_POLICY_IMMUTABLE' then raise;end if;end;
 begin update public.bookings set cancellation_policy_version='tampered' where id=b.id;raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'BOOKING_POLICY_IMMUTABLE' then raise;end if;end;
 begin update public.bookings set policy_recorded_at=now()+interval '1 minute' where id=b.id;raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'BOOKING_POLICY_IMMUTABLE' then raise;end if;end;
 -- Even a privileged insert cannot supply fabricated policy values.
 b.id:='e0930000-0000-4000-8000-000000000999';b.code:='SANPQR789';b.user_id:='e0930000-0000-4000-8000-000000000002';
 b.court_id:='e0930000-0000-4000-8000-000000000090';
 b.cancel_window_hours:=0;b.refund_working_days:=1;b.cancellation_policy_version:='forged';b.policy_recorded_at:='2000-01-01';
 insert into public.bookings select b.*;
 select * into b from public.bookings where id=b.id;
 assert b.cancel_window_hours=2 and b.refund_working_days=3 and b.cancellation_policy_version='ordinary-2026-10-09' and b.policy_recorded_at=now();
 -- A hypothetical future policy, strictly inside this rollback transaction.
 execute replace(replace(replace(pg_get_functiondef('public.freeze_booking_policy()'::regprocedure),
  'new.cancel_window_hours:=2;','new.cancel_window_hours:=6;'),'new.refund_working_days:=3;','new.refund_working_days:=5;'),
  'ordinary-2026-10-09','fixture-future-policy');
end $$;
set local role authenticated;
-- Retry after the policy change keeps the original terms and hold.
select public.create_booking_once('e0930000-0000-4000-8000-000000000101','e0930000-0000-4000-8000-000000000060',
 (((now() at time zone 'Asia/Ho_Chi_Minh')::date+2)::timestamp+interval '18 hours') at time zone 'Asia/Ho_Chi_Minh',
 (((now() at time zone 'Asia/Ho_Chi_Minh')::date+2)::timestamp+interval '19 hours') at time zone 'Asia/Ho_Chi_Minh','Policy customer','0900000003',null);
select public.create_booking_once('e0930000-0000-4000-8000-000000000102','e0930000-0000-4000-8000-000000000060',
 (((now() at time zone 'Asia/Ho_Chi_Minh')::date+2)::timestamp+interval '19 hours') at time zone 'Asia/Ho_Chi_Minh',
 (((now() at time zone 'Asia/Ho_Chi_Minh')::date+2)::timestamp+interval '20 hours') at time zone 'Asia/Ho_Chi_Minh','Policy future','0900000003',null);
reset role;
do $$ declare b public.bookings; r jsonb; begin
 select * into b from public.bookings where customer_name='Policy customer' and user_id='e0930000-0000-4000-8000-000000000003';
 assert b.cancel_window_hours=2 and b.refund_working_days=3 and b.cancellation_policy_version='ordinary-2026-10-09';
 r:=public.confirm_payment(b.code,b.deposit_amount,'policy-rollback-old','{}',null,b.payment_bank,b.payment_account);
 assert r->>'reason'='CONFIRMED';
 select * into b from public.bookings where customer_name='Policy future' and user_id='e0930000-0000-4000-8000-000000000003';
 assert b.cancel_window_hours=6 and b.refund_working_days=5 and b.cancellation_policy_version='fixture-future-policy';
 r:=public.confirm_payment(b.code,b.deposit_amount,'policy-rollback-new','{}',null,b.payment_bank,b.payment_account);
 assert r->>'reason'='CONFIRMED';
 -- Exact hour boundary, different courts avoid overlap. UTC instants only.
 update public.bookings set starts_at=now()+interval '2 hours',ends_at=now()+interval '3 hours'
 where customer_name='Policy customer' and user_id='e0930000-0000-4000-8000-000000000003';
 update public.bookings set starts_at=now()+interval '6 hours'-interval '1 second',ends_at=now()+interval '7 hours'-interval '1 second'
 where customer_name='Policy future' and user_id='e0930000-0000-4000-8000-000000000003';
end $$;
set local role authenticated;
do $$ declare b public.bookings; r jsonb; begin
 r:=public.search_my_bookings(null,'all',1,null,null);
 assert (select count(*)=2 from jsonb_array_elements(r->'rows'));
 assert exists(select 1 from jsonb_array_elements(r->'rows') row where (row->>'cancel_window_hours')::int=6 and row->>'refund_working_days'='5');
 select * into b from public.bookings where customer_name='Policy customer';
 b:=public.cancel_booking(b.code);assert b.refund_status='needed','2-hour stored boundary is inclusive despite new default 6';
 select * into b from public.bookings where customer_name='Policy future';
 b:=public.cancel_booking(b.code);assert b.refund_status='none','new policy uses 6 hours instead of global 2';
end $$;
reset role;
select 'OK: frozen policy, retry, insert defaults, future-policy separation, inclusive cancellation boundary and private history';
rollback;
