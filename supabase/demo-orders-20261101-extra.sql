begin;
select pg_advisory_xact_lock(20261101,61);
create temporary table extra_slots on commit drop as
with dates as (
 select d::date play_date,h from generate_series(date '2026-10-14',date '2026-11-01',interval '1 day') d cross join generate_series(7,21) h
), candidates as (
 select d.play_date,d.h,c.id court_id,c.sport,
  (d.play_date+d.h*interval '1 hour') at time zone 'Asia/Ho_Chi_Minh' starts_at,
  (d.play_date+(d.h+1)*interval '1 hour') at time zone 'Asia/Ho_Chi_Minh' ends_at,r.price_per_hour,
  row_number() over(partition by d.play_date,d.h order by case when c.sport='football7' then 3 when c.sport='pickleball' then 0 else 1 end,md5(c.id::text||d.play_date::text||d.h::text)) pick
 from dates d join courts c on c.is_active join venues v on v.id=c.venue_id and v.status='active'
 cross join lateral(select pr.price_per_hour from price_rules pr where pr.court_id=c.id and extract(dow from d.play_date)::int=any(pr.days) and pr.start_time<=make_time(d.h,0,0) and pr.end_time>=make_time(d.h+1,0,0) order by pr.priority desc,pr.id limit 1) r
 where r.price_per_hour>0 and coalesce(c.open_time,v.open_time)<=make_time(d.h,0,0) and coalesce(c.close_time,v.close_time)>=make_time(d.h+1,0,0)
 and (d.play_date+d.h*interval '1 hour') at time zone 'Asia/Ho_Chi_Minh'<now()
 and not exists(select 1 from bookings b where b.court_id=c.id and b.status in ('pending','confirmed','completed') and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange((d.play_date+d.h*interval '1 hour') at time zone 'Asia/Ho_Chi_Minh',((d.play_date+d.h+1*interval '1 hour')) at time zone 'Asia/Ho_Chi_Minh','[)'))
 and not exists(select 1 from court_closures x where x.court_id=c.id and tstzrange(x.starts_at,x.ends_at,'[)')&&tstzrange((d.play_date+d.h*interval '1 hour') at time zone 'Asia/Ho_Chi_Minh',((d.play_date+d.h+1*interval '1 hour')) at time zone 'Asia/Ho_Chi_Minh','[)'))
), ranked as (select *,row_number() over(order by case when sport='football7' then 2 else 0 end,play_date,h)::int seq from candidates where pick=1)
select * from ranked where seq<=greatest(0,60-(select count(*) from bookings where note like '[demo-orders-20261101]%'));
insert into bookings(code,court_id,user_id,starts_at,ends_at,original_amount,vip_discount_amount,total_amount,deposit_amount,status,refund_status,customer_name,customer_phone,note,created_at,expires_at)
select 'SAN'||gen_booking_code(),s.court_id,u.id,s.starts_at,s.ends_at,s.price_per_hour,case when exists(select 1 from user_vip_memberships v where v.user_id=u.id and v.enabled and v.paid_until>now()) then floor(s.price_per_hour/10)::int else 0 end,s.price_per_hour-case when exists(select 1 from user_vip_memberships v where v.user_id=u.id and v.enabled and v.paid_until>now()) then floor(s.price_per_hour/10)::int else 0 end,s.price_per_hour-case when exists(select 1 from user_vip_memberships v where v.user_id=u.id and v.enabled and v.paid_until>now()) then floor(s.price_per_hour/10)::int else 0 end,'completed','none',u.full_name,coalesce(u.phone,'090000'||right(replace(u.id::text,'-',''),8)),'[demo-orders-20261101] Dữ liệu demo, không phải giao dịch ngân hàng',s.starts_at-interval '2 hours',s.starts_at-interval '105 minutes'
from extra_slots s join lateral(select p.* from profiles p where p.role='player' order by md5(p.id::text||s.starts_at::text) limit 1) u on true;
commit;
select count(*) total from bookings where note like '[demo-orders-20261101]%';
