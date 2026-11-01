begin;
select pg_advisory_xact_lock(20261101,60);

-- 80 synthetic presentation durations (5–10 minutes), separate from measured usage.
insert into public.user_activity_simulations(user_id,seconds,batch)
select p.id, 330 + ((row_number() over(order by p.id)::int * 37) % 271), 'demo-orders-20261101'
from public.profiles p
where p.role='player'
order by p.id
limit 80
on conflict (user_id) do update set seconds=excluded.seconds,batch=excluded.batch;

-- Pick deterministic users: all VIP users without a booking first, then other players.
create temporary table seed_users on commit drop as
select id,full_name,phone,row_number() over(order by priority,id)::int as n
from (
  select p.id,p.full_name,p.phone,
    case when exists(select 1 from public.user_vip_memberships v where v.user_id=p.id and v.enabled and v.paid_until>now())
      and not exists(select 1 from public.bookings b where b.user_id=p.id) then 0
      when exists(select 1 from public.user_vip_memberships v where v.user_id=p.id and v.enabled and v.paid_until>now()) then 1
      else 2 end as priority
  from public.profiles p where p.role='player'
) s
order by priority,id;

create temporary table seed_slots on commit drop as
with dates as (
  select d::date as play_date, h, 0 as bucket
  from generate_series(date '2026-10-14',date '2026-10-25',interval '1 day') d cross join generate_series(7,21) h
  union all
  select d::date, h, 1 as bucket
  from generate_series(date '2026-10-26',date '2026-11-01',interval '1 day') d cross join generate_series(7,21) h
), candidates as (
  select d.play_date,d.h,d.bucket,c.id as court_id,c.sport,
    (d.play_date+d.h*interval '1 hour') at time zone 'Asia/Ho_Chi_Minh' as starts_at,
    (d.play_date+(d.h+1)*interval '1 hour') at time zone 'Asia/Ho_Chi_Minh' as ends_at,
    r.price_per_hour,
    row_number() over(partition by d.play_date,d.h order by
      case when ((extract(doy from d.play_date)::int+d.h)%10=0 and c.sport='football7') then 0 when c.sport='football7' then 2 else 1 end, md5(c.id::text||d.play_date::text||d.h::text)) as pick
  from dates d
  join public.courts c on c.is_active
  join public.venues v on v.id=c.venue_id and v.status='active'
  cross join lateral (select pr.price_per_hour from public.price_rules pr
    where pr.court_id=c.id and extract(dow from d.play_date)::int=any(pr.days)
      and pr.start_time<=make_time(d.h,0,0) and pr.end_time>=make_time(d.h+1,0,0)
    order by pr.priority desc,pr.id limit 1) r
  where r.price_per_hour>0
    and coalesce(c.open_time,v.open_time)<=make_time(d.h,0,0)
    and coalesce(c.close_time,v.close_time)>=make_time(d.h+1,0,0)
    and (d.play_date+d.h*interval '1 hour') at time zone 'Asia/Ho_Chi_Minh' < now()
    and not exists(select 1 from public.bookings b where b.court_id=c.id
      and b.status in ('pending','confirmed','completed')
      and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange((d.play_date+d.h*interval '1 hour') at time zone 'Asia/Ho_Chi_Minh',((d.play_date+d.h+1*interval '1 hour')) at time zone 'Asia/Ho_Chi_Minh','[)'))
    and not exists(select 1 from public.court_closures cc where cc.court_id=c.id
      and tstzrange(cc.starts_at,cc.ends_at,'[)') && tstzrange((d.play_date+d.h*interval '1 hour') at time zone 'Asia/Ho_Chi_Minh',((d.play_date+d.h+1*interval '1 hour')) at time zone 'Asia/Ho_Chi_Minh','[)'))
), chosen as (
  select *,row_number() over(order by bucket desc,play_date,h)::int as seq, row_number() over(partition by bucket order by play_date,h)::int as bucket_seq
  from candidates where pick=1
)
select * from chosen where (bucket=1 and bucket_seq<=20) or (bucket=0 and bucket_seq<=40);

insert into public.bookings(code,court_id,user_id,starts_at,ends_at,original_amount,vip_discount_amount,total_amount,deposit_amount,status,refund_status,customer_name,customer_phone,note,created_at,expires_at)
select 'SAN'||public.gen_booking_code(), s.court_id, u.id, s.starts_at,s.ends_at,
  s.price_per_hour, case when exists(select 1 from public.user_vip_memberships v where v.user_id=u.id and v.enabled and v.paid_until>now()) then floor(s.price_per_hour::numeric/10)::int else 0 end,
  s.price_per_hour - case when exists(select 1 from public.user_vip_memberships v where v.user_id=u.id and v.enabled and v.paid_until>now()) then floor(s.price_per_hour::numeric/10)::int else 0 end,
  s.price_per_hour - case when exists(select 1 from public.user_vip_memberships v where v.user_id=u.id and v.enabled and v.paid_until>now()) then floor(s.price_per_hour::numeric/10)::int else 0 end,
  'completed','none',u.full_name,coalesce(u.phone,'090000'||right(replace(u.id::text,'-',''),8)),'[demo-orders-20261101] Dữ liệu demo, không phải giao dịch ngân hàng',
  s.starts_at-interval '2 hours',s.starts_at-interval '105 minutes'
from seed_slots s
join seed_users u on u.n=((s.seq-1) % (select count(*) from seed_users)) + 1
where s.seq<=60;

commit;

select jsonb_build_object('added',(select count(*) from public.bookings where note like '[demo-orders-20261101]%'),'added_this_week',(select count(*) from public.bookings where note like '[demo-orders-20261101]%' and starts_at >= ('2026-10-26'::date at time zone 'Asia/Ho_Chi_Minh')),'added_football',(select count(*) from public.bookings b join public.courts c on c.id=b.court_id where b.note like '[demo-orders-20261101]%' and c.sport='football7'),'added_badminton_pickle',(select count(*) from public.bookings b join public.courts c on c.id=b.court_id where b.note like '[demo-orders-20261101]%' and c.sport in ('badminton','pickleball')),'vip_with_bookings',(select count(*) from public.user_vip_memberships v where v.enabled and v.paid_until>now() and exists(select 1 from public.bookings b where b.user_id=v.user_id))) as result;
select count(*) as simulations_over_five from public.user_activity_simulations where seconds>300;

