-- Run against the linked schema; every fixture/config change is rolled back.
-- For pre-deploy checks, wrap the candidate migration and this script in one transaction.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

insert into auth.users(id) values
  ('e1030000-0000-4000-8000-000000000001'),
  ('e1030000-0000-4000-8000-000000000002'),
  ('e1030000-0000-4000-8000-000000000003');
update public.profiles set role = 'owner', owner_application_status = 'active',
  payout_bank = 'MB', payout_account = '1234567890'
where id = 'e1030000-0000-4000-8000-000000000001';
update public.profiles set phone = '0900000999'
where id = 'e1030000-0000-4000-8000-000000000002';

-- The singleton is changed only inside this short rollback transaction.
insert into public.booking_operator(owner_id, bank, account_number, account_name, accepts_new_bookings, multi_owner_enabled)
values ('e1030000-0000-4000-8000-000000000001', 'MBBank', '1234567890', 'ROLLBACK CHECK', true, false)
on conflict(singleton) do update set owner_id = excluded.owner_id, bank = excluded.bank,
  account_number = excluded.account_number, account_name = excluded.account_name,
  accepts_new_bookings = true, multi_owner_enabled = false;
insert into public.venues(id, owner_id, slug, name, address, district, status)
values ('e1030000-0000-4000-8000-000000000010', 'e1030000-0000-4000-8000-000000000001',
  'incoming-ledger-rollback', 'Booking input rollback', 'Rollback fixture', 'Test', 'active');
insert into public.courts(id, venue_id, name, sport, slot_minutes, open_time, close_time) values
  ('e1030000-0000-4000-8000-000000000030', 'e1030000-0000-4000-8000-000000000010', '30 minutes', 'badminton', 30, null, null),
  ('e1030000-0000-4000-8000-000000000060', 'e1030000-0000-4000-8000-000000000010', '60 minutes', 'badminton', 60, '06:00', '22:00'),
  ('e1030000-0000-4000-8000-000000000090', 'e1030000-0000-4000-8000-000000000010', '90 minutes', 'badminton', 90, null, null),
  ('e1030000-0000-4000-8000-000000000120', 'e1030000-0000-4000-8000-000000000010', '120 minutes', 'badminton', 120, null, null);
insert into public.price_rules(court_id, days, start_time, end_time, price_per_hour)
select id, '{0,1,2,3,4,5,6}'::int[], '05:00'::time, '23:00'::time, 100000
from public.courts where venue_id = 'e1030000-0000-4000-8000-000000000010';





