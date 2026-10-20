-- Manual synthetic history for the 50 marked demo players. Idempotent.
-- Unpaid cancellations only: no live holds, bank transactions or paid revenue.
-- Run after demo-users.sql and demo-user-details.sql using db query --linked --file.
begin;
select pg_advisory_xact_lock(20261020, 50);
create temporary table demo_history on commit drop as
with players as (
  select p.*, row_number() over(order by p.full_name,p.id)::integer as n
  from public.profiles p join auth.users u on u.id=p.id
  where u.raw_user_meta_data->>'demo_seed'='demo-players-20261020'
), requests as (
  select p.*, j,
    least(date '2026-10-19',
      (p.created_at at time zone 'Asia/Ho_Chi_Minh')::date+j*2) as play_date
  from players p cross join lateral generate_series(1,1+p.n%4) j
), slots as (
  select p.*, s.court_id,s.venue_id,s.starts_at,s.price_per_hour,
    p.created_at+(s.starts_at-p.created_at)*((25+p.n%35)/100.0) as booked_at
  from requests p cross join lateral (
    select c.id as court_id,v.id as venue_id,
      (p.play_date+h*interval '1 hour') at time zone 'Asia/Ho_Chi_Minh' as starts_at,
      r.price_per_hour
    from public.courts c join public.venues v on v.id=c.venue_id
    cross join generate_series(9,21) h
    cross join lateral (
      select pr.price_per_hour from public.price_rules pr
      where pr.court_id=c.id and extract(dow from p.play_date)::int=any(pr.days)
        and pr.start_time <= make_time(h,0,0) and pr.end_time >= make_time(h+1,0,0)
      order by pr.priority desc,pr.id limit 1
    ) r
    where c.is_active and v.status='active' and r.price_per_hour>0
      and coalesce(c.open_time,v.open_time)<=make_time(h,0,0)
      and coalesce(c.close_time,v.close_time)>=make_time(h+1,0,0)
      and (p.play_date+h*interval '1 hour') at time zone 'Asia/Ho_Chi_Minh' > p.created_at+interval '30 minutes'
    order by md5(c.id::text||p.id::text||p.j::text||h::text) limit 1
  ) s
)
select md5('demo-history-20261020:'||id::text||':'||j::text)::uuid as booking_id,
  id as user_id, full_name,phone,n,j,court_id,venue_id,starts_at,price_per_hour,booked_at
from slots;

do $$ begin
  if (select count(distinct user_id) from demo_history)<>50 then
    raise exception 'Every demo player must have a valid historical slot';
  end if;
end $$;

insert into public.bookings(id,code,court_id,user_id,starts_at,ends_at,total_amount,
  deposit_amount,status,refund_status,customer_name,customer_phone,note,
  created_at,expires_at,cancelled_at)
select booking_id,'SAN'||public.gen_booking_code(),court_id,user_id,starts_at,
  starts_at+interval '1 hour',price_per_hour,price_per_hour,'cancelled','none',full_name,phone,
  '[demo-players-20261020] ' || (array['Nhóm mình chơi sau giờ làm.',
    'Cho mình xin sân gần lối vào nhé.','Nhóm có người mới chơi, cảm ơn sân.',
    'Mình đặt cho nhóm bạn cùng công ty.'])[1+(n+j)%4],
  booked_at,booked_at+interval '15 minutes',
  booked_at+case when (n+j)%3=0 then interval '8 minutes' else interval '15 minutes' end
from demo_history on conflict(id) do nothing;

-- A cancelled unpaid order has a pending payment intent, never a paid transfer.
insert into public.payments(id,booking_id,amount,ref_code,status,created_at)
select md5('demo-intent:'||d.booking_id::text)::uuid,d.booking_id,b.deposit_amount,b.code,
  'pending',b.created_at from demo_history d join public.bookings b on b.id=d.booking_id
on conflict(id) do nothing;

insert into public.notifications(id,user_id,booking_id,kind,channel,title,body,created_at,read_at)
select md5('demo-reminder:'||booking_id::text)::uuid,user_id,booking_id,'expiring_soon','app',
  'Sắp hết thời gian giữ chỗ','Bạn còn 5 phút để hoàn tất thanh toán tiền cọc.',
  booked_at+interval '10 minutes',
  case when n%3<>0 then booked_at+interval '12 minutes' end
from demo_history where (n+j)%3<>0 on conflict(id) do nothing;

insert into public.venue_favorites(user_id,venue_id,created_at)
select user_id,venue_id,min(booked_at)-interval '5 minutes'
from demo_history group by user_id,venue_id on conflict(user_id,venue_id) do nothing;

do $$ begin
  if exists(select 1 from demo_history d join public.bookings b on b.id=d.booking_id
    join public.profiles p on p.id=b.user_id
    where b.status<>'cancelled' or b.paid_at is not null or b.created_at<p.created_at
      or b.cancelled_at>=b.starts_at or b.ends_at>now())
    or exists(select 1 from public.payments p join demo_history d on d.booking_id=p.booking_id
      where p.status='paid' or p.bank_tx_id is not null) then
    raise exception 'Demo history must remain unpaid, historical and after signup';
  end if;
end $$;
commit;

select count(*) as historical_bookings,count(distinct user_id) as players,
  min(created_at) as first_booking,max(created_at) as last_booking
from public.bookings where note like '[demo-players-20261020]%';
