-- Run against the linked schema; every fixture/config change is rolled back.
-- For pre-deploy checks, wrap the candidate migration and this script in one transaction.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

insert into auth.users(id) values
  ('e0900000-0000-4000-8000-000000000001'),
  ('e0900000-0000-4000-8000-000000000002');
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

create function pg_temp.expect_booking_error(
  expected text, court uuid, starts timestamptz, ends timestamptz,
  customer text default 'Check', phone text default '0900000002', note text default null
) returns void language plpgsql as $$
declare
  previous_bookings bigint; previous_payments bigint; previous_phone text;
begin
  select count(*) into previous_bookings from public.bookings where user_id = auth.uid();
  select count(*) into previous_payments from public.payments;
  select p.phone into previous_phone from public.profiles p where id = auth.uid();
  begin
    perform public.create_booking(court, starts, ends, customer, phone, note);
    raise exception 'CHECK_FAILED: accepted input expected to fail with %', expected;
  exception when raise_exception then
    if sqlerrm <> expected then raise; end if;
  end;
  assert (select count(*) = previous_bookings from public.bookings where user_id = auth.uid()), 'rejection creates no booking';
  assert (select count(*) = previous_payments from public.payments), 'rejection creates no payment';
  assert (select p.phone is not distinct from previous_phone from public.profiles p where id = auth.uid()), 'rejection preserves profile';
end $$;

do $$ begin
  assert not has_function_privilege('anon', 'public.create_booking(uuid,timestamptz,timestamptz,text,text,text)', 'EXECUTE'), 'anonymous RPC stays forbidden';
  assert has_function_privilege('authenticated', 'public.create_booking(uuid,timestamptz,timestamptz,text,text,text)', 'EXECUTE'), 'signed-in RPC remains available';
end $$;
select set_config('request.jwt.claim.sub', 'e0900000-0000-4000-8000-000000000002', true);
set local role authenticated;

do $$
declare
  day date := (now() at time zone 'Asia/Ho_Chi_Minh')::date + 1;
  court record; start_time timestamptz; end_time timestamptz;
  slots int; expected_price int; booking public.bookings;