insert into auth.users(id) values ('e1030000-0000-4000-8000-000000000004');
update profiles set role='admin' where id='e1030000-0000-4000-8000-000000000004';
update profiles set role='owner',owner_application_status='active' where id='e1030000-0000-4000-8000-000000000002';
create temp table ledger_cases(name text primary key,code text,booking_id uuid);
select set_config('request.jwt.claim.sub','e1030000-0000-4000-8000-000000000003',true);
do $$ declare b bookings; r jsonb; n int:=0; name text; amt int; begin
 foreach name in array array['exact','over','short','late','manual','wrong','cross'] loop
  n:=n+1;
  b:=create_booking('e1030000-0000-4000-8000-000000000060',
   (((now() at time zone 'Asia/Ho_Chi_Minh')::date+n)::timestamp+interval '18 hours') at time zone 'Asia/Ho_Chi_Minh',
   (((now() at time zone 'Asia/Ho_Chi_Minh')::date+n)::timestamp+interval '19 hours') at time zone 'Asia/Ho_Chi_Minh','Ledger fixture','0900000003',null);
  insert into ledger_cases values(name,b.code,b.id);
  if name in ('wrong','cross') then
    r:=process_incoming_transfer(array[b.code],100000,(910000+n)::text,'{}',null,'OtherBank','9876543210');
    assert r->>'reason'='WRONG_RECEIVER';
    assert exists(select 1 from incoming_transfers where bank_tx_id=(910000+n)::text and receiver_owner_id is null and booking_id is null and outcome='wrong_receiver');
    perform cancel_booking(b.code);
  elsif name='manual' then
    perform set_config('request.jwt.claim.sub','e1030000-0000-4000-8000-000000000001',true);
    perform confirm_payment_manual(b.code);
    perform set_config('request.jwt.claim.sub','e1030000-0000-4000-8000-000000000003',true);
    r:=process_incoming_transfer(array[b.code],100000,(910000+n)::text,'{}',null,b.payment_bank,b.payment_account);
    assert r->>'reason'='ALREADY_CONFIRMED';
    assert (select outcome='manual_confirmed' from incoming_transfers where bank_tx_id=(910000+n)::text);
  else
    if name='late' then update bookings set expires_at=now() where id=b.id;end if;
    amt:=case name when 'over' then 110000 when 'short' then 60000 else 100000 end;
    r:=process_incoming_transfer(array[b.code],amt,(910000+n)::text,'{"private":"secret"}',null,b.payment_bank,b.payment_account);
    assert r->>'reason'=case name when 'short' then 'UNDERPAID' when 'late' then 'BOOKING_CANCELLED' else 'CONFIRMED' end;
    assert (select amount=amt and outcome=case name when 'short' then 'underpaid' when 'late' then 'late' when 'over' then 'overpaid' else 'exact' end from incoming_transfers where bank_tx_id=(910000+n)::text);
    if name='short' then
      r:=process_incoming_transfer(array[b.code],60000,'920003','{}',null,b.payment_bank,b.payment_account);
      assert r->>'reason'='UNDERPAID';assert (select status='pending' from bookings where id=b.id),'two short receipts do not sum to confirmation';
      r:=process_incoming_transfer(array[b.code],100000,'930003','{}',null,b.payment_bank,b.payment_account);
      assert r->>'reason'='CONFIRMED';assert (select outcome='overpaid' from incoming_transfers where bank_tx_id='930003');
    end if;
  end if;
 end loop;
 select * into b from bookings where id=(select booking_id from ledger_cases where ledger_cases.name='exact');
 r:=process_incoming_transfer(array[lower(b.code),b.code],100000,'910001','{"retry":"metadata only"}',null,b.payment_bank,b.payment_account);
 assert r->>'reason'='ALREADY_PROCESSED';
 assert (select count(*)=1 from incoming_transfers where bank_tx_id='910001');
 assert (select raw='{"private":"secret"}'::jsonb from incoming_transfers where bank_tx_id='910001');
 r:=process_incoming_transfer(array[b.code],100001,'910001','{}',null,b.payment_bank,b.payment_account);
 assert r->>'reason'='PAYMENT_PAYLOAD_CONFLICT';assert (select amount=100000 and payload_conflicts=1 and needs_review from incoming_transfers where bank_tx_id='910001');
 r:=process_incoming_transfer(array[b.code],100000,'920001','{}',null,b.payment_bank,b.payment_account);
 assert r->>'reason'='ALREADY_CONFIRMED';assert (select outcome='duplicate' from incoming_transfers where bank_tx_id='920001');
 select count(*) into n from notifications where user_id=b.payment_owner_id;
 r:=process_incoming_transfer('{}',12345,'940001','{}',null,b.payment_bank,b.payment_account);assert r->>'reason'='NO_REF_CODE';
 r:=process_incoming_transfer(array[b.code],12345,'940001','{}',null,b.payment_bank,b.payment_account);assert r->>'reason'='PAYMENT_PAYLOAD_CONFLICT','cannot assign unidentified receipt by replay';
 r:=process_incoming_transfer(array[b.code,'PHIABCDEF12'],12345,'940002','{}',null,b.payment_bank,b.payment_account);assert r->>'reason'='AMBIGUOUS_REF_CODE';
 r:=process_incoming_transfer(array['SANZZZ999'],12345,'940003','{}',null,b.payment_bank,b.payment_account);assert r->>'reason'='REF_NOT_FOUND';
 assert (select count(*) from notifications where user_id=b.payment_owner_id)=n,'personal, unknown and ambiguous transfers must not notify the owner';
 r:=process_incoming_transfer('{}',0,'940004','{}',null,b.payment_bank,b.payment_account);assert r->>'reason'='INVALID_PAYMENT';
 assert not exists(select 1 from incoming_transfers where bank_tx_id='940004');
 begin update incoming_transfers set amount=1 where bank_tx_id='910001';raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'RECEIPT_IMMUTABLE' then raise;end if;end;
 begin update incoming_transfers set raw='{}' where bank_tx_id='910001';raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'RECEIPT_IMMUTABLE' then raise;end if;end;
end $$;

-- Same physical receipt cannot be applied to fees and a court, even through the older RPC.
insert into owner_subscriptions(owner_id,fee_required) values ('e1030000-0000-4000-8000-000000000002',true);
insert into subscription_invoices(owner_id,code,bank,account_number,account_name) values
 ('e1030000-0000-4000-8000-000000000002','PHIABCDEF12','MBBank','1234567890','ROLLBACK');
