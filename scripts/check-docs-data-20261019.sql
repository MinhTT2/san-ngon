-- Run after apply-docs-data-20261019.sql (also inside the rollback rehearsal).
do $$
declare actual jsonb; expected jsonb; admin_id uuid; users jsonb;
begin
  select jsonb_object_agg(venue_day,quantity) into actual from (
    select c.venue_id::text || '/' || (b.starts_at at time zone 'Asia/Ho_Chi_Minh')::date::text as venue_day,
      count(*) as quantity
    from bookings b join courts c on c.id=b.court_id
    where b.note='Docs 2026-10-19 · Dữ liệu demo, không phải giao dịch ngân hàng'
    group by c.venue_id,(b.starts_at at time zone 'Asia/Ho_Chi_Minh')::date
  ) x;
  expected := '{
    "701a6429-7cdd-4a0e-9c15-47285cba8cf7/2026-10-14":1,
    "701a6429-7cdd-4a0e-9c15-47285cba8cf7/2026-10-15":2,
    "701a6429-7cdd-4a0e-9c15-47285cba8cf7/2026-10-17":3,
    "701a6429-7cdd-4a0e-9c15-47285cba8cf7/2026-10-18":1,
    "7bcffbb1-4ca6-4106-b35a-d33b92bb8d20/2026-10-14":1,
    "7bcffbb1-4ca6-4106-b35a-d33b92bb8d20/2026-10-16":1,
    "7bcffbb1-4ca6-4106-b35a-d33b92bb8d20/2026-10-17":2,
    "7bcffbb1-4ca6-4106-b35a-d33b92bb8d20/2026-10-18":2,
    "d5020bf4-fd33-474a-bf95-0e5e345752e4/2026-10-17":2,
    "d5020bf4-fd33-474a-bf95-0e5e345752e4/2026-10-18":2
  }';
  assert actual=expected, 'Wrong venue/date counts';
  assert (select count(*)=17 and bool_and(status='completed' and paid_at is null
    and total_amount=deposit_amount and total_amount>0 and ends_at<now())
    from bookings where note='Docs 2026-10-19 · Dữ liệu demo, không phải giao dịch ngân hàng'), 'Wrong booking state';
  assert not exists(select 1 from payments p join bookings b on b.id=p.booking_id
    where b.note='Docs 2026-10-19 · Dữ liệu demo, không phải giao dịch ngân hàng'), 'Unexpected payment receipt';
  assert (select (owner_application_submitted_at at time zone 'Asia/Ho_Chi_Minh')::date=date '2026-10-10'
    from profiles where id='fdc022ce-a64e-4a1e-adeb-c0a82ef6f117'), 'Wrong Hieu date';
  assert (select (owner_application_submitted_at at time zone 'Asia/Ho_Chi_Minh')::date=date '2026-10-11'
    from profiles where id='aeefe191-989a-4cd1-aa38-8b94711b0c16'), 'Wrong Van Anh date';
  assert not has_column_privilege('authenticated','public.profiles','admin_sort_at','UPDATE'), 'Browser can reorder users';
  assert not has_column_privilege('authenticated','public.profiles','owner_application_submitted_at','UPDATE'), 'Browser can backdate applications';
  select id into strict admin_id from profiles where role='admin' order by created_at limit 1;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  users := public.admin_list_users('','all','all',3)->'users';
  assert (select count(*)=3 from jsonb_array_elements(users) u
    where u->>'id' in ('b5ce3901-856c-40a9-9cee-609d48d0a491','aeefe191-989a-4cd1-aa38-8b94711b0c16','fdc022ce-a64e-4a1e-adeb-c0a82ef6f117')),
    'Expected three accounts on middle page 3';
  perform set_config('request.jwt.claim.sub','',true);
end $$;
select 'Docs data assertions passed' as result;