begin
  for court in select a.court_id, a.slot_minutes, min(a.starts_at) as starts_at
    from public.get_venue_availability('e0900000-0000-4000-8000-000000000010', day) a
    group by a.court_id, a.slot_minutes order by a.slot_minutes
  loop
    start_time := court.starts_at;
    -- Four slots are forbidden even when their total duration is just two hours.
    perform pg_temp.expect_booking_error('TOO_MANY_SLOTS', court.court_id, start_time,
      start_time + make_interval(mins => court.slot_minutes * 4));
    for slots in 1..3 loop
      end_time := start_time + make_interval(mins => court.slot_minutes * slots);
      select sum(a.price)::int into expected_price
        from public.get_venue_availability('e0900000-0000-4000-8000-000000000010', day) a
        where a.court_id = court.court_id and a.starts_at >= start_time and a.ends_at <= end_time;
      booking := public.create_booking(court.court_id, start_time, end_time, '  Nguyễn Văn An  ', ' 0900000002 ', '  Ghi chú  ');
      assert booking.total_amount = expected_price and booking.deposit_amount = expected_price, 'SQL price and full deposit, including non-thousand amounts';
      assert booking.starts_at = start_time and booking.ends_at = end_time, 'requested interval preserved';
      assert booking.customer_name = 'Nguyễn Văn An' and booking.customer_phone = '0900000002' and booking.note = 'Ghi chú', 'contact inputs trimmed';
      assert booking.payment_account = '1234567890' and booking.payment_account_name = 'ROLLBACK CHECK', 'receiver snapshot preserved';
      assert (select count(*) = 1 from public.payments where booking_id = booking.id and amount = expected_price), 'one server-priced payment';
      perform pg_temp.expect_booking_error('SLOT_TAKEN', court.court_id, start_time, end_time);
      perform public.cancel_booking(booking.code, true);
    end loop;
  end loop;
  assert (select count(*) = 12 from public.bookings where user_id = auth.uid()), 'all twelve valid slot combinations tested';

  select min(a.starts_at) into start_time
    from public.get_venue_availability('e0900000-0000-4000-8000-000000000010', day) a
    where a.court_id = 'e0900000-0000-4000-8000-000000000060';
  end_time := start_time + interval '1 hour';
  perform pg_temp.expect_booking_error('PHONE_REQUIRED', 'e0900000-0000-4000-8000-000000000060', start_time, end_time, 'Check', null);
  perform pg_temp.expect_booking_error('PHONE_REQUIRED', 'e0900000-0000-4000-8000-000000000060', start_time, end_time, 'Check', '   ');
  foreach slots in array array[9, 11] loop
    perform pg_temp.expect_booking_error('PHONE_INVALID', 'e0900000-0000-4000-8000-000000000060', start_time, end_time, 'Check', repeat('0', slots));
  end loop;
  perform pg_temp.expect_booking_error('PHONE_INVALID', 'e0900000-0000-4000-8000-000000000060', start_time, end_time, 'Check', '1900000002');
  perform pg_temp.expect_booking_error('PHONE_INVALID', 'e0900000-0000-4000-8000-000000000060', start_time, end_time, 'Check', '090000000x');
  perform pg_temp.expect_booking_error('PHONE_INVALID', 'e0900000-0000-4000-8000-000000000060', start_time, end_time, 'Check', '+84900000002');
  perform pg_temp.expect_booking_error('NAME_TOO_LONG', 'e0900000-0000-4000-8000-000000000060', start_time, end_time, repeat('Đ', 101));
  perform pg_temp.expect_booking_error('NOTE_TOO_LONG', 'e0900000-0000-4000-8000-000000000060', start_time, end_time, 'Check', '0900000002', repeat('đ', 501));
  perform pg_temp.expect_booking_error('INVALID_RANGE', 'e0900000-0000-4000-8000-000000000060', null, end_time);
  perform pg_temp.expect_booking_error('INVALID_RANGE', 'e0900000-0000-4000-8000-000000000060', start_time, null);
  perform pg_temp.expect_booking_error('INVALID_RANGE', 'e0900000-0000-4000-8000-000000000060', start_time, 'infinity');
  perform pg_temp.expect_booking_error('INVALID_RANGE', 'e0900000-0000-4000-8000-000000000060', '-infinity', end_time);
  perform pg_temp.expect_booking_error('INVALID_RANGE', 'e0900000-0000-4000-8000-000000000060', start_time, start_time);
  perform pg_temp.expect_booking_error('INVALID_RANGE', 'e0900000-0000-4000-8000-000000000060', end_time, start_time);
  perform pg_temp.expect_booking_error('SLOT_TAKEN', 'e0900000-0000-4000-8000-000000000060', start_time + interval '1 minute', end_time);

  booking := public.create_booking('e0900000-0000-4000-8000-000000000060', start_time, end_time, repeat('Đ', 100), '0900000002', repeat('đ', 500));
  assert char_length(booking.customer_name) = 100 and char_length(booking.note) = 500, 'boundary-length Vietnamese inputs accepted';
  perform public.cancel_booking(booking.code, true);
  booking := public.create_booking('e0900000-0000-4000-8000-000000000060', start_time, end_time, null, '0900000002', null);
  assert booking.customer_name is null and booking.note is null, 'optional inputs stay compatible';
  perform public.cancel_booking(booking.code, true);
  booking := public.create_booking('e0900000-0000-4000-8000-000000000060', start_time, end_time, '   ', '0900000002', '   ');
  assert booking.customer_name is null and booking.note is null, 'empty optional inputs normalize to null';
  perform public.cancel_booking(booking.code, true);

  -- Two pending holds remain the existing limit, independently of slot count.
  booking := public.create_booking('e0900000-0000-4000-8000-000000000060', start_time, end_time, 'Check', '0900000002');
  booking := public.create_booking('e0900000-0000-4000-8000-000000000060', end_time, end_time + interval '1 hour', 'Check', '0900000002');
  perform pg_temp.expect_booking_error('TOO_MANY_PENDING', 'e0900000-0000-4000-8000-000000000060', end_time + interval '1 hour', end_time + interval '2 hours');
end $$;
reset role;

do $$ begin
  assert (select count(*) = 17 from public.bookings where user_id = 'e0900000-0000-4000-8000-000000000002'), 'rejected calls left no extra bookings';
  assert (select count(*) = 17 from public.payments p join public.bookings b on b.id = p.booking_id where b.user_id = 'e0900000-0000-4000-8000-000000000002'), 'rejected calls left no extra payments';
end $$;
rollback;
