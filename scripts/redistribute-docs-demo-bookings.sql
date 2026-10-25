-- One-off cleanup explicitly requested on 19/10/2026.
-- Run with trusted SQL administration, after a private backup. Defaults to ROLLBACK.
-- To apply the reviewed plan, replace only the final ROLLBACK with COMMIT.
-- Never run automatically during deploy or register this as a schema migration.
begin isolation level repeatable read;
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(2026101902);
select set_config('request.jwt.claim.sub',(select p.id::text from profiles p join auth.users u on u.id=p.id
 where p.role='admin' and u.email not like '%@example.invalid' and (p.banned_until is null or p.banned_until<=now()) order by p.created_at limit 1),true);

create temp table cleanup_accounts on commit drop as
 select p.id,p.role from profiles p join auth.users u on u.id=p.id
 where p.full_name ilike '%demo%' and u.email like '%@example.invalid';
create temp table original_demo_bookings on commit drop as
 select b.* from bookings b where b.note='Docs 2026-10-19 · Dữ liệu demo, không phải giao dịch ngân hàng';
create temp table original_other_bookings on commit drop as
 select b.id,to_jsonb(b) as original from bookings b where b.id not in(select id from original_demo_bookings);
create temp table original_profiles on commit drop as
 select p.id,to_jsonb(p) as original from profiles p where id not in(select id from cleanup_accounts);
create temp table original_finance on commit drop as
 select (select count(*) from payments) payments,(select count(*) from sepay_events) events,(select count(*) from incoming_transfers) transfers;

-- All destructive operations stop if the inspected fixture cohort has changed.
do $$ declare r record; refs bigint; begin
 if not is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 if (select count(*) from cleanup_accounts)<>7
  or (select count(*) from cleanup_accounts where role='player')<>5
  or (select count(*) from cleanup_accounts where role='owner')<>1
  or (select count(*) from cleanup_accounts where role='admin')<>1 then raise exception 'DEMO_COHORT_CHANGED';end if;
 if (select count(*) from original_demo_bookings)<>17
  or exists(select 1 from original_demo_bookings where status<>'completed' or paid_at is not null or refund_status::text<>'none')
  or exists(select 1 from original_demo_bookings where user_id not in(select id from cleanup_accounts where role='player')) then raise exception 'BOOKING_COHORT_CHANGED';end if;
 -- A delete/reinsert is needed because court/payment snapshots are immutable.
 -- Never bypass a trigger: refuse any booking with payments or dependent records.
 for r in select conrelid::regclass relation,a.attname from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
  where c.contype='f' and c.confrelid='public.bookings'::regclass loop
  execute format('select count(*) from %s where %I in(select id from original_demo_bookings)',r.relation,r.attname) into refs;
  if refs>0 then raise exception 'DEMO_BOOKING_HAS_DEPENDENCIES: %',r.relation;end if;
 end loop;
 -- Only unused draft venues and an unpaid fee-exempt subscription may be removed.
 if (select count(*) from venues where owner_id in(select id from cleanup_accounts))<>2
  or exists(select 1 from venues where owner_id in(select id from cleanup_accounts) and (status<>'draft' or cardinality(images)>0 or slug not like 'demo-ui-ux-%'))
  or exists(select 1 from owner_subscriptions where owner_id in(select id from cleanup_accounts) and (fee_required or paid_until is not null))
  or exists(select 1 from owner_subscriptions where updated_by in(select id from cleanup_accounts) and owner_id not in(select id from cleanup_accounts))
  or exists(select 1 from storage.objects where owner_id in(select id::text from cleanup_accounts) or (storage.foldername(name))[1] in(select id::text from cleanup_accounts)) then raise exception 'DEMO_ACCOUNT_HAS_NON_FIXTURE_DATA';end if;
 -- Catch non-cascading account references before touching anything.
 for r in select conrelid::regclass relation,a.attname from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
  where c.contype='f' and c.confrelid='public.profiles'::regclass and c.conrelid not in('public.bookings'::regclass,'public.venues'::regclass,'public.notifications'::regclass,'public.owner_subscriptions'::regclass) loop
  execute format('select count(*) from %s where %I in(select id from cleanup_accounts)',r.relation,r.attname) into refs;
  if refs>0 then raise exception 'DEMO_ACCOUNT_HAS_DEPENDENCIES: %',r.relation;end if;
 end loop;
 perform 1 from profiles where id in(select id from cleanup_accounts) for update;
 perform 1 from bookings where id in(select id from original_demo_bookings) for update;
end $$;

