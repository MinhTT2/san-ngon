-- User-requested paid-booking simulation, 19/10/2026. NOT a bank receipt.
-- Trusted SQL administration only; take a private booking/payment backup first.
-- Defaults to ROLLBACK. After reviewing its output, change only the final
-- ROLLBACK to COMMIT. Never register/run this as an automatic migration.
begin isolation level repeatable read;
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(2026101903);
select set_config('request.jwt.claim.sub',(select p.id::text from profiles p
 join auth.users u on u.id=p.id where p.role='admin' and u.email not like '%@example.invalid'
 and (p.banned_until is null or p.banned_until<=now()) order by p.created_at limit 1),true);

create temp table simulation_original on commit drop as
 select b.* from bookings b
 where b.note='Docs 2026-10-19 · Dữ liệu demo, không phải giao dịch ngân hàng';
create temp table simulation_other_bookings on commit drop as
 select id,to_jsonb(b) original from bookings b where id not in(select id from simulation_original);
create temp table simulation_original_payments on commit drop as
 select id,to_jsonb(p) original from payments p;
create temp table simulation_counts on commit drop as
 select (select count(*) from sepay_events) sepay,
 (select count(*) from incoming_transfers) incoming,
 (select count(*) from sepay_transfer_claims) claims,
 (select count(*) from notifications) notices;

do $$ begin
 if not is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 if (select count(*) from simulation_original)<>17
  or (select sum(total_amount) from simulation_original)<>3430000
  or exists(select 1 from simulation_original where status<>'completed'
   or paid_at is not null or refund_status::text<>'none' or deposit_amount<>total_amount
   or created_at+interval '5 minutes'>=expires_at or expires_at>=starts_at
   or (starts_at at time zone 'Asia/Ho_Chi_Minh')::date not between date '2026-10-12' and date '2026-10-18'
   or (created_at at time zone 'Asia/Ho_Chi_Minh')::date<date '2026-10-12')
  or exists(select 1 from payments where booking_id in(select id from simulation_original))
  or exists(select 1 from sepay_events where booking_id in(select id from simulation_original))
  or exists(select 1 from incoming_transfers where booking_id in(select id from simulation_original))
 then raise exception 'SIMULATION_COHORT_CHANGED';end if;
 perform 1 from bookings where id in(select id from simulation_original) for update;
end $$;

-- Explicit simulation provenance, no bank transaction ID and no webhook call.
-- The existing revenue RPC reads these paid rows without changing its rules.
insert into payments(booking_id,provider,amount,ref_code,bank_tx_id,status,raw,created_at,paid_at)
 select id,'simulation',deposit_amount,code,null,'paid',
 jsonb_build_object('simulation',true,'batch','docs-2026-10-19-paid-simulation',
  'source','user-requested scenario','bank_transfer',false),
 created_at,created_at+interval '5 minutes' from simulation_original;
update bookings b set paid_at=o.created_at+interval '5 minutes'
 from simulation_original o where b.id=o.id;

do $$ declare report jsonb;begin
 -- All booking fields except paid_at (including note/snapshots) stay identical.
 assert not exists(select 1 from simulation_original o join bookings b on b.id=o.id
  where to_jsonb(o)-'paid_at' is distinct from to_jsonb(b)-'paid_at'), 'booking details unchanged';
 assert (select count(*) from bookings where id in(select id from simulation_original))=17, 'all fixtures retained';
 assert not exists(select 1 from simulation_other_bookings o full join
  (select id,to_jsonb(b) original from bookings b where id not in(select id from simulation_original)) n using(id)
  where o.original is distinct from n.original), 'unrelated bookings unchanged';
 assert not exists(select 1 from simulation_original_payments o full join
  (select id,to_jsonb(p) original from payments p where booking_id not in(select id from simulation_original)) n using(id)
  where o.original is distinct from n.original), 'existing payments unchanged';
 assert (select count(*) from payments where booking_id in(select id from simulation_original))=17, 'one simulated payment per booking';
 assert not exists(select 1 from payments p join bookings b on b.id=p.booking_id
  where b.id in(select id from simulation_original) and
   (p.provider<>'simulation' or p.bank_tx_id is not null or p.raw->>'simulation'<>'true'
    or p.raw->>'bank_transfer'<>'false' or p.status<>'paid' or p.amount<>b.deposit_amount
    or p.ref_code<>b.code or p.paid_at is distinct from b.paid_at
    or p.paid_at<=b.created_at or p.paid_at>=b.expires_at)), 'simulation provenance and dates';
 assert (select count(*) from sepay_events)=(select sepay from simulation_counts)
  and (select count(*) from incoming_transfers)=(select incoming from simulation_counts)
  and (select count(*) from sepay_transfer_claims)=(select claims from simulation_counts)
  and (select count(*) from notifications)=(select notices from simulation_counts), 'bank ledgers and notifications unchanged';
 report:=get_admin_stats('2026-10-12','2026-10-18');
 assert (report#>>'{summary,revenue}')::bigint=3430000, 'simulated revenue totals 3430000';
 assert (report#>>'{summary,paid_bookings}')::int=17, '17 paid bookings in report';
 assert (report#>>'{summary,booked_hours}')::numeric=17, 'playing activity unchanged';
 assert (select sum((d->>'revenue')::bigint) from jsonb_array_elements(report->'daily')d)=3430000, 'daily chart matches total';
 assert (select sum((v->>'revenue')::bigint) from jsonb_array_elements(report->'venues')v)=3430000, 'venue ranking matches total';
end $$;

-- Review output contains only totals, dates and venue labels; no player data.
select jsonb_build_object('simulation',true,
 'summary',get_admin_stats('2026-10-12','2026-10-18')->'summary',
 'daily',get_admin_stats('2026-10-12','2026-10-18')->'daily',
 'venues',get_admin_stats('2026-10-12','2026-10-18')->'venues'
) as simulation_result;
rollback;