do $$ declare r jsonb;b bookings;begin
 r:=process_incoming_transfer(array['PHIABCDEF12'],299000,'950001','{}',null,'MBBank','1234567890');assert r->>'reason'='SUBSCRIPTION_PAID';
 assert (select source='subscription' and outcome='exact' and receiver_owner_id='e1030000-0000-4000-8000-000000000001' from incoming_transfers where bank_tx_id='950001'),'payer is not receiver';
 select * into b from bookings where id=(select booking_id from ledger_cases where ledger_cases.name='cross');
 r:=confirm_payment(b.code,299000,'950001','{}',null,'MBBank','1234567890');assert r->>'reason'='ALREADY_PROCESSED';
 r:=process_incoming_transfer(array['PHIABCDEF12'],299000,'950002','{}',null,'MBBank','1234567890');assert r->>'reason'='ALREADY_PAID';
 assert (select outcome='duplicate' from incoming_transfers where bank_tx_id='950002');
end $$;

-- Actual latest tournament return values and receiver snapshots.
insert into tournaments(id,manager_id,court_id,title,description,sport,address,starts_at,ends_at,registration_deadline,payment_deadline,capacity,entry_fee,deposit_amount,status)
values('e1030000-0000-4000-8000-000000000500','e1030000-0000-4000-8000-000000000001','e1030000-0000-4000-8000-000000000060','Ledger tournament','Rollback only tournament','badminton','Hanoi test',now()+interval '20 days',now()+interval '20 days 2 hours',now()+interval '19 days',now()+interval '19 days',16,100000,100000,'published');
insert into tournament_registrations(tournament_id,user_id,full_name,phone,address,status,code,entry_fee,deposit_amount,bank,account_number,account_name,payment_owner_id,payment_expires_at)
values('e1030000-0000-4000-8000-000000000500','e1030000-0000-4000-8000-000000000003','Ledger player','0900000003','Hanoi','approved','GIAIABCDEF123456',100000,100000,'MBBank','1234567890','ROLLBACK','e1030000-0000-4000-8000-000000000001',now()+interval '1 day');
do $$ declare r jsonb;begin
 r:=process_incoming_transfer(array['GIAIABCDEF123456'],110000,'960001','{}',null,'MBBank','1234567890');assert r->>'reason'='OVERPAID';
 assert (select source='tournament' and outcome='overpaid' from incoming_transfers where bank_tx_id='960001');
 r:=process_incoming_transfer(array['GIAIABCDEF123456'],100000,'960002','{}',null,'MBBank','1234567890');assert r->>'reason'='DUPLICATE_PAYMENT';
 assert (select outcome='duplicate' from incoming_transfers where bank_tx_id='960002');
 update tournament_registrations set paid_at=null,payment_expires_at=now() where code='GIAIABCDEF123456';
 r:=process_incoming_transfer(array['GIAIABCDEF123456'],100000,'960003','{}',null,'MBBank','1234567890');assert r->>'reason'='LATE_OR_CANCELLED';
 assert (select outcome='late' from incoming_transfers where bank_tx_id='960003');
end $$;
-- OAuth receiver ownership, authenticated receiver mismatch and separate account scope.
insert into sepay_connections(id,owner_id,status,bank,account_number,account_name)
values('e1030000-0000-4000-8000-000000000600','e1030000-0000-4000-8000-000000000002','ready','TestBank','9876543210','OTHER OWNER');
do $$ declare r jsonb;begin
 r:=process_incoming_transfer('{}',999,'980001','{}','e1030000-0000-4000-8000-000000000600','TestBank','9876543210');assert r->>'reason'='NO_REF_CODE';
 assert (select receiver_owner_id='e1030000-0000-4000-8000-000000000002' from incoming_transfers where bank_tx_id='980001');
 r:=process_incoming_transfer('{}',999,'980002','{}','e1030000-0000-4000-8000-000000000600','MBBank','1234567890');assert r->>'reason'='WRONG_RECEIVER';
 assert not exists(select 1 from incoming_transfers where bank_tx_id='980002');
