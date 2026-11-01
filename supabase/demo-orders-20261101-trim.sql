begin;
create temp table keep on commit drop as
select b.id from bookings b where b.note like '[demo-orders-20261101]%'
order by case when exists(select 1 from user_vip_memberships v where v.user_id=b.user_id and v.enabled and v.paid_until>now()) then 0 else 1 end,
 case when (select c.sport from courts c where c.id=b.court_id)='football7' then 2 else 0 end,
 b.starts_at limit 15;
delete from bookings b where b.note like '[demo-orders-20261101]%' and not exists(select 1 from keep k where k.id=b.id);
do $ begin if (select count(*) from bookings)<>60 then raise exception 'TOTAL_NOT_60'; end if; end $;
commit;
select jsonb_build_object('total',(select count(*) from bookings),'kept_orders',(select count(*) from bookings where note like '[demo-orders-20261101]%'),'vip_bookers',(select count(distinct b.user_id) from bookings b join user_vip_memberships v on v.user_id=b.user_id and v.enabled and v.paid_until>now()));
