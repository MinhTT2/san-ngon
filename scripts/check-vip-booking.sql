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
select id, '{0,1,2,3,4,5,6}'::int[], '05:00'::time, '23:00'::time, 100505
from public.courts where venue_id = 'e0900000-0000-4000-8000-000000000010';


insert into auth.users(id) values ('e0900000-0000-4000-8000-000000000003');
update profiles set role='admin' where id='e0900000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub','e0900000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$
begin
  assert not has_table_privilege('authenticated','public.vip_purchases','UPDATE'),'no browser approval';
  assert not has_table_privilege('authenticated','public.vip_purchases','INSERT'),'no forged purchase';
  assert not has_table_privilege('authenticated','public.user_vip_memberships','INSERT'), 'no self promotion';
  assert not has_table_privilege('authenticated','public.user_vip_memberships','UPDATE'), 'no self update';
  assert not has_table_privilege('authenticated','public.user_vip_memberships','DELETE'), 'no self delete';
  assert not has_function_privilege('anon','public.get_booking_quote(uuid,timestamptz,timestamptz)','EXECUTE'), 'anonymous quote denied';
  assert not has_function_privilege('authenticated','public.booking_vip_discount(uuid,int)','EXECUTE'), 'private helper';
  begin
    perform admin_set_user_vip(auth.uid(),true);
    raise exception 'CHECK_FAILED self promotion';
  exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
end $$;
reset role;

do $$
declare
  player uuid:='e0900000-0000-4000-8000-000000000002';
  admin_id uuid:='e0900000-0000-4000-8000-000000000003';
  court uuid:='e0900000-0000-4000-8000-000000000060';
  start_at timestamptz;
  q jsonb; regular bookings; vip bookings; retry bookings;
  request_id uuid:=gen_random_uuid();
  purchase vip_purchases; renewal vip_purchases; before_until timestamptz;
