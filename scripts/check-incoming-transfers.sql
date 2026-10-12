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
 r:=process_incoming_transfer('{}',12345,'940001','{}',null,b.payment_bank,b.payment_account);assert r->>'reason'='NO_REF_CODE';
 r:=process_incoming_transfer(array[b.code],12345,'940001','{}',null,b.payment_bank,b.payment_account);assert r->>'reason'='PAYMENT_PAYLOAD_CONFLICT','cannot assign unidentified receipt by replay';
 r:=process_incoming_transfer(array[b.code,'PHIABCDEF12'],12345,'940002','{}',null,b.payment_bank,b.payment_account);assert r->>'reason'='AMBIGUOUS_REF_CODE';
 r:=process_incoming_transfer(array['SANZZZ999'],12345,'940003','{}',null,b.payment_bank,b.payment_account);assert r->>'reason'='REF_NOT_FOUND';
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
-- Pagination over 30 rows with tied timestamps, isolated receiver and literal search.
do $$ declare n int;begin for n in 1..35 loop perform process_incoming_transfer('{}',10,(970000+n)::text,'{}',null,'MBBank','1234567890');end loop;end $$;
select set_config('request.jwt.claim.sub','e1030000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare r jsonb;t jsonb;id uuid;stamp timestamptz;note_id uuid:=gen_random_uuid();begin
 assert not has_function_privilege('authenticated','process_incoming_transfer(text[],int,text,jsonb,uuid,text,text)','EXECUTE');
 assert not has_table_privilege('authenticated','incoming_transfers','SELECT');
 assert not has_table_privilege('anon','incoming_transfers','SELECT');
 assert not has_table_privilege('authenticated','incoming_transfer_notes','INSERT');
 assert not has_function_privilege('anon','get_incoming_transfer_page(text,text,integer)','EXECUTE');
 r:=get_incoming_transfer_page('', 'all',1);assert jsonb_array_length(r->'rows')=30 and (r->>'pages')::int>1;
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
 assert (get_incoming_transfer_page('','all',1)->>'total')::int=1,'other owner sees only their receiver ledger, not payments they made';
 assert get_incoming_transfer_page('','all',1)->'rows'->0->>'bank_tx_id'='980001';
 begin perform note_incoming_transfer(current_setting('test.transfer')::uuid,gen_random_uuid(),'Unauthorized note attempt.',now());raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'TRANSFER_NOT_FOUND' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','e1030000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $$ begin assert (get_incoming_transfer_page('910006','all',1)->>'total')::int=1,'admin sees unmatched receiver';end $$;
reset role;
update profiles set banned_until='infinity' where id='e1030000-0000-4000-8000-000000000004';
set local role authenticated;
do $$ begin
 begin perform get_incoming_transfer_page();raise exception 'CHECK_FAILED';exception when insufficient_privilege then assert sqlerrm='FORBIDDEN';end;
end $$;
reset role;
select 'OK: receipt identity, no-code/ambiguous/short/over/late/manual/retry/conflict, fee/tournament/cross-flow claims, bounded private projections and append-only note RPC.';
rollback;
