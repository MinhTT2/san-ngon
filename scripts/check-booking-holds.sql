-- Run: npx supabase db query --linked --file scripts/check-booking-holds.sql
-- Everything is rolled back, including users, bookings, payments and notifications.
begin;
insert into auth.users (id) values ('a0000000-0000-4000-8000-000000000001');
update profiles set payout_bank = 'MB', payout_account = '1234567890'
  where id = 'a0000000-0000-4000-8000-000000000001';
insert into booking_operator (owner_id, bank, account_number, account_name, accepts_new_bookings)
values ('a0000000-0000-4000-8000-000000000001', 'MBBank', '1234567890', 'CHECK OWNER', true)
on conflict (singleton) do update set owner_id = excluded.owner_id, bank = excluded.bank,
  account_number = excluded.account_number, account_name = excluded.account_name, accepts_new_bookings = true;
insert into venues (id, owner_id, slug, name, address, district, status)
values ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
  'check-holds-rollback', 'Hold check', 'Test', 'Test', 'active');
insert into courts (id, venue_id, name, sport)
values ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', 'Court', 'badminton');
insert into price_rules (court_id, days, start_time, end_time, price_per_hour)
values ('a0000000-0000-4000-8000-000000000003', '{0,1,2,3,4,5,6}', '05:00', '23:00', 100000);
-- A second venue for the operator is allowed; another owner is not, even with the same bank account.
insert into auth.users (id) values ('a0000000-0000-4000-8000-000000000004');
update profiles set payout_bank = 'MB', payout_account = '1234567890'
  where id = 'a0000000-0000-4000-8000-000000000004';
insert into venues (id, owner_id, slug, name, address, district, status) values
  ('a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000004', 'check-other-rollback', 'Other owner', 'Test', 'Test', 'active'),
  ('a0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'check-second-rollback', 'Second venue', 'Test', 'Test', 'active');
insert into courts (id, venue_id, name, sport) values
  ('a0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000005', 'Other court', 'badminton'),
  ('a0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000007', 'Second court', 'badminton');
insert into price_rules (court_id, days, start_time, end_time, price_per_hour) values
  ('a0000000-0000-4000-8000-000000000006', '{0,1,2,3,4,5,6}', '05:00', '23:00', 100000),
  ('a0000000-0000-4000-8000-000000000008', '{0,1,2,3,4,5,6}', '05:00', '23:00', 100000);
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);

do $$
declare
  v_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date + 1;
  v_start timestamptz := (v_date + time '10:00') at time zone 'Asia/Ho_Chi_Minh';
  v_court uuid := 'a0000000-0000-4000-8000-000000000003';
  v_venue uuid := 'a0000000-0000-4000-8000-000000000002';
  b bookings; replacement bookings; a record; result jsonb;
