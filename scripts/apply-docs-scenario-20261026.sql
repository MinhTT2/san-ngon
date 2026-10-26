-- One-off live presentation scenario requested in Google Docs on 26/10/2026.
-- Back up privately first. Trusted SQL administration only. Defaults to ROLLBACK.
-- Keep outside migrations; to apply, replace only the last ROLLBACK with COMMIT.
begin isolation level repeatable read;
set local lock_timeout='5s';
set local statement_timeout='45s';
select pg_advisory_xact_lock(2026102601);
select set_config('request.jwt.claim.sub',(select id::text from profiles where role='admin'
 and (banned_until is null or banned_until<=now()) order by created_at limit 1),true);

create temp table replaced on commit drop as
select * from bookings where code=any(array[
'SAN553XWP','SANA5AWH3','SANAD3ARQ','SANAT9MFR','SANAVCPDP','SANFV8N6Y','SANGK8TRX',
'SANHYYR9W','SANMQFVRW','SANNCFNMY','SANPM58YR','SANPPZGHJ','SANVYTBSX','SANZ7TSRA',
'SAN8R4SLE','SAN9DRQ59','SAN9HAUXX','SAN9Y9NNV','SANEU9RDT','SANL8DEPW','SANYU3G8M']);
create temp table original_other_bookings on commit drop as
select id,to_jsonb(b) original from bookings b where id not in(select id from replaced);
create temp table original_payments on commit drop as select id,to_jsonb(p) original from payments p;
create temp table original_activity on commit drop as select user_id,to_jsonb(a) original from user_activity_totals a;
create temp table original_profiles on commit drop as select id,to_jsonb(p) original from profiles p;
create temp table original_venues on commit drop as select id,to_jsonb(v) original from venues v;
create temp table original_courts on commit drop as select id,to_jsonb(c) original from courts c;
create temp table original_counts on commit drop as select
 (select count(*) from sepay_events) events,(select count(*) from incoming_transfers) transfers,
 (select count(*) from sepay_transfer_claims) claims,(select count(*) from notifications) notices;

create temp table owner_dates(owner_id uuid primary key,day date) on commit drop;
insert into owner_dates values
 ('8783fe39-97a9-45b0-ac95-c9043a9d657b','2026-10-12'),
 ('b5ce3901-856c-40a9-9cee-609d48d0a491','2026-10-13'),
 ('8222466c-bbd7-46f3-904c-8a99959bca52','2026-10-14'),
 ('f608931f-e884-4f80-a84b-f481bd73ae05','2026-10-16'),
 ('436a9a62-4cc4-4f78-8396-2e1af4d5cd73','2026-10-18');

do $$ declare r record;refs bigint;begin
 if not is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 if (select count(*) from replaced)<>21 or exists(select 1 from replaced
  where status<>'completed' or paid_at is not null or coalesce(refund_status::text,'none')<>'none'
   or (starts_at at time zone 'Asia/Ho_Chi_Minh')::date<>date '2026-10-20'
   or created_at not in('2026-10-20 08:00+07'::timestamptz,'2026-10-20 09:00+07'::timestamptz))
 then raise exception 'REPLACEMENT_COHORT_CHANGED';end if;
 if exists(select 1 from bookings where note like '[docs-20261026]%') then raise exception 'SCENARIO_ALREADY_APPLIED';end if;
 -- Refuse deletions with ANY dependency, including unpaid intents/notifications.
 for r in select conrelid::regclass relation,a.attname from pg_constraint c
  join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
  where c.contype='f' and c.confrelid='public.bookings'::regclass loop
  execute format('select count(*) from %s where %I in(select id from replaced)',r.relation,r.attname) into refs;
  if refs<>0 then raise exception 'BOOKING_HAS_DEPENDENCIES: %',r.relation;end if;
 end loop;
 if (select count(*) from profiles p join owner_dates d on d.owner_id=p.id
  where p.role='owner' and p.owner_application_status='active')<>5
  or (select count(*) from venues v join owner_dates d on d.owner_id=v.owner_id)<>5
  or (select count(*) from venues where status='active')<>8 then raise exception 'OWNER_VENUE_COHORT_CHANGED';end if;
 perform 1 from bookings where id in(select id from replaced) for update;
 perform 1 from profiles where id in(select owner_id from owner_dates) for update;
 perform 1 from venues where owner_id in(select owner_id from owner_dates) for update;
