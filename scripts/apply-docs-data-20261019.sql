-- One-off, rerunnable data import requested in Google Doc
-- 1yB2-cRLPRcOWGUNOk3-JYiGBeccqdX9BvN8Pra_WPD8.
-- T4--CN means the PREVIOUS week: 14--18 October 2026.
-- Historical demo bookings only; no bank transactions or payment receipts.
begin;
select pg_advisory_xact_lock(20261019);

update public.profiles set owner_application_submitted_at =
  (date '2026-10-10' + (created_at at time zone 'Asia/Ho_Chi_Minh')::time)
    at time zone 'Asia/Ho_Chi_Minh'
where id = 'fdc022ce-a64e-4a1e-adeb-c0a82ef6f117';
update public.profiles set owner_application_submitted_at =
  (date '2026-10-11' + (created_at at time zone 'Asia/Ho_Chi_Minh')::time)
    at time zone 'Asia/Ho_Chi_Minh'
where id = 'aeefe191-989a-4cd1-aa38-8b94711b0c16';

-- Use a stable middle anchor without rewriting signup dates in profiles/auth.users.
with anchor as (
  select created_at from public.profiles
  where id = 'd2aa7c86-cc0d-41b7-865d-b09f5e6d98a4'
), targets(id, ordinal) as (values
  ('b5ce3901-856c-40a9-9cee-609d48d0a491'::uuid, 1),
  ('aeefe191-989a-4cd1-aa38-8b94711b0c16'::uuid, 2),
  ('fdc022ce-a64e-4a1e-adeb-c0a82ef6f117'::uuid, 3)
)
update public.profiles p set admin_sort_at = a.created_at - t.ordinal * interval '1 microsecond'
from targets t cross join anchor a where p.id = t.id;

do $$
declare
  r record; slot record; actor record; existing public.bookings;
  n int := 0; booking_id uuid;
  demo_ids uuid[] := array[
    '16e5bc3a-3e87-47de-8bb6-4ad3466b4d0a'::uuid,
    '8099fdd3-d54d-4511-a6cb-33096cc1e042'::uuid,
    'fd1657c9-ca1c-44b2-9242-848429158f78'::uuid,
    'eb3da4b2-fe8e-4449-abb3-42d306c96d55'::uuid,
    '7e62e25d-a434-4081-b804-14e9df545a37'::uuid
  ];
begin
  if (select count(*) from profiles where id = any(demo_ids) and full_name like '%(Demo)%') <> 5 then
    raise exception 'Expected five existing demo players';
  end if;
  for r in
    select v.venue_id::uuid, v.day::date, g.ordinal
    from (values
      ('701a6429-7cdd-4a0e-9c15-47285cba8cf7','2026-10-14',1),
      ('701a6429-7cdd-4a0e-9c15-47285cba8cf7','2026-10-15',2),
      ('701a6429-7cdd-4a0e-9c15-47285cba8cf7','2026-10-17',3),
      ('701a6429-7cdd-4a0e-9c15-47285cba8cf7','2026-10-18',1),
      ('7bcffbb1-4ca6-4106-b35a-d33b92bb8d20','2026-10-14',1),
      ('7bcffbb1-4ca6-4106-b35a-d33b92bb8d20','2026-10-16',1),
      ('7bcffbb1-4ca6-4106-b35a-d33b92bb8d20','2026-10-17',2),
      ('7bcffbb1-4ca6-4106-b35a-d33b92bb8d20','2026-10-18',2),
      ('d5020bf4-fd33-474a-bf95-0e5e345752e4','2026-10-17',2),
      ('d5020bf4-fd33-474a-bf95-0e5e345752e4','2026-10-18',2)
    ) v(venue_id,day,quantity)
    cross join lateral generate_series(1, v.quantity) g(ordinal)
    order by v.venue_id, v.day, g.ordinal
  loop
    n := n + 1;
    booking_id := ('d0192026-1019-4000-8000-' || lpad(n::text,12,'0'))::uuid;
    select * into strict slot from public.get_venue_availability(r.venue_id,r.day) a
    where a.court_id = (select id from courts where venue_id=r.venue_id and is_active order by sort_order,id limit 1)
      and (a.starts_at at time zone 'Asia/Ho_Chi_Minh')::time = time '18:00' + (r.ordinal-1)*interval '1 hour';
    if slot.price <= 0 or slot.ends_at > now() then raise exception 'Invalid historical priced slot'; end if;
    select * into strict actor from profiles where id=demo_ids[1 + (n-1)%5];

    select * into existing from bookings where id=booking_id;
    if found then
      if existing.note is distinct from 'Docs 2026-10-19 · Dữ liệu demo, không phải giao dịch ngân hàng'
        or existing.court_id <> slot.court_id or existing.starts_at <> slot.starts_at
        or existing.ends_at <> slot.ends_at or existing.status <> 'completed'
        or existing.user_id <> actor.id or existing.total_amount <> slot.price
        or existing.deposit_amount <> slot.price then raise exception 'Import ID conflict'; end if;
      continue;
    end if;
    if exists(select 1 from bookings b where b.court_id=slot.court_id
      and b.status in ('pending','confirmed','completed')
      and tstzrange(b.starts_at,b.ends_at) && tstzrange(slot.starts_at,slot.ends_at))
      or exists(select 1 from court_closures x where x.court_id=slot.court_id
      and tstzrange(x.starts_at,x.ends_at) && tstzrange(slot.starts_at,slot.ends_at)) then
      raise exception 'Historical slot occupied';
    end if;
    insert into bookings(id,code,court_id,user_id,starts_at,ends_at,total_amount,deposit_amount,
      status,refund_status,customer_name,customer_phone,note,expires_at)
    values(booking_id,'SAN' || public.gen_booking_code(),slot.court_id,actor.id,slot.starts_at,slot.ends_at,
      slot.price,slot.price,'completed','none',actor.full_name,coalesce(actor.phone,'0900000000'),
      'Docs 2026-10-19 · Dữ liệu demo, không phải giao dịch ngân hàng',slot.starts_at);
  end loop;
  if n <> 17 then raise exception 'Expected exactly 17 historical demo bookings'; end if;
end $$;

commit;
