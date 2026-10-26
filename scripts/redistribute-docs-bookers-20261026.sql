-- One completed simulation per account identified in the user's screenshot.
-- Trusted SQL only, with a private backup first. Defaults to ROLLBACK.
-- To apply, replace only the final ROLLBACK with COMMIT. Never change real payments.
begin isolation level repeatable read;
set local lock_timeout='5s';
set local statement_timeout='45s';
select pg_advisory_xact_lock(2026102603);
select set_config('request.jwt.claim.sub',(select id::text from profiles where role='admin'
 and (banned_until is null or banned_until<=now()) order by created_at limit 1),true);
create temp table original_bookings on commit drop as select id,to_jsonb(b) original from bookings b;
create temp table original_payments on commit drop as select id,to_jsonb(p) original from payments p;
create temp table original_profiles on commit drop as select id,to_jsonb(p) original from profiles p;
create temp table original_usage on commit drop as select user_id,to_jsonb(a) original from user_activity_totals a;
create temp table original_simulated_usage on commit drop as select user_id,to_jsonb(s) original from user_activity_simulations s;
create temp table original_report on commit drop as select get_admin_stats('2026-10-01','2026-10-31') report;
create temp table original_counts on commit drop as select
 (select count(*) from notifications) notifications,
 (select count(*) from sepay_events) events,
 (select count(*) from incoming_transfers) transfers,
 (select count(*) from sepay_transfer_claims) claims;
create temp table target_users(user_id uuid primary key,expected_name text) on commit drop;
insert into target_users values
 ('894c2db4-c105-4bda-acd0-00a1ed2ea328','Giang Nguyễn'),
 ('b01dace6-6d88-4144-b98c-ae5b3ccc1c0f','Hùng Trần'),
 ('8085184e-79a0-4ee1-a883-87366fda82fa','Khánh đẹp trai'),
 ('047d730f-dbd8-48e5-8d35-5c6f28d5ef94','Vũ'),
 ('99785df6-6e32-4f76-a69d-1c1d5ddb6d31','Đỗ Phương'),
 ('6957b252-144d-4605-90a0-a64ca2c46c8f','Hải Nam Nguyễn');
create temp table reassignment(booking_id uuid primary key,target_user_id uuid unique) on commit drop;
do $$ declare target record;chosen uuid;dependency record;refs bigint;begin
 if not is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 if exists(select 1 from bookings where note like '%[docs-bookers-20261026]%') then raise exception 'ALREADY_REDISTRIBUTED';end if;
 if (select count(*) from bookings where note like '[docs-20261026]%')<>44 then raise exception 'SCENARIO_CHANGED';end if;
 if (select count(*) from target_users t join profiles p on p.id=t.user_id join auth.users u on u.id=p.id
   join user_activity_totals a on a.user_id=p.id where p.full_name=t.expected_name and p.role='player'
    and (p.banned_until is null or p.banned_until<=now()) and a.total_seconds>=300)<>6
 then raise exception 'TARGET_ACCOUNTS_CHANGED';end if;
 if exists(select 1 from bookings b join target_users t on t.user_id=b.user_id) then raise exception 'TARGET_ALREADY_HAS_BOOKINGS';end if;
 -- Assign the most recently created account first: it has just one valid slot.
 for target in select p.*,greatest(p.created_at,u.created_at) registered_at
  from target_users t join profiles p on p.id=t.user_id join auth.users u on u.id=p.id
  order by greatest(p.created_at,u.created_at) desc,p.id loop
  select b.id into chosen from bookings b
  where b.note like '[docs-20261026]%' and b.status='completed'
   and b.created_at>target.registered_at
   and not exists(select 1 from reassignment r where r.booking_id=b.id)
   and not exists(select 1 from bookings x where x.user_id=target.id and x.status<>'cancelled'
    and tstzrange(x.starts_at,x.ends_at)&&tstzrange(b.starts_at,b.ends_at))
   and (select count(*) from payments pay where pay.booking_id=b.id)=1
   and exists(select 1 from payments pay where pay.booking_id=b.id and pay.provider='simulation'
    and pay.bank_tx_id is null and pay.status='paid' and pay.raw->>'batch'='docs-20261026')
  order by (select count(*) from bookings x where x.customer_name=b.customer_name
   and not exists(select 1 from reassignment r where r.booking_id=x.id)) desc,b.created_at desc,b.id
  limit 1;
  if chosen is null then raise exception 'NO_ELIGIBLE_SIMULATION_FOR: %',target.full_name;end if;
  insert into reassignment values(chosen,target.id);
 end loop;
 -- Refuse rows linked to any other workflow (notifications, refunds, bank ledgers...).
 for dependency in select conrelid::regclass relation,a.attname from pg_constraint c
  join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
  where c.contype='f' and c.confrelid='public.bookings'::regclass and c.conrelid<>'public.payments'::regclass loop
  execute format('select count(*) from %s where %I in(select booking_id from reassignment)',dependency.relation,dependency.attname) into refs;
  if refs<>0 then raise exception 'DEPENDENT_RECORDS: %',dependency.relation;end if;
 end loop;
 perform 1 from bookings b join reassignment r on r.booking_id=b.id for update of b;