begin
  select min(a.starts_at) into start_at from get_venue_availability('e0900000-0000-4000-8000-000000000010',
    (now() at time zone 'Asia/Ho_Chi_Minh')::date+1) a where a.court_id=court and a.is_available;
  assert start_at is not null,'fixture slots';
  perform set_config('request.jwt.claim.sub',player::text,true);
  q:=get_booking_quote(court,start_at,start_at+interval '1 hour');
  assert (q->>'total_amount')::int=100505 and (q->>'vip_discount_amount')::int=0,'regular quote';
  regular:=create_booking(court,start_at,start_at+interval '1 hour','Regular','0900000002');
  assert regular.total_amount=100505 and regular.original_amount=100505 and regular.vip_discount_amount=0,'regular booking';
  perform cancel_booking(regular.code,true);

  purchase:=create_vip_purchase();
  assert purchase.amount=49000 and purchase.status='awaiting_payment','fixed VIP price';
  assert purchase.account_name='NGUYEN DANG NGUYEN' and purchase.account_number='0691920022005','receiver';
  assert (create_vip_purchase()).id=purchase.id,'one open request and retry';
  assert not (get_my_vip()->>'active')::boolean,'creating request does not activate';
  perform submit_vip_purchase(purchase.id);
  perform submit_vip_purchase(purchase.id);
  assert (select review_due_at=submitted_at+interval '30 minutes' from vip_purchases where id=purchase.id),'30 minute review SLA';
  assert not (get_my_vip()->>'active')::boolean,'claiming payment does not activate';
  begin
    perform review_vip_purchase(purchase.id,true,'990002501');
    raise exception 'CHECK_FAILED player approved';
  exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  begin
    perform admin_set_user_vip(player,true);
    raise exception 'CHECK_FAILED unpaid admin grant';
  exception when raise_exception then if sqlerrm<>'VIP_PAYMENT_REQUIRED' then raise; end if; end;
  begin
    perform review_vip_purchase(purchase.id,true,'0990002501');
    raise exception 'CHECK_FAILED noncanonical transaction';
  exception when raise_exception then if sqlerrm<>'VIP_TRANSACTION_REQUIRED' then raise; end if; end;
  perform review_vip_purchase(purchase.id,true,'990002501');
  perform review_vip_purchase(purchase.id,true,'990002501');
  assert (select paid_until=((now() at time zone 'Asia/Ho_Chi_Minh')+interval '1 month') at time zone 'Asia/Ho_Chi_Minh' from user_vip_memberships where user_id=player),'one calendar month and idempotent review';
  assert exists(select 1 from jsonb_array_elements(admin_list_users('','all','all',1,'newest')->'users') r where r->>'id'=player::text and (r->>'is_vip')::boolean),'admin list VIP';
  perform set_config('request.jwt.claim.sub',player::text,true);
  q:=get_booking_quote(court,start_at,start_at+interval '1 hour');
  assert (q->>'total_amount')::int=90455 and (q->>'vip_discount_amount')::int=10050,'whole VND discount';
  vip:=create_booking_once(request_id,court,start_at,start_at+interval '1 hour','VIP','0900000002');
  assert vip.total_amount=90455 and vip.deposit_amount=90455 and vip.original_amount=100505 and vip.vip_discount_amount=10050,'VIP snapshot';
  assert (select amount=90455 from payments where booking_id=vip.id),'payment amount';
  retry:=create_booking_once(request_id,court,start_at,start_at+interval '1 hour','VIP','0900000002');
  assert retry.id=vip.id,'retry idempotent';

  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  select paid_until into before_until from user_vip_memberships where user_id=player;
  perform set_config('request.jwt.claim.sub',player::text,true);
  renewal:=create_vip_purchase();
  perform submit_vip_purchase(renewal.id);
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  begin
    perform review_vip_purchase(renewal.id,true,'990002501');
    raise exception 'CHECK_FAILED reused transfer';
  exception when raise_exception then if sqlerrm<>'VIP_TRANSACTION_USED' then raise; end if; end;
  assert (select paid_until=before_until from user_vip_memberships where user_id=player),'failed review preserves membership';
  perform review_vip_purchase(renewal.id,true,'990002502');
  assert (select paid_until=((before_until at time zone 'Asia/Ho_Chi_Minh')+interval '1 month') at time zone 'Asia/Ho_Chi_Minh' from user_vip_memberships where user_id=player),'early renewal extends old expiry';
  perform admin_set_user_vip(player,false);
  assert (select total_amount=90455 and vip_discount_amount=10050 from bookings where id=vip.id),'membership change preserves price';
  assert (select total_amount=100505 and vip_discount_amount=0 from bookings where id=regular.id),'old booking unchanged';
  begin
    update bookings set original_amount=100506,total_amount=90456 where id=vip.id;
    raise exception 'CHECK_FAILED mutable price';
  exception when raise_exception then if sqlerrm<>'BOOKING_PRICE_IMMUTABLE' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',player::text,true);
  perform cancel_booking(vip.code,true);
  q:=get_booking_quote(court,start_at,start_at+interval '1 hour');
  assert (q->>'total_amount')::int=100505,'VIP revoked';
  assert (select count(*)=2 from payments where booking_id in (regular.id,vip.id)),'one payment per booking';
  update user_vip_memberships set enabled=true,paid_until=now()-interval '1 second' where user_id=player;
  q:=get_booking_quote(court,start_at,start_at+interval '1 hour');
  assert (q->>'total_amount')::int=100505,'expired VIP no discount without cron';
  renewal:=create_vip_purchase();
  perform submit_vip_purchase(renewal.id);
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  perform review_vip_purchase(renewal.id,false,null,'Chưa nhận được khoản chuyển đúng mã.');
  assert (select status='rejected' from vip_purchases where id=renewal.id),'rejection recorded';
  assert (select paid_until<now() from user_vip_memberships where user_id=player),'rejection does not activate';
  assert exists(select 1 from notifications where vip_purchase_id=purchase.id and user_id=player),'approval notification';
end $$;
rollback;
