-- Read-only assertions; transaction rolls back and does not alter measured usage.
begin;
select set_config('request.jwt.claim.sub',(select id::text from profiles where role='admin'
 and (banned_until is null or banned_until<=now()) order by created_at limit 1),true);
do $$ declare report jsonb;item jsonb;page_number int;previous_count int:=2147483647;
 actual_count int;actual_minutes numeric;begin
 report:=admin_list_users('','all','all',1,'bookings_desc');
 assert (report->>'bookers')::int=(select count(distinct user_id) from bookings),'distinct bookers, not number of orders';
 assert (report->>'booking_total')::int=(select count(*) from bookings),'includes cancelled order history in count';
 assert (report->>'measured_over_five')::int=(select count(*) from user_activity_totals where floor(total_seconds)>300),'sample durations never become measured usage';
 for page_number in 1..ceil((report->>'total')::numeric/20)::int loop
  report:=admin_list_users('','all','all',page_number,'bookings_desc');
  for item in select * from jsonb_array_elements(report->'users') loop
   select count(*),coalesce(sum(extract(epoch from ends_at-starts_at)/60)
    filter(where status in ('confirmed','completed')),0)
    into actual_count,actual_minutes from bookings where user_id=(item->>'id')::uuid;
   assert (item->>'booking_count')::int=actual_count,'per-user count covers history';
   assert (item->>'booked_minutes')::numeric=actual_minutes,'cancelled orders do not contribute court time';
   assert actual_count<=previous_count,'booking sort is stable across pagination';
   previous_count:=actual_count;
  end loop;
 end loop;
 report:=admin_list_users('','booked','all',1,'bookings_desc');
 assert (report->>'total')::int=(select count(distinct user_id) from bookings),'booked filter excludes non-booking accounts';
 assert not exists(select 1 from jsonb_array_elements(report->'users') x where (x->>'booking_count')::int=0),'only bookers returned';
 assert (report->>'bookers_measured_over_five')::int=(select count(*) from user_activity_totals a where floor(total_seconds)>300 and exists(select 1 from bookings b where b.user_id=a.user_id)),'measured five-minute count is scoped to bookers';
 assert (report->>'bookers_sample_only_over_five')::int=(select count(*) from user_activity_simulations s left join user_activity_totals a on a.user_id=s.user_id where s.seconds>300 and coalesce(floor(a.total_seconds),0)<=300 and exists(select 1 from bookings b where b.user_id=s.user_id)),'sample count does not double-count measured bookers';
 assert (report->>'bookers')::int=(report->>'bookers_measured_over_five')::int+(report->>'bookers_sample_only_over_five')::int+(report->>'bookers_without_five_minutes')::int,'duration source counts partition bookers exactly';
 report:=admin_list_users('','all','player',1,'hours_desc');
 assert (report->>'total')::int=(select count(*) from profiles where role='player'),'role filter retained';
 assert (report->>'bookers')::int=(select count(distinct b.user_id) from bookings b join profiles p on p.id=b.user_id where p.role='player'),'summary respects role filter';
 report:=admin_list_users('missing-booker-fixture-8b9921','all','all',1,'usage_desc');
 assert (report->>'total')::int=0 and (report->>'bookers')::int=0 and (report->>'booking_total')::int=0,'empty filtered result returns zero summary';
end $$;
select set_config('request.jwt.claim.sub',(select id::text from profiles where role='player'
 and (banned_until is null or banned_until<=now()) order by created_at limit 1),true);
do $$ begin
 begin perform admin_list_users('','all','all',1,'bookings_desc');raise exception 'CHECK_FAILED';
 exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end $$;
select 'PASS: booking history, distinct users, court hours, actual usage, pagination, role/search and authorization' result;
rollback;
