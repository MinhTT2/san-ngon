-- npx supabase db query --linked --file scripts/check-court-prices.sql
-- Isolated fixtures; all changes are rolled back, no email/booking is created.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  venue_id uuid := gen_random_uuid();
  court_id uuid := gen_random_uuid();
  base_id uuid := gen_random_uuid();
  tomorrow date := (now() at time zone 'Asia/Ho_Chi_Minh')::date + 1;
  rule price_rules;
  tie_rule price_rules;
  calendar jsonb;
begin
  insert into auth.users(id) values(owner_id);
  update profiles set payout_bank = 'MB', payout_account = '1234567890', role = 'owner', owner_application_status = 'active' where id = owner_id;
  insert into venues(id, owner_id, slug, name, address, district, status, booking_horizon_days)
    values(venue_id, owner_id, 'price-check-' || venue_id, 'Rollback price check', 'Test', 'Test', 'active', 30);
  insert into courts(id, venue_id, name, sport) values(court_id, venue_id, 'Test', 'badminton');
  insert into price_rules(id, court_id, label, days, start_time, end_time, price_per_hour, priority)
    values(base_id, court_id, 'Giá chung', '{0,1,2,3,4,5,6}', '05:00', '23:00', 100000, 0);
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  rule := save_price_rule(court_id, null, 'Giờ tối', array[extract(dow from tomorrow)::int], '18:00', '21:00', 200000, 10);
  assert (select price from get_venue_availability(venue_id, tomorrow) s where s.starts_at = (tomorrow + time '18:00') at time zone 'Asia/Ho_Chi_Minh') = 200000, 'special price';
  assert (select price from get_venue_availability(venue_id, tomorrow) s where s.starts_at = (tomorrow + time '21:00') at time zone 'Asia/Ho_Chi_Minh') = 100000, 'end exclusive';
  tie_rule := save_price_rule(court_id, null, 'Giá trùng', '{0,1,2,3,4,5,6}', '18:00', '21:00', 250000, 10);
  assert (select price from get_venue_availability(venue_id, tomorrow) s where s.starts_at = (tomorrow + time '18:00') at time zone 'Asia/Ho_Chi_Minh') = 250000, 'highest price wins equal priority';
  perform save_price_rule(court_id, rule.id, 'Giờ tối', rule.days, '18:00', '21:00', 150000, 20);
  assert (select price from get_venue_availability(venue_id, tomorrow) s where s.starts_at = (tomorrow + time '18:00') at time zone 'Asia/Ho_Chi_Minh') = 150000, 'priority before amount';
  perform delete_price_rule(court_id, rule.id);
  perform delete_price_rule(court_id, tie_rule.id);
  assert (select price from get_venue_availability(venue_id, tomorrow) s where s.starts_at = (tomorrow + time '18:00') at time zone 'Asia/Ho_Chi_Minh') = 100000, 'fallback after deleting overrides';
  rule := save_price_rule(court_id, base_id, 'Rename attempted', '{6}', '18:00', '19:00', 120000, 99);
  assert rule.label = 'Giá chung' and cardinality(rule.days) = 7 and rule.start_time = '05:00' and rule.priority = 0, 'base coverage immutable';
  begin
    perform delete_price_rule(court_id, base_id);
    raise exception 'CHECK_FAILED: deleted base';
  exception when raise_exception then if sqlerrm <> 'BASE_PRICE_REQUIRED' then raise; end if; end;
  begin
    perform save_price_rule(court_id, null, 'Invalid', '{}', '18:00', '19:00', 100000, 10);
    raise exception 'CHECK_FAILED: empty days';
  exception when raise_exception then if sqlerrm <> 'PRICE_DAYS_INVALID' then raise; end if; end;
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  begin
    perform save_price_rule(court_id, base_id, 'Giá chung', '{0}', '05:00', '23:00', 1000, 0);
    raise exception 'CHECK_FAILED: non-owner write';
  exception when raise_exception then if sqlerrm <> 'COURT_NOT_FOUND' then raise; end if; end;
  begin
    perform delete_price_rule(court_id, base_id);
    raise exception 'CHECK_FAILED: non-owner delete';
  exception when raise_exception then if sqlerrm <> 'COURT_NOT_FOUND' then raise; end if; end;
  assert not has_function_privilege('anon', 'save_price_rule(uuid,uuid,text,integer[],time,time,integer,integer)', 'EXECUTE'), 'anonymous write denied';
  perform set_config('TimeZone', 'America/Los_Angeles', true);
  calendar := get_venue_calendar(venue_id, tomorrow + 19);
  assert calendar->>'date' = (tomorrow + 19)::text, 'date beyond quick-pick range';
  assert calendar->>'today' = ((now() at time zone 'Asia/Ho_Chi_Minh')::date)::text, 'Vietnam calendar independent of session timezone';
  assert (get_venue_calendar(venue_id, tomorrow + 365)->>'date') = calendar->>'last_date', 'server clamps horizon';
end $$;
rollback;
