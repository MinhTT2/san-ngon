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
 (((now() at time zone 'Asia/Ho_Chi_Minh')::date+2)::timestamp+interval '19 hours') at time zone 'Asia/Ho_Chi_Minh','Snapshot customer','0900000003',null);
reset role;
do $$ declare b public.bookings; begin
 select * into b from public.bookings where user_id='e0930000-0000-4000-8000-000000000003';
 assert b.court_name_snapshot='60 minutes' and b.sport_snapshot='badminton' and b.venue_name_snapshot='Booking input rollback';
 assert b.venue_address_snapshot='Rollback fixture' and b.venue_district_snapshot='Test' and b.details_recorded_at is not null;
 assert not has_column_privilege('authenticated','public.bookings','court_name_snapshot','UPDATE');
 assert not has_column_privilege('authenticated','public.bookings','venue_address_snapshot','UPDATE'), 'snapshot address update privilege';
 assert not has_function_privilege('authenticated','public.freeze_booking_details()','EXECUTE');
end $$;
update public.courts set name='Court renamed',sport='pickleball' where id='e0930000-0000-4000-8000-000000000060';
update public.venues set name='Venue renamed',address='New address',district='New district',city='New city',slug='snapshot-renamed-rollback'
 where id='e0930000-0000-4000-8000-000000000010';
do $$ declare b public.bookings;r jsonb; begin
 select * into b from public.bookings where user_id='e0930000-0000-4000-8000-000000000003';
 assert b.court_name_snapshot='60 minutes' and b.sport_snapshot='badminton' and b.venue_address_snapshot='Rollback fixture';
 begin update public.bookings set court_name_snapshot='tampered' where id=b.id;raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'BOOKING_DETAILS_IMMUTABLE' then raise;end if;end;
 begin update public.bookings set sport_snapshot='pickleball' where id=b.id;raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'BOOKING_DETAILS_IMMUTABLE' then raise;end if;end;
 begin update public.bookings set venue_name_snapshot='tampered' where id=b.id;raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'BOOKING_DETAILS_IMMUTABLE' then raise;end if;end;
 begin update public.bookings set venue_address_snapshot='tampered' where id=b.id;raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'BOOKING_DETAILS_IMMUTABLE' then raise;end if;end;
 begin update public.bookings set details_recorded_at=now()+interval '1 minute' where id=b.id;raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'BOOKING_DETAILS_IMMUTABLE' then raise;end if;end;
 r:=public.confirm_payment(b.code,b.deposit_amount,'snapshot-rollback-tx','{}'::jsonb,null,b.payment_bank,b.payment_account);
 assert r->>'reason'='CONFIRMED' and r->>'court_name'='60 minutes' and r->>'venue_name'='Booking input rollback';
 assert (select body='Booking input rollback — 60 minutes' from public.notifications where booking_id=b.id and user_id=b.user_id and kind='deposit_paid');
end $$;
select set_config('request.jwt.claim.sub','e0930000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ declare b public.bookings;r jsonb;begin
 select * into b from public.bookings where user_id=auth.uid();
 r:=public.search_my_bookings(p_filter=>'all',p_query=>'badminton'); assert (r->>'total')::int=0; -- uses Vietnamese labels
 r:=public.search_my_bookings(p_filter=>'all',p_query=>'cau long rollback'); assert (r->>'total')::int=1;
 assert r->'rows'->0->'courts'->>'name'='60 minutes' and r->'rows'->0->'courts'->>'sport'='badminton';
 assert r->'rows'->0->'courts'->'venues'->>'name'='Booking input rollback', 'venue snapshot in player history';
 assert r->'rows'->0->'courts'->'venues'->>'slug'='snapshot-renamed-rollback', 'rebooking link keeps current slug';
 r:=public.get_booking_calendar(b.code);assert r->>'title'='Booking input rollback · 60 minutes' and (r->>'location') like 'Rollback fixture, Test,%';
 select * into b from public.create_booking_once('e0930000-0000-4000-8000-000000000101',b.court_id,b.starts_at,b.ends_at,'Snapshot customer','0900000003',null);
 assert b.court_name_snapshot='60 minutes' and b.sport_snapshot='badminton', 'retry cannot recapture edited details';
 perform public.cancel_booking(b.code);
 assert (select court_name_snapshot='60 minutes' and status='cancelled' from public.bookings where id=b.id);
 -- The next booking captures the updated information rather than copying history.
 select * into b from public.create_booking('e0930000-0000-4000-8000-000000000060',
 (((now() at time zone 'Asia/Ho_Chi_Minh')::date+3)::timestamp+interval '18 hours') at time zone 'Asia/Ho_Chi_Minh',
 (((now() at time zone 'Asia/Ho_Chi_Minh')::date+3)::timestamp+interval '19 hours') at time zone 'Asia/Ho_Chi_Minh','Next customer','0900000003',null);
 assert b.court_name_snapshot='Court renamed' and b.sport_snapshot='pickleball' and b.venue_name_snapshot='Venue renamed';
end $$;
reset role;
update public.courts set name='Renamed again' where id='e0930000-0000-4000-8000-000000000060';
update public.venues set name='Renamed again' where id='e0930000-0000-4000-8000-000000000010';
select set_config('request.jwt.claim.sub','e0930000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare r jsonb;b public.bookings;begin
 r:=public.search_owner_bookings('e0930000-0000-4000-8000-000000000010',p_status=>'cancelled',p_show_history=>true);
 assert r->'rows'->0->>'courtName'='60 minutes';
 select * into b from public.bookings where user_id='e0930000-0000-4000-8000-000000000003' and status='pending';
 perform public.confirm_payment_manual(b.code);
 assert (select body='Court renamed · 0900000003' from public.notifications where booking_id=b.id and kind='new_booking'), 'manual confirmation snapshot notification';
end $$;
reset role;
rollback;