end $$;

-- Only the requested submission and venue display dates change. Auth signup stays factual.
update profiles p set owner_application_submitted_at=
 (d.day+(p.owner_application_submitted_at at time zone 'Asia/Ho_Chi_Minh')::time)
 at time zone 'Asia/Ho_Chi_Minh' from owner_dates d where p.id=d.owner_id;
update venues v set created_at=
 ((d.day+(p.owner_application_submitted_at at time zone 'Asia/Ho_Chi_Minh')::time)+interval '30 minutes')
 at time zone 'Asia/Ho_Chi_Minh'
 from owner_dates d join profiles p on p.id=d.owner_id where v.owner_id=d.owner_id;

create temp table scenario_venues on commit drop as
select v.*,row_number() over(order by v.slug)-1 as venue_index from venues v where status='active';
create temp table scenario_plan(
 n int primary key,id uuid unique,court_id uuid,venue_id uuid,user_id uuid,starts_at timestamptz,ends_at timestamptz,
 created_at timestamptz,total_amount int
) on commit drop;

-- Every venue/day pair is unique; 44 rows give 5-6 per venue and 6-7 per day.
do $$ declare i int;v record;slot record;player uuid;play_day date;booked_local timestamp;begin
 for i in 0..43 loop
  select * into strict v from scenario_venues where venue_index=i%8;
  play_day:=date '2026-10-19'+i%7;
  select c.id court_id,g.starts_local,r.price_per_hour into slot
  from courts c
  cross join lateral generate_series(play_day+coalesce(c.open_time,v.open_time),
   play_day+coalesce(c.close_time,v.close_time)-interval '1 hour',interval '1 hour')g(starts_local)
  cross join lateral(select pr.price_per_hour from price_rules pr where pr.court_id=c.id
   and extract(dow from g.starts_local)::int=any(pr.days) and pr.start_time<=g.starts_local::time
   and pr.end_time>=(g.starts_local+interval '1 hour')::time order by pr.priority desc,pr.id limit 1)r
  where c.venue_id=v.id and c.is_active and r.price_per_hour>0
   and not exists(select 1 from bookings b where b.court_id=c.id and b.id not in(select id from replaced)
    and b.status<>'cancelled' and tstzrange(b.starts_at,b.ends_at)&&
     tstzrange(g.starts_local at time zone 'Asia/Ho_Chi_Minh',(g.starts_local+interval '1 hour') at time zone 'Asia/Ho_Chi_Minh'))
   and not exists(select 1 from court_closures x where x.court_id=c.id and tstzrange(x.starts_at,x.ends_at)&&
     tstzrange(g.starts_local at time zone 'Asia/Ho_Chi_Minh',(g.starts_local+interval '1 hour') at time zone 'Asia/Ho_Chi_Minh'))
  order by md5(c.id::text||g.starts_local::text||'docs-20261026') limit 1;
  if slot.court_id is null then raise exception 'NO_AVAILABLE_SLOT: %',i;end if;
  booked_local:=case when i%5=0 then slot.starts_local-interval '2 hours'
   else (play_day-1)+time '09:00'+make_interval(hours=>i%9,mins=>i%59) end;
  select p.id into player from profiles p join auth.users u on u.id=p.id
  where p.role='player' and p.full_name is not null and p.phone ~ '^0[35789][0-9]{8}$'
   and (p.banned_until is null or p.banned_until<=now())
   and p.created_at<(booked_local at time zone 'Asia/Ho_Chi_Minh')-interval '10 minutes'
   and not exists(select 1 from bookings b where b.user_id=p.id and b.id not in(select id from replaced)
    and b.status<>'cancelled' and tstzrange(b.starts_at,b.ends_at)&&
     tstzrange(slot.starts_local at time zone 'Asia/Ho_Chi_Minh',(slot.starts_local+interval '1 hour') at time zone 'Asia/Ho_Chi_Minh'))
   and not exists(select 1 from scenario_plan s where s.user_id=p.id and tstzrange(s.starts_at,s.ends_at)&&
     tstzrange(slot.starts_local at time zone 'Asia/Ho_Chi_Minh',(slot.starts_local+interval '1 hour') at time zone 'Asia/Ho_Chi_Minh'))
  order by (select count(*) from scenario_plan s where s.user_id=p.id),
   case when exists(select 1 from bookings b where b.user_id=p.id) then 0 else 1 end,
   md5(p.id::text||'docs-20261026') limit 1;
  if player is null then raise exception 'NO_ELIGIBLE_PLAYER: %',i;end if;
  insert into scenario_plan values(i,md5('docs-20261026:'||i)::uuid,slot.court_id,v.id,player,
   slot.starts_local at time zone 'Asia/Ho_Chi_Minh',(slot.starts_local+interval '1 hour') at time zone 'Asia/Ho_Chi_Minh',
   booked_local at time zone 'Asia/Ho_Chi_Minh',slot.price_per_hour);
 end loop;
