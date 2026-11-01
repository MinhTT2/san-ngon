begin;
insert into user_activity_simulations(user_id,seconds,batch)
select p.id,1800+((row_number() over(order by p.id)::int*53)%601),'demo-usage-20261101-final'
from profiles p where p.role='owner'
on conflict(user_id) do update set seconds=excluded.seconds,batch=excluded.batch;
insert into user_activity_simulations(user_id,seconds,batch)
select p.id,600+((row_number() over(order by p.id)::int*41)%601),'demo-usage-20261101-final'
from profiles p where exists(select 1 from user_vip_memberships v where v.user_id=p.id and v.enabled and v.paid_until>now())
on conflict(user_id) do update set seconds=greatest(user_activity_simulations.seconds,excluded.seconds),batch=excluded.batch;
insert into user_activity_simulations(user_id,seconds,batch)
select distinct p.id,600+((row_number() over(order by p.id)::int*37)%601),'demo-usage-20261101-final'
from profiles p join bookings b on b.user_id=p.id
on conflict(user_id) do update set seconds=greatest(user_activity_simulations.seconds,excluded.seconds),batch=excluded.batch;
insert into user_activity_simulations(user_id,seconds,batch)
select p.id,330+((row_number() over(order by p.id)::int*29)%271),'demo-usage-20261101-final'
from profiles p where p.role='player' order by p.id limit 80
on conflict(user_id) do update set seconds=greatest(user_activity_simulations.seconds,excluded.seconds),batch=excluded.batch;
commit;
select jsonb_build_object('orders',(select count(*) from bookings),'owners_30_40',(select count(*) from user_activity_simulations s join profiles p on p.id=s.user_id where p.role='owner' and s.seconds between 1800 and 2400),'vip_10_plus',(select count(*) from user_activity_simulations s join user_vip_memberships v on v.user_id=s.user_id and v.enabled and v.paid_until>now() where s.seconds>=600),'bookers_10_plus',(select count(distinct b.user_id) from bookings b join user_activity_simulations s on s.user_id=b.user_id where s.seconds>=600),'over5',(select count(*) from user_activity_simulations where seconds>300));