-- Existing active players only, with real contact fields and accounts predating play.
-- One account per phone number; no invented names/phones or changes to their profiles.
create temp table real_players on commit drop as
 select chosen.*,row_number() over(order by md5(chosen.id::text||'docs-player-shuffle'))-1 as player_index
 from (select distinct on(p.phone) p.id,p.full_name,p.phone,p.created_at from profiles p join auth.users u on u.id=p.id
 where p.role='player' and p.full_name is not null and p.full_name not ilike '%demo%'
 and u.email not like '%@example.invalid' and p.phone ~ '^0[35789][0-9]{8}$'
 and (p.banned_until is null or p.banned_until<=now())
 and p.created_at<(select min(starts_at)-interval '1 hour' from original_demo_bookings)
 order by p.phone,p.created_at,p.id)chosen;
create temp table redistribution_plan(
 booking_id uuid primary key,player_id uuid,court_id uuid,starts_at timestamptz,ends_at timestamptz,created_at timestamptz,total_amount int
) on commit drop;

-- Deterministic attempts make rollback/review/application reproducible.
-- Cycle courts so King Club uses all 3, Bao Cap all 4, football its only court.
do $$ declare attempt int; ready boolean:=false; player_count int; begin
 select count(*) into player_count from real_players;
 if player_count<6 then raise exception 'NOT_ENOUGH_EXISTING_PLAYERS';end if;
 for attempt in 1..100 loop
  truncate redistribution_plan;
  insert into redistribution_plan
  with shuffled as (
   select b.*,c.venue_id,c.sport,
    row_number() over(order by md5(b.id::text||attempt::text))-1 as player_index,
    row_number() over(partition by c.venue_id order by md5(b.id::text||attempt::text))-1 as court_index
   from original_demo_bookings b join courts c on c.id=b.court_id
  ), available_courts as (
   select c.*,coalesce(c.open_time,v.open_time) opening,coalesce(c.close_time,v.close_time) closing,
    row_number() over(partition by c.venue_id order by c.sort_order,c.id)-1 as court_index,
    count(*) over(partition by c.venue_id) as court_count
   from courts c join venues v on v.id=c.venue_id where c.is_active and v.status='active'
  )
  select b.id,p.id,c.id,slot.starts_local at time zone 'Asia/Ho_Chi_Minh',
   (slot.starts_local+interval '1 hour') at time zone 'Asia/Ho_Chi_Minh',
   greatest(p.created_at+interval '5 minutes',(slot.starts_local at time zone 'Asia/Ho_Chi_Minh')
    -make_interval(hours=>1+(('x'||substr(md5(b.id::text||attempt::text||'lead-hours'),1,8))::bit(32)::bigint % 48)::int,
                   mins=>(('x'||substr(md5(b.id::text||attempt::text||'lead-minutes'),1,8))::bit(32)::bigint % 60)::int)),
   quote.price_per_hour
  from shuffled b join real_players p on p.player_index=b.player_index % player_count
  join available_courts c on c.venue_id=b.venue_id and c.sport=b.sport and c.court_index=b.court_index % c.court_count
  cross join lateral (
   select g as starts_local from generate_series((b.starts_at at time zone 'Asia/Ho_Chi_Minh')::date+c.opening,
    (b.starts_at at time zone 'Asia/Ho_Chi_Minh')::date+c.closing-interval '1 hour',interval '1 hour')g
   order by md5(b.id::text||g::text||attempt::text) limit 1
  )slot
  cross join lateral (
   select r.price_per_hour from price_rules r where r.court_id=c.id
    and extract(dow from slot.starts_local)::int=any(r.days)
    and r.start_time<=slot.starts_local::time and r.end_time>=(slot.starts_local+interval '1 hour')::time
   order by r.priority desc,r.id limit 1
  )quote;
  ready:=(select count(*)=17 from redistribution_plan)
   and not exists(select 1 from redistribution_plan p join original_demo_bookings b on b.id=p.booking_id where p.total_amount<>b.total_amount or p.created_at+interval '15 minutes'>=p.starts_at)
   and not exists(select 1 from redistribution_plan a join redistribution_plan b on a.booking_id<b.booking_id
    and (a.court_id=b.court_id or a.player_id=b.player_id) and tstzrange(a.starts_at,a.ends_at)&&tstzrange(b.starts_at,b.ends_at))
   and not exists(select 1 from redistribution_plan p join bookings b on (b.court_id=p.court_id or b.user_id=p.player_id)
    and b.id not in(select id from original_demo_bookings) and b.status<>'cancelled' and tstzrange(b.starts_at,b.ends_at)&&tstzrange(p.starts_at,p.ends_at))
   and not exists(select 1 from redistribution_plan p join court_closures x on x.court_id=p.court_id and tstzrange(x.starts_at,x.ends_at)&&tstzrange(p.starts_at,p.ends_at))
   and (select count(*) from(select player_id from redistribution_plan p join courts c on c.id=p.court_id group by player_id having count(distinct c.venue_id)>1)t)>=4
   and (select count(*) from(select venue_id,lag(venue_id) over(order by p.created_at desc,p.booking_id) prior from redistribution_plan p join courts c on c.id=p.court_id)t where venue_id<>prior)>=8;
  exit when ready;
 end loop;
 if not ready then raise exception 'NO_VALID_REDISTRIBUTION';end if;