begin
  assert venue_accepts_bookings(v_venue), 'operator accepts bookings';
  assert venue_accepts_bookings('a0000000-0000-4000-8000-000000000007'), 'operator can have multiple venues';
  assert not venue_accepts_bookings('a0000000-0000-4000-8000-000000000005'), 'second owner cannot receive bookings';
  assert not has_table_privilege('authenticated', 'booking_operator', 'UPDATE'), 'owner cannot change operator';
  begin
    insert into booking_operator (singleton, owner_id) values (false, 'a0000000-0000-4000-8000-000000000004');
    raise exception 'CHECK_FAILED: second operator allowed';
  exception when check_violation then null; end;
  begin
    perform create_booking('a0000000-0000-4000-8000-000000000006', v_start, v_start + interval '1 hour', 'Check', '0900000000');
    raise exception 'CHECK_FAILED: second owner booking allowed';
  exception when raise_exception then if sqlerrm <> 'VENUE_NOT_ACCEPTING_BOOKINGS' then raise; end if; end;
  b := create_booking('a0000000-0000-4000-8000-000000000008', v_start, v_start + interval '1 hour', 'Check', '0900000000');
  perform cancel_booking(b.code, true);

  b := create_booking(v_court, v_start, v_start + interval '1 hour', 'Check', '0900000000');
  assert b.total_amount = 100000 and b.deposit_amount = 30000, 'server price';
  assert b.status = 'pending' and b.expires_at = now() + interval '15 minutes', '15 minute hold';
  select * into a from get_venue_availability(v_venue, v_date) where starts_at = v_start;
  assert not a.is_available and a.slot_status = 'held' and a.hold_expires_at = b.expires_at, 'hold visible';
  begin
    perform create_booking(v_court, v_start, v_start + interval '1 hour', 'Check', '0900000000');
    raise exception 'CHECK_FAILED: double booking';
  exception when raise_exception then if sqlerrm <> 'SLOT_TAKEN' then raise; end if; end;
  -- Independent constraint must also reject bypassing the booking function.
  begin
    insert into bookings (code, court_id, user_id, starts_at, ends_at, total_amount, deposit_amount, customer_phone)
    values ('SANZZZZZZ', v_court, auth.uid(), v_start, v_start + interval '1 hour', 100000, 30000, '0900000000');
    raise exception 'CHECK_FAILED: missing GiST exclusion';
  exception when exclusion_violation then null; end;
  perform cancel_booking(b.code, true);
  assert (select is_available from get_venue_availability(v_venue, v_date) where starts_at = v_start), 'cancel releases';

  b := create_booking(v_court, v_start, v_start + interval '1 hour', 'Check', '0900000000');
  update bookings set expires_at = now() - interval '1 second' where id = b.id;
  assert (select is_available from get_venue_availability(v_venue, v_date) where starts_at = v_start), 'expiry releases before cron';
  begin
    perform confirm_payment_manual(b.code);
    raise exception 'CHECK_FAILED: manual confirmation revived expired hold';
  exception when raise_exception then if sqlerrm <> 'NOT_PENDING' then raise; end if; end;
  replacement := create_booking(v_court, v_start, v_start + interval '1 hour', 'Check', '0900000000');
  assert (select status = 'cancelled' from bookings where id = b.id), 'stale GiST entry cleared';
  result := confirm_payment(b.code, 30000, 'check-holds-late', '{"gateway":"MBBank","accountNumber":"1234567890"}');
  assert result->>'reason' = 'BOOKING_CANCELLED', 'late payment cannot revive';
  assert (select refund_status = 'needed' from bookings where id = b.id), 'late payment needs refund';
  assert (select status = 'pending' from bookings where id = replacement.id), 'replacement untouched';
  result := confirm_payment(replacement.code, 29000, 'check-holds-underpaid', '{"gateway":"MBBank","accountNumber":"1234567890"}');
  assert result->>'reason' = 'UNDERPAID', 'underpaid cannot confirm';
  assert (select status = 'pending' from bookings where id = replacement.id), 'underpaid holds stay pending';
  result := confirm_payment(replacement.code, 30000, 'check-holds-paid', '{"gateway":"MBBank","accountNumber":"1234567890"}');
  assert result->>'reason' = 'CONFIRMED', 'valid payment confirms';
  result := confirm_payment(replacement.code, 30000, 'check-holds-paid', '{"gateway":"MBBank","accountNumber":"1234567890"}');
  assert result->>'reason' = 'ALREADY_PROCESSED', 'webhook retry idempotent';
  assert (select count(*) = 2 from notifications where booking_id = replacement.id), 'retry does not duplicate notifications';
  update bookings set expires_at = now() - interval '1 second' where id = replacement.id;
  select * into a from get_venue_availability(v_venue, v_date) where starts_at = v_start;
  assert not a.is_available and a.slot_status = 'booked' and a.hold_expires_at is null, 'paid booking stays blocked';
  begin
    perform cancel_booking(replacement.code, true);
    raise exception 'CHECK_FAILED: pending-only cancel cancelled paid booking';
  exception when raise_exception then if sqlerrm <> 'NOT_CANCELLABLE' then raise; end if; end;
  perform cancel_booking(replacement.code);

  -- Late payment also rejected if cron/another customer has not touched the row yet.
  b := create_booking(v_court, v_start, v_start + interval '1 hour', 'Check', '0900000000');
  update bookings set expires_at = now() - interval '1 second' where id = b.id;
  result := confirm_payment(b.code, 30000, 'check-holds-late-pending', '{"gateway":"MBBank","accountNumber":"1234567890"}');
  assert result->>'reason' = 'BOOKING_CANCELLED', 'late pending payment rejected';
  assert (select is_available from get_venue_availability(v_venue, v_date) where starts_at = v_start), 'late payment leaves slot free';
end $$;

set local role authenticated;
do $$
declare b bookings; v_start timestamptz := (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 1) + time '10:00') at time zone 'Asia/Ho_Chi_Minh';
begin
  begin
    perform create_booking('a0000000-0000-4000-8000-000000000006', v_start, v_start + interval '1 hour', 'Check', '0900000000');
    raise exception 'CHECK_FAILED: authenticated second owner booking allowed';
  exception when raise_exception then if sqlerrm <> 'VENUE_NOT_ACCEPTING_BOOKINGS' then raise; end if; end;
  b := create_booking('a0000000-0000-4000-8000-000000000003', v_start, v_start + interval '1 hour', 'Check', '0900000000');
  perform cancel_booking(b.code, true);
  begin
    insert into bookings (code, court_id, user_id, starts_at, ends_at, total_amount, deposit_amount, customer_phone)
    values ('SANZZZZZY', 'a0000000-0000-4000-8000-000000000003', auth.uid(),
      now() + interval '2 days', now() + interval '2 days 1 hour', 0, 0, '0900000000');
    raise exception 'CHECK_FAILED: direct booking insert allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  assert exists (select 1 from get_venue_availability('a0000000-0000-4000-8000-000000000002',
    (now() at time zone 'Asia/Ho_Chi_Minh')::date + 1)), 'public availability accessible';
  begin
    assert not exists (select 1 from bookings where court_id = 'a0000000-0000-4000-8000-000000000003'), 'customer bookings stay private';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- OAuth isolation and rollout checks, using only rolled-back fixtures.
