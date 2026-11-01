begin;
update user_activity_simulations s set seconds=600,batch='demo-usage-20261101-final'
where exists(select 1 from user_vip_memberships v where v.user_id=s.user_id and v.enabled and v.paid_until>now())
   or exists(select 1 from bookings b where b.user_id=s.user_id);
commit;
select jsonb_build_object('vip_10_plus',(select count(*) from user_activity_simulations s join user_vip_memberships v on v.user_id=s.user_id and v.enabled and v.paid_until>now() where s.seconds>=600),'bookers_10_plus',(select count(distinct b.user_id) from bookings b join user_activity_simulations s on s.user_id=b.user_id where s.seconds>=600),'over5',(select count(*) from user_activity_simulations where seconds>300));