end $$;
-- Revenue is allocated booking money, not the bank ledger or future playing dates.
select set_config('request.jwt.claim.sub','e1030000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb;a jsonb;today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;v uuid:='e1030000-0000-4000-8000-000000000010';begin
 r:=get_owner_stats(v,today,today);
 assert (r->'summary'->>'revenue')::bigint=400000,'four paid booking deposits, excluding excess/duplicates, late receipts, fees, tournaments and personal transfers';
 assert (r->'summary'->>'paid_bookings')::int=4;
 assert (r->'summary'->>'bookings')::int=0,'playing dates remain a separate operational measure';
 assert (r->'daily'->0->>'revenue')::bigint=400000;
 assert (select sum((x->>'revenue')::bigint) from jsonb_array_elements(r->'courts') x)=400000,'court revenues sum to summary';
 assert not (r->'summary' ? 'players'),'owner must not receive platform account counts';
 perform cancel_booking((select code from ledger_cases where name='exact'));
 assert (get_owner_stats(v,today,today)->'summary'->>'revenue')::bigint=300000,'exclude refundable cancellation immediately';
 perform mark_refund_done((select code from ledger_cases where name='exact'));
 assert (get_owner_stats(v,today,today)->'summary'->>'revenue')::bigint=300000,'already refunded is also excluded';
 update bookings set refund_status='none' where id=(select booking_id from ledger_cases where name='exact');
 assert (get_owner_stats(v,today,today)->'summary'->>'revenue')::bigint=400000,'non-refundable paid cancellation retains deposit';
 update bookings set status='no_show' where id=(select booking_id from ledger_cases where name='exact');
 assert (get_owner_stats(v,today,today)->'summary'->>'revenue')::bigint=400000,'paid no-show retains deposit';
 update bookings set paid_at=today::timestamp at time zone 'Asia/Ho_Chi_Minh' where id=(select booking_id from ledger_cases where name='exact');
 update bookings set paid_at=(today::timestamp at time zone 'Asia/Ho_Chi_Minh')-interval '1 second' where id=(select booking_id from ledger_cases where name='short');
 assert (get_owner_stats(v,today,today)->'summary'->>'revenue')::bigint=300000,'Vietnam midnight includes boundary, excludes previous day';
 update bookings set paid_at=now() where id in(select booking_id from ledger_cases where name in ('exact','short'));
 update venues set status='draft' where id=v;
 update courts set is_active=false where venue_id=v;
 assert (get_owner_stats(v,today,today)->'summary'->>'revenue')::bigint=400000,'deactivation cannot erase money';
 perform set_config('request.jwt.claim.sub','e1030000-0000-4000-8000-000000000004',true);
 a:=get_admin_stats(today,today);
 assert (a->'summary'->>'revenue')::bigint >= 400000;
 assert exists(select 1 from jsonb_array_elements(a->'venues') x where x->>'name'='Booking input rollback' and (x->>'revenue')::bigint=400000),'admin includes inactive venue revenue';
 assert jsonb_array_length(get_admin_period_stats(7)->'daily')=7;
 update venues set images=array['rollback/1.webp','rollback/2.webp','rollback/3.webp'],status='active' where id=v;
 update courts set is_active=true where venue_id=v;
end $$;
-- Historical partial deposits count the paid amount, never the full booking price.
insert into bookings(id,code,court_id,user_id,starts_at,ends_at,total_amount,deposit_amount,status,paid_at,customer_phone)
values('e1030000-0000-4000-8000-000000000800','SANHST234','e1030000-0000-4000-8000-000000000060','e1030000-0000-4000-8000-000000000003',now()+interval '18 days',now()+interval '18 days 1 hour',100000,30000,'completed',now(),'0900000003');
insert into payments(booking_id,amount,ref_code,status,paid_at)
values('e1030000-0000-4000-8000-000000000800',30000,'SANHST234','pending',null);
select set_config('request.jwt.claim.sub','e1030000-0000-4000-8000-000000000001',true);
do $$ declare today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;begin
 assert (get_owner_stats('e1030000-0000-4000-8000-000000000010',today,today)->'summary'->>'revenue')::bigint=400000,'booking status and timestamp without paid payment are insufficient';
 update payments set status='paid',paid_at=now() where booking_id='e1030000-0000-4000-8000-000000000800';
 assert (get_owner_stats('e1030000-0000-4000-8000-000000000010',today,today)->'summary'->>'revenue')::bigint=430000;
end $$;
-- Pagination only includes receipts allocated to actual website orders.
do $$ declare n int;b bookings;begin
 select * into b from bookings where id=(select booking_id from ledger_cases where name='over');
 for n in 1..35 loop perform process_incoming_transfer(array[b.code],10,(970000+n)::text,'{}',null,'MBBank','1234567890');end loop;
end $$;
select set_config('test.received_amount',(select sum(amount::bigint)::text from incoming_transfers where receiver_owner_id='e1030000-0000-4000-8000-000000000001' and source in ('booking','tournament','subscription') and expected_amount is not null),true);
select set_config('test.personal_transfer',(select id::text from incoming_transfers where bank_tx_id='940001'),true);
select set_config('request.jwt.claim.sub','e1030000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare r jsonb;t jsonb;id uuid;stamp timestamptz;note_id uuid:=gen_random_uuid();begin
 assert not has_function_privilege('authenticated','process_incoming_transfer(text[],int,text,jsonb,uuid,text,text)','EXECUTE');
 assert not has_table_privilege('authenticated','incoming_transfers','SELECT');
 assert not has_table_privilege('anon','incoming_transfers','SELECT');
 assert not has_table_privilege('authenticated','incoming_transfer_notes','INSERT');
 assert not has_function_privilege('anon','get_incoming_transfer_page(text,text,integer)','EXECUTE');
 assert not has_function_privilege('authenticated','booking_revenue_entries(uuid,date,date)','EXECUTE');
 assert not has_function_privilege('authenticated','website_booking_stats(uuid,date,date)','EXECUTE');
 r:=get_incoming_transfer_page('', 'all',1);assert jsonb_array_length(r->'rows')=30 and (r->>'pages')::int>1;
 assert r->>'received_amount'=current_setting('test.received_amount'),'ledger total excludes personal, ambiguous, unknown and wrong-receiver receipts';
 assert get_incoming_transfer_page('940001','all',1)->>'total'='0','personal transfers hidden even by exact transaction search';
 assert get_incoming_transfer_page('940002','all',1)->>'total'='0','ambiguous receipts excluded';
 assert get_incoming_transfer_page('940003','all',1)->>'total'='0','invented SAN code excluded';
 begin perform note_incoming_transfer(current_setting('test.personal_transfer')::uuid,gen_random_uuid(),'Cannot annotate a private personal transfer.',now());raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'TRANSFER_NOT_FOUND' then raise;end if;end;
 assert not (r->'rows'->0 ? 'raw') and not (r->'rows'->0 ? 'result');
 assert not exists(select 1 from jsonb_array_elements(r->'rows') x where x->>'account_number'='9876543210');
 t:=r->'rows'->0;id:=(t->>'id')::uuid;stamp:=(t->>'updated_at')::timestamptz;
 perform note_incoming_transfer(id,note_id,'Checked bank statement; contact sender.',stamp);
 perform note_incoming_transfer(id,note_id,'Checked bank statement; contact sender.',stamp);
 begin perform note_incoming_transfer(id,note_id,'Different retry text.',stamp);raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'NOTE_CONFLICT' then raise;end if;end;
 begin perform note_incoming_transfer(id,gen_random_uuid(),'Stale second note is not saved.',stamp);raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'TRANSFER_CHANGED' then raise;end if;end;
 r:=get_incoming_transfer_page(t->>'bank_tx_id','review',1);assert (r->>'total')::int=1;
 assert jsonb_array_length(r->'rows'->0->'notes')=1 and (r->'rows'->0->>'needs_review')::boolean;
 r:=get_incoming_transfer_page('%','all',1);assert (r->>'total')::int=0;
 r:=get_incoming_transfer_page('','all',999);assert r->>'page'=r->>'pages';
 perform set_config('test.transfer',id::text,true);
end $$;
reset role;
select set_config('request.jwt.claim.sub','e1030000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 assert (get_incoming_transfer_page('','all',1)->>'total')::int=0,'personal transfer hidden from its receiver as well';
 begin perform get_owner_stats('e1030000-0000-4000-8000-000000000010',current_date,current_date);raise exception 'CHECK_FAILED';exception when insufficient_privilege then null;end;
 begin perform get_admin_period_stats(30);raise exception 'CHECK_FAILED';exception when insufficient_privilege then null;end;
 begin perform note_incoming_transfer(current_setting('test.transfer')::uuid,gen_random_uuid(),'Unauthorized note attempt.',now());raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'TRANSFER_NOT_FOUND' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','e1030000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $$ begin
 assert (get_incoming_transfer_page('910006','all',1)->>'total')::int=0,'wrong receiver is not website income';
 assert (get_incoming_transfer_page('940001','all',1)->>'total')::int=0,'admin cannot see personal transfers either';
end $$;
reset role;
update profiles set banned_until='infinity' where id='e1030000-0000-4000-8000-000000000004';
set local role authenticated;
do $$ begin
 begin perform get_incoming_transfer_page();raise exception 'CHECK_FAILED';exception when insufficient_privilege then assert sqlerrm='FORBIDDEN';end;
end $$;
reset role;
select 'OK: booking-only paid revenue, Vietnam receipt dates, partial deposits, refunds, retained deposits, inactive venues, private personal receipts/totals/search/notes/notifications, cross-flow claims and bounded owner/admin projections.';
rollback;
