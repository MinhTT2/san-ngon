-- Rollback fixture: presentation durations never become measured activity.
begin;
insert into auth.users(id) values
 ('d0260000-0000-4000-8000-000000000001'),('d0260000-0000-4000-8000-000000000002');
update profiles set full_name='Activity simulation SQL fixture' where id='d0260000-0000-4000-8000-000000000001';
update profiles set role='admin' where id='d0260000-0000-4000-8000-000000000002';
insert into user_activity_totals(user_id,total_seconds) values('d0260000-0000-4000-8000-000000000001',17);
insert into user_activity_simulations(user_id,seconds,batch) values('d0260000-0000-4000-8000-000000000001',420,'rollback-fixture');
select set_config('request.jwt.claim.sub','d0260000-0000-4000-8000-000000000001',true);
do $$ begin
 assert not has_table_privilege('authenticated','public.user_activity_simulations','SELECT'),'no direct reads';
 assert not has_table_privilege('authenticated','public.user_activity_simulations','INSERT'),'no browser writes';
 assert not has_table_privilege('anon','public.user_activity_simulations','SELECT'),'no anonymous reads';
 begin perform admin_list_users();raise exception 'CHECK_FAILED';exception when raise_exception then
  if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 perform record_user_activity('d0260000-0000-4000-8000-000000000003',true);
 assert (select total_seconds=17 from user_activity_totals where user_id=auth.uid()),'heartbeat never adds simulated seconds';
 assert (select seconds=420 from user_activity_simulations where user_id=auth.uid()),'heartbeat leaves presentation data intact';
 begin
  insert into user_activity_simulations(user_id,seconds,batch) values(auth.uid(),299,'invalid');
  raise exception 'CHECK_FAILED';
 exception when check_violation then null;end;
end $$;
select set_config('request.jwt.claim.sub','d0260000-0000-4000-8000-000000000002',true);
do $$ declare report jsonb;begin
 report:=admin_list_users('Activity simulation SQL fixture','all','all',1);
 assert (report#>>'{users,0,usage_seconds}')::int=17,'measured seconds stay factual';
 assert (report#>>'{users,0,simulation_usage_seconds}')::int=420,'admin gets separately named simulation';
 report:=admin_list_users('Activity simulation SQL fixture','all','all',1,'usage_desc');
 assert (report#>>'{users,0,usage_seconds}')::int=17,'five-argument RPC preserves measured usage';
 assert (report#>>'{users,0,simulation_usage_seconds}')::int=420,'five-argument RPC includes separate simulation';
 assert report#>'{users,0}' ? 'is_vip' and report#>'{users,0}' ? 'booked_minutes','VIP and playing-hour fields retained';
end $$;
delete from auth.users where id='d0260000-0000-4000-8000-000000000001';
do $$ begin assert not exists(select 1 from user_activity_simulations where user_id='d0260000-0000-4000-8000-000000000001'),'account deletion cascades';end $$;
rollback;