update profiles set role = 'owner', owner_application_status = 'active'
where id in ('a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000004');
do $$
declare
  a sepay_connections; c sepay_connections; b bookings; legacy bookings; other bookings; result jsonb;
  op uuid := gen_random_uuid();
  t timestamptz := (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 1) + time '14:00') at time zone 'Asia/Ho_Chi_Minh';
begin
  legacy := create_booking('a0000000-0000-4000-8000-000000000003',t,t+interval '1 hour','Check','0900000000');
  perform cancel_booking(legacy.code,true);
  a := claim_sepay_connection(auth.uid(),op);
  begin
    perform claim_sepay_connection(auth.uid(),gen_random_uuid());
    raise exception 'CHECK_FAILED: overlapping operations allowed';
  exception when raise_exception then if sqlerrm <> 'CONNECTION_BUSY' then raise; end if; end;
  c := claim_sepay_connection('a0000000-0000-4000-8000-000000000004',op);
  update sepay_connections set bank_account_id='check-a',bank='MBBank',account_number='1111111111',
    account_name='OWNER A',webhook_id='check-a',webhook_key_hash='check-a' where id=a.id;
  update sepay_connections set bank_account_id='check-b',bank='ACB',account_number='2222222222',
    account_name='OWNER B',webhook_id='check-b',webhook_key_hash='check-b' where id=c.id;
  perform activate_sepay_connection(a.owner_id,op);
  perform activate_sepay_connection(c.owner_id,op);
  assert not (select accepts_new_bookings from booking_operator), 'cutover disables legacy fallback';
  assert not venue_accepts_bookings('a0000000-0000-4000-8000-000000000005'), 'real-transfer acceptance gate stays closed';
  update booking_operator set multi_owner_enabled=true;
  assert venue_accepts_bookings('a0000000-0000-4000-8000-000000000005'), 'approved connected second owner accepts after rollout';
  assert (select payment_connection_id is null and payment_account='1234567890' from bookings where id=legacy.id), 'legacy snapshot unchanged';
  b := create_booking('a0000000-0000-4000-8000-000000000003',t,t+interval '1 hour','Check','0900000000');
  other := create_booking('a0000000-0000-4000-8000-000000000006',t,t+interval '1 hour','Check','0900000000');
  assert b.payment_connection_id=a.id and b.payment_account='1111111111', 'A snapshot';
  assert other.payment_connection_id=c.id and other.payment_account='2222222222', 'B snapshot';
  result := confirm_payment(other.code,30000,'same-id','{}',a.id,'ACB','2222222222');
  assert result->>'reason'='WRONG_RECEIVER', 'A cannot confirm B even with B bank and code';
  result := confirm_payment(other.code,30000,'same-id','{}',c.id,'MBBank','1111111111');
  assert result->>'reason'='WRONG_RECEIVER', 'wrong bank rejected';
  assert not exists(select 1 from sepay_events where booking_id=other.id), 'wrong receiver creates no event';
  begin
    perform disconnect_sepay_connection(a.owner_id,op);
    raise exception 'CHECK_FAILED: disconnected while pending';
  exception when raise_exception then if sqlerrm <> 'PENDING_PAYMENTS' then raise; end if; end;
  result := confirm_payment(b.code,1000,'underpaid','{}',a.id,'MBBank','1111111111');
  assert result->>'reason'='UNDERPAID', 'OAuth underpaid';
  result := confirm_payment(b.code,30000,'same-id','{}',a.id,'MBBank','1111111111');
  assert result->>'reason'='CONFIRMED', 'A confirms A';
  result := confirm_payment(other.code,30000,'same-id','{}',c.id,'ACB','2222222222');
  assert result->>'reason'='CONFIRMED', 'B transaction namespace independent';
  result := confirm_payment(b.code,1000,'underpaid','{}',a.id,'MBBank','1111111111');
  assert result->>'reason'='ALREADY_PROCESSED', 'underpaid retry remains consumed after confirmation';
  result := confirm_payment(other.code,30000,'same-id','{}',c.id,'ACB','2222222222');
  assert result->>'reason'='ALREADY_PROCESSED', 'OAuth retry';
  assert (select count(*)=2 from notifications where booking_id=other.id), 'OAuth no duplicate notifications';
  perform disconnect_sepay_connection(a.owner_id,op);
  assert not venue_accepts_bookings('a0000000-0000-4000-8000-000000000002'), 'disconnect has no legacy fallback';
  result := confirm_payment(legacy.code,30000,'legacy-after-oauth','{"gateway":"MBBank","accountNumber":"1234567890"}');
  assert result->>'reason'='BOOKING_CANCELLED', 'legacy late payment still processed after migration';
  assert not has_table_privilege('authenticated','sepay_connections','SELECT'), 'tokens private';
  assert not has_table_privilege('authenticated','sepay_oauth_states','SELECT'), 'states private';
  assert not has_column_privilege('authenticated','bookings','payment_account','UPDATE'), 'snapshot protected';
  assert not has_column_privilege('authenticated','payments','raw','SELECT'), 'raw bank data private';
  assert not has_function_privilege('authenticated','activate_sepay_connection(uuid,uuid)','EXECUTE'), 'browser cannot activate';
end $$;
rollback;