end $$;
update bookings b set user_id=p.id,customer_name=p.full_name,customer_phone=coalesce(p.phone,''),
 note=b.note||'; [docs-bookers-20261026] Phân bổ lại người đặt mô phỏng theo yêu cầu; giữ nguyên thanh toán'
from reassignment r join profiles p on p.id=r.target_user_id where b.id=r.booking_id;
do $$ declare report jsonb;target record;begin
 assert (select count(*) from reassignment)=6,'exactly six reassignments';
 assert (select count(*) from bookings b join target_users t on t.user_id=b.user_id)=6,'one booking per target';
 assert (select count(distinct b.user_id) from bookings b where b.note like '[docs-20261026]%')=44,'forty-four distinct accounts retained';
 assert (select count(*) from bookings b where b.note like '[docs-20261026]%')=44,'forty-four scenario bookings retained';
 assert not exists(select 1 from bookings b join reassignment r on r.booking_id=b.id
  join profiles p on p.id=r.target_user_id join auth.users u on u.id=p.id
  where b.user_id<>p.id or b.customer_name is distinct from p.full_name or b.customer_phone is distinct from coalesce(p.phone,'')
   or b.created_at<=greatest(p.created_at,u.created_at)),'correct contact and chronological identity';
 assert not exists(select 1 from original_bookings o full join bookings b using(id)
  where case when o.id in(select booking_id from reassignment)
   then o.original-array['user_id','customer_name','customer_phone','note'] is distinct from to_jsonb(b)-array['user_id','customer_name','customer_phone','note']
   else o.original is distinct from to_jsonb(b) end),'only four fields of six simulated bookings change';
 assert not exists(select 1 from original_payments o full join payments p using(id) where o.original is distinct from to_jsonb(p)),'all payment rows unchanged';
 assert not exists(select 1 from original_profiles o full join profiles p using(id) where o.original is distinct from to_jsonb(p)),'profiles unchanged';
 assert not exists(select 1 from original_usage o full join user_activity_totals a using(user_id) where o.original is distinct from to_jsonb(a)),'measured usage unchanged';
 assert not exists(select 1 from original_simulated_usage o full join user_activity_simulations s using(user_id) where o.original is distinct from to_jsonb(s)),'simulated usage unchanged';
 assert (select count(*) from notifications)=(select notifications from original_counts)
  and (select count(*) from sepay_events)=(select events from original_counts)
  and (select count(*) from incoming_transfers)=(select transfers from original_counts)
  and (select count(*) from sepay_transfer_claims)=(select claims from original_counts),'no notification or bank workflow changes';
 report:=get_admin_stats('2026-10-01','2026-10-31');
 assert report#>'{summary,revenue}'=(select o.report#>'{summary,revenue}' from original_report o),'receipts unchanged';
 assert report#>'{summary,paid_bookings}'=(select o.report#>'{summary,paid_bookings}' from original_report o),'paid booking count unchanged';
 assert report->'daily'=(select o.report->'daily' from original_report o),'daily charts unchanged';
 assert report->'venues'=(select o.report->'venues' from original_report o),'venue receipts unchanged';
 -- Verify the actual player RPC can see its newly assigned history.
 for target in select * from target_users loop
  perform set_config('request.jwt.claim.sub',target.user_id::text,true);
  report:=search_my_bookings(null,'all',1,null,null);
  assert (report->>'total')::int=1,'player sees exactly one booking';
 end loop;
end $$;
select jsonb_build_object('reassigned',6,'scenario_bookings',44,
 'accounts',(select jsonb_agg(jsonb_build_object('name',p.full_name,'code',b.code,
  'venue',b.venue_name_snapshot,'created_at',b.created_at,'starts_at',b.starts_at))
 from reassignment r join bookings b on b.id=r.booking_id join profiles p on p.id=b.user_id)) result;
rollback;