end $$;

delete from bookings where id in(select id from replaced);
insert into bookings(id,code,court_id,user_id,starts_at,ends_at,total_amount,deposit_amount,status,refund_status,
 customer_name,customer_phone,note,created_at,expires_at,paid_at)
select s.id,'SAN'||gen_booking_code(),s.court_id,s.user_id,s.starts_at,s.ends_at,s.total_amount,s.total_amount,
 'completed','none',p.full_name,p.phone,
 '[docs-20261026] Đơn mô phỏng theo kịch bản, không phải giao dịch ngân hàng',
 s.created_at,s.created_at+interval '15 minutes',s.created_at+make_interval(mins=>2+s.n%7)
from scenario_plan s join profiles p on p.id=s.user_id;

insert into payments(id,booking_id,provider,amount,ref_code,status,raw,created_at,paid_at)
select md5('docs-20261026-payment:'||s.n)::uuid,b.id,'simulation',b.deposit_amount,b.code,'paid',
 jsonb_build_object('simulation',true,'batch','docs-20261026','bank_transfer',false),
 b.created_at,b.paid_at from scenario_plan s join bookings b on b.id=s.id;

-- Private presentation values. Never overwrite measured usage, leases or activity times.
insert into user_activity_simulations(user_id,seconds,batch)
select distinct user_id,300+(('x'||substr(md5(user_id::text||'docs-20261026'),1,8))::bit(32)::bigint%301)::int,
 'docs-20261026' from bookings
on conflict(user_id) do update set seconds=excluded.seconds,batch=excluded.batch;