end $$;

-- Recreate only the explicitly marked, unpaid fixtures. IDs/codes remain stable;
-- normal booking, receiver, policy and snapshot triggers all execute on INSERT.
delete from bookings where id in(select id from original_demo_bookings);
insert into bookings
 select (jsonb_populate_record(null::public.bookings,to_jsonb(b)||jsonb_build_object(
  'user_id',p.player_id,'customer_name',u.full_name,'customer_phone',u.phone,
  'court_id',p.court_id,'starts_at',p.starts_at,'ends_at',p.ends_at,
  'created_at',p.created_at,'expires_at',p.created_at+interval '15 minutes'
 ))).* from original_demo_bookings b join redistribution_plan p on p.booking_id=b.id join real_players u on u.id=p.player_id;

-- Let the normal admin RPC enforce deletion guards and protect the last admin.
do $$ declare r record; begin
 for r in select id from venues where owner_id in(select id from cleanup_accounts) order by id loop
  if exists(select 1 from bookings b join courts c on c.id=b.court_id where c.venue_id=r.id)
   or exists(select 1 from tournaments t join courts c on c.id=t.court_id where c.venue_id=r.id) then raise exception 'DEMO_VENUE_HAS_HISTORY';end if;
  perform admin_delete_venue(r.id);
 end loop;
 delete from owner_subscriptions where owner_id in(select id from cleanup_accounts);
 for r in select id from cleanup_accounts order by id loop perform admin_user_action(r.id,'delete');end loop;
end $$;

-- Assertions are also run before COMMIT during application, not just in dry runs.
do $$ begin
 assert not exists(select 1 from auth.users where id in(select id from cleanup_accounts)), 'all seven demo accounts removed';
 assert not exists(select 1 from original_other_bookings o full join (select id,to_jsonb(b) original from bookings b where id not in(select id from original_demo_bookings))n using(id) where o.original is distinct from n.original), 'other bookings unchanged';
 assert not exists(select 1 from original_profiles o full join (select id,to_jsonb(p) original from profiles p where id not in(select id from cleanup_accounts))n using(id) where o.original is distinct from n.original), 'real profiles unchanged';
 assert (select count(*) from bookings where id in(select id from original_demo_bookings))=17, 'seventeen fixtures retained';
 assert not exists(select 1 from original_demo_bookings o join bookings b on b.id=o.id join courts c on c.id=b.court_id join courts oldcourt on oldcourt.id=o.court_id
  where b.code<>o.code or c.venue_id<>oldcourt.venue_id or c.sport<>oldcourt.sport
   or (b.starts_at at time zone 'Asia/Ho_Chi_Minh')::date<>(o.starts_at at time zone 'Asia/Ho_Chi_Minh')::date
   or b.total_amount<>o.total_amount or b.deposit_amount<>o.deposit_amount or b.status<>o.status or b.note<>o.note
   or row(b.payment_owner_id,b.payment_connection_id,b.payment_bank,b.payment_account,b.payment_account_name)
      is distinct from row(o.payment_owner_id,o.payment_connection_id,o.payment_bank,o.payment_account,o.payment_account_name)
   or b.paid_at is not null), 'codes, venue/day totals, money, receiver and demo note preserved';
 assert not exists(select 1 from bookings b join courts c on c.id=b.court_id where b.id in(select id from original_demo_bookings) and (b.court_name_snapshot<>c.name or b.sport_snapshot<>c.sport)), 'court snapshots reflect assigned courts';
 assert (select count(*) from payments)=(select payments from original_finance)
  and (select count(*) from sepay_events)=(select events from original_finance)
  and (select count(*) from incoming_transfers)=(select transfers from original_finance), 'no financial records created or removed';
end $$;

-- Non-identifying review output; do not print real contact information to logs.
select jsonb_build_object(
 'updated_bookings',(select count(*) from redistribution_plan),
 'existing_players_used',(select count(distinct player_id) from redistribution_plan),
 'accounts_removed',(select count(*) from cleanup_accounts),
 'court_distribution',(select jsonb_agg(t) from(select v.slug,c.name as court_name,count(*) bookings from redistribution_plan p join courts c on c.id=p.court_id join venues v on v.id=c.venue_id group by v.slug,c.name order by v.slug,c.name)t),
 'daily_distribution',(select jsonb_agg(t) from(select v.slug,(p.starts_at at time zone 'Asia/Ho_Chi_Minh')::date as playing_date,count(*) bookings from redistribution_plan p join courts c on c.id=p.court_id join venues v on v.id=c.venue_id group by v.slug,playing_date order by v.slug,playing_date)t),
 'interleaved_venue_transitions',(select count(*) from(select venue_id,lag(venue_id) over(order by p.created_at desc,p.booking_id) prior from redistribution_plan p join courts c on c.id=p.court_id)t where venue_id<>prior)
) as cleanup_result;
rollback;
