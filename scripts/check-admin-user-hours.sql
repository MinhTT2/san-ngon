begin;
do $$
declare r jsonb; a uuid;
begin
  begin perform admin_list_users('','all','all',1,'hours_desc'); raise exception 'Unauthorized read';
  exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
  select id into strict a from profiles where role='admin' order by created_at limit 1;
  perform set_config('request.jwt.claim.sub',a::text,true);
  r:=admin_list_users('','all','all',1,'hours_desc');
  assert not exists(select 1 from (select (v->>'booked_minutes')::numeric as m,
    lag((v->>'booked_minutes')::numeric) over(order by n) as prev
    from jsonb_array_elements(r->'users') with ordinality x(v,n)) q where m>prev), 'Incorrect descending hours';
  assert not exists(select 1 from jsonb_array_elements(r->'users') u where
    (u->>'booked_minutes')::numeric <> coalesce((select sum(extract(epoch from(ends_at-starts_at))/60)
    from bookings where user_id=(u->>'id')::uuid and status in ('confirmed','completed')),0)), 'Hours mismatch';
  assert (select count(*)=40 from bookings), 'Expected 40 orders';
  assert not exists(select 1 from payments p join bookings b on b.id=p.booking_id
    where (b.note like '[demo-report-20261025]%' or exists(select 1 from operations_audit a
      where a.entity_id=b.id and a.action='booking.seed_presentation_updated'
        and a.details->>'original_note' like '[demo-report-20261025]%')) and p.status='paid'), 'Unexpected demo receipt';
end $$;
rollback;
select '40 orders, hours, descending sort and authorization verified' as result;