do $$ declare report jsonb;begin
 assert (select count(*) from bookings where note like '[docs-20261026]%')=44,'exactly 44 scenario bookings';
 assert (select count(distinct venue_id) from scenario_plan)=8,'eight venues';
 assert (select count(*) from scenario_plan where
  (starts_at at time zone 'Asia/Ho_Chi_Minh')::date-(created_at at time zone 'Asia/Ho_Chi_Minh')::date=1)=35,'35 bookings one day ahead';
 assert not exists(select 1 from scenario_plan s join bookings b on b.id=s.id join profiles p on p.id=b.user_id
  where b.created_at<=p.created_at or b.paid_at<=b.created_at or b.paid_at>=b.expires_at or b.expires_at>=b.starts_at
   or b.customer_name is distinct from p.full_name or b.customer_phone is distinct from p.phone),'valid account/payment/hold chronology';
 assert not exists(select 1 from scenario_plan a join scenario_plan b on a.n<b.n
  and (a.court_id=b.court_id or a.user_id=b.user_id) and tstzrange(a.starts_at,a.ends_at)&&tstzrange(b.starts_at,b.ends_at)),'no player/court collisions';
 assert not exists(select 1 from original_other_bookings o full join
  (select id,to_jsonb(b) original from bookings b where id not in(select id from scenario_plan))n using(id)
  where o.original is distinct from n.original),'all other bookings unchanged';
 assert not exists(select 1 from original_payments o full join
  (select id,to_jsonb(p) original from payments p where booking_id not in(select id from scenario_plan))n using(id)
  where o.original is distinct from n.original),'existing payments unchanged';
 assert not exists(select 1 from original_activity o full join
  (select user_id,to_jsonb(a) original from user_activity_totals a)n using(user_id)
  where o.original is distinct from n.original),'measured usage unchanged';
 assert not exists(select 1 from original_courts o full join
  (select id,to_jsonb(c) original from courts c)n using(id) where o.original is distinct from n.original),'courts unchanged';
 assert not exists(select 1 from original_profiles o join profiles p on p.id=o.id
  where o.original-'owner_application_submitted_at' is distinct from to_jsonb(p)-'owner_application_submitted_at'
   or (p.id not in(select owner_id from owner_dates) and o.original is distinct from to_jsonb(p))),'only five submission dates changed';
 assert not exists(select 1 from original_venues o join venues v on v.id=o.id
  where o.original-'created_at' is distinct from to_jsonb(v)-'created_at'
   or (v.owner_id not in(select owner_id from owner_dates) and o.original is distinct from to_jsonb(v))),'only five venue dates changed';
 assert (select count(*) from sepay_events)=(select events from original_counts)
  and (select count(*) from incoming_transfers)=(select transfers from original_counts)
  and (select count(*) from sepay_transfer_claims)=(select claims from original_counts)
  and (select count(*) from notifications)=(select notices from original_counts),'bank ledgers and notifications unchanged';
 assert not exists(select 1 from bookings b left join user_activity_simulations s on s.user_id=b.user_id
  where s.seconds is null or s.seconds not between 300 and 600),'all bookers have separate 5-10 minute simulations';
 report:=get_admin_stats('2026-10-19','2026-10-25');
 assert (select count(*) from payments where booking_id in(select id from scenario_plan) and status='paid' and provider='simulation' and bank_tx_id is null)=44,'44 simulated payments';
 assert (report#>>'{summary,paid_bookings}')::int=(select count(*) from scenario_plan where (created_at at time zone 'Asia/Ho_Chi_Minh')::date>=date '2026-10-19'),'receipt count follows payment date';
 assert (report#>>'{summary,revenue}')::bigint=(select sum(total_amount) from scenario_plan where (created_at at time zone 'Asia/Ho_Chi_Minh')::date>=date '2026-10-19'),'SQL revenue matches scenario receipt dates';
 assert (select sum((d->>'revenue')::bigint) from jsonb_array_elements(report->'daily')d)=
  (report#>>'{summary,revenue}')::bigint,'daily chart matches total';
 assert (select sum((v->>'revenue')::bigint) from jsonb_array_elements(report->'venues')v)=
  (report#>>'{summary,revenue}')::bigint,'venue ranking matches total';
end $$;

select jsonb_build_object('replaced',21,'scenario_bookings',44,'day_before',35,
 'scenario_amount',(select sum(total_amount) from scenario_plan),
 'summary',get_admin_stats('2026-10-19','2026-10-25')->'summary',
 'daily',(select jsonb_agg(x) from(select (s.starts_at at time zone 'Asia/Ho_Chi_Minh')::date play_date,
  count(*) bookings from scenario_plan s group by 1 order by 1)x),
 'venues',(select jsonb_agg(x) from(select v.slug,count(*) bookings,sum(s.total_amount) amount from scenario_plan s
  join venues v on v.id=s.venue_id group by v.slug order by v.slug)x),
 'simulation_usage_accounts',(select count(*) from user_activity_simulations where batch='docs-20261026')) result;
rollback;
