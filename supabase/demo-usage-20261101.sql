begin;
insert into user_activity_simulations(user_id,seconds,batch)
select p.id,330+((row_number() over(order by p.created_at,p.id)::int*47)%271),'demo-usage-20261101'
from profiles p where p.role='player'
on conflict(user_id) do update set seconds=greatest(user_activity_simulations.seconds,excluded.seconds),batch=excluded.batch;
commit;
select count(*) accounts,count(*) filter(where seconds>300) over5 from user_activity_simulations;
