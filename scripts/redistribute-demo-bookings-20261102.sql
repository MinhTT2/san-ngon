-- One-off presentation fix explicitly requested on 02/11/2026: giãn 60 đơn demo
-- ra 14/10–01/11/2026, mỗi ngày 3–7 đơn (thêm 1 đơn vào 3 ngày thứ Bảy), giữ
-- nguyên mã đơn, sân, thời lượng, số tiền, trạng thái và khoảng cách giữa các
-- mốc created_at/paid_at/expires_at/cancelled_at với giờ chơi.
-- Chạy bằng quyền quản trị SQL sau khi đã sao lưu. Mặc định ROLLBACK; chỉ thay
-- đúng dòng ROLLBACK cuối bằng COMMIT khi đã duyệt kết quả.
-- Không chạy tự động khi deploy và không đăng ký làm migration.
begin isolation level repeatable read;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(2026110201);
select set_config('request.jwt.claim.sub',(select p.id::text from profiles p join auth.users u on u.id=p.id
 where p.role='admin' and u.email not like '%@example.invalid' and (p.banned_until is null or p.banned_until<=now())
 order by p.created_at limit 1),true);

do $$ begin
  if not is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
end $$;

-- Số phận dữ liệu phải giữ nguyên: số đơn, tiền, trạng thái, số bản ghi thanh toán.
create temp table baseline on commit drop as
 select count(*) as orders,
        coalesce(sum(total_amount),0) as total,
        coalesce(sum(deposit_amount),0) as deposit,
        count(*) filter (where status='completed') as completed,
        count(*) filter (where status='cancelled') as cancelled,
        (select count(*) from public.payments) as payments
 from public.bookings;

-- 19 ngày, 60 suất: 3 đơn/ngày, 3 ngày thứ Bảy (17/10, 24/10, 31/10) nhận 4 đơn.
create temp table target_slots (day date, slot int) on commit drop;
insert into target_slots (day, slot)
select d.day, s.n
from (values
  ('2026-10-14'::date,3),('2026-10-15',3),('2026-10-16',3),('2026-10-17',4),('2026-10-18',3),
  ('2026-10-19',3),('2026-10-20',3),('2026-10-21',3),('2026-10-22',3),('2026-10-23',3),
  ('2026-10-24',4),('2026-10-25',3),
  ('2026-10-26',3),('2026-10-27',3),('2026-10-28',3),('2026-10-29',3),('2026-10-30',3),
  ('2026-10-31',4),('2026-11-01',3)
) as d(day,n)
cross join lateral generate_series(1,d.n) as s(n);

do $$ begin
  if (select count(*) from target_slots) <> (select count(*) from public.bookings) then
    raise exception 'SLOT_COUNT_MISMATCH slots=% bookings=%',
      (select count(*) from target_slots),(select count(*) from public.bookings);
  end if;
end $$;

-- Ghép đơn theo thứ tự giờ chơi cũ với suất theo thứ tự ngày, để đơn cũ hơn
-- vẫn đứng trước và khoảng cách thanh toán → giờ chơi không đảo dấu.
create temp table plan (
  booking_id uuid primary key, court_id uuid, day date, slot int,
  open_hour int, close_hour int, prefer_hour int
) on commit drop;

insert into plan (booking_id, court_id, day, slot, open_hour, close_hour, prefer_hour)
select rb.id, rb.court_id, rs.day, rs.slot,
       extract(hour from coalesce(c.open_time, v.open_time))::int,
       extract(hour from coalesce(c.close_time, v.close_time))::int,
       extract(hour from (rb.starts_at at time zone 'Asia/Ho_Chi_Minh'))::int
from (select id, court_id, starts_at,
             row_number() over (order by starts_at, id) as rn
      from public.bookings) rb
join (select day, slot, row_number() over (order by day, slot) as rn
      from target_slots) rs on rs.rn = rb.rn
join public.courts c on c.id = rb.court_id
join public.venues v on v.id = c.venue_id;

-- Chọn giờ gần giờ chơi cũ nhất còn trống trong khung mở cửa của đúng sân đó.
create temp table chosen (booking_id uuid primary key, hour int) on commit drop;
create temp table placed (court_id uuid, day date, hour int, primary key (court_id, day, hour)) on commit drop;

do $$
declare
  r record;
  v_pref int;
  v_hour int;
begin
  for r in select * from plan order by day, slot loop
    v_pref := r.prefer_hour;
    if v_pref < r.open_hour or v_pref >= r.close_hour then
      v_pref := r.open_hour + ((r.slot * 3) % greatest(r.close_hour - r.open_hour, 1));
    end if;

    select h into v_hour
    from (select h, abs(h - v_pref) as distance, (h > v_pref) as later
          from generate_series(r.open_hour, r.close_hour - 1) as h) cand
    where not exists (select 1 from placed pl
                      where pl.court_id = r.court_id and pl.day = r.day and pl.hour = cand.h)
    order by cand.distance, cand.later
    limit 1;

    if v_hour is null then
      raise exception 'NO_FREE_HOUR booking=% day=%', r.booking_id, r.day;
    end if;

    insert into chosen (booking_id, hour) values (r.booking_id, v_hour);
    insert into placed (court_id, day, hour) values (r.court_id, r.day, v_hour);
  end loop;
end $$;

-- Dịch mọi mốc thời gian theo cùng một delta: thời lượng và thứ tự thời gian giữ nguyên.
create temp table shift on commit drop as
-- details_recorded_at và policy_recorded_at do trigger bất biến giữ, nên không dịch.
select b.id,
       b.starts_at as old_start, b.ends_at as old_end,
       b.created_at, b.paid_at, b.cancelled_at, b.expires_at,
       ((p.day::timestamp + make_interval(hours => ch.hour)) at time zone 'Asia/Ho_Chi_Minh') as new_start
from public.bookings b
join plan p on p.booking_id = b.id
join chosen ch on ch.booking_id = b.id;

update public.bookings b
set starts_at = s.new_start,
    ends_at = s.new_start + (s.old_end - s.old_start),
    created_at = s.created_at + (s.new_start - s.old_start),
    paid_at = s.paid_at + (s.new_start - s.old_start),
    cancelled_at = s.cancelled_at + (s.new_start - s.old_start),
    expires_at = s.expires_at + (s.new_start - s.old_start)
from shift s
where b.id = s.id;

update public.payments pm
set paid_at = pm.paid_at + (s.new_start - s.old_start),
    created_at = pm.created_at + (s.new_start - s.old_start)
from shift s
where pm.booking_id = s.id and pm.paid_at is not null;

do $$
declare
  b record; v record;
  v_days bigint; v_min_day date; v_max_day date; v_min_count bigint; v_max_count bigint;
  v_overlap bigint; v_outside bigint; v_bad_times bigint;
begin
  select * into b from baseline;
  select count(*) as orders,
         coalesce(sum(total_amount),0) as total,
         coalesce(sum(deposit_amount),0) as deposit,
         count(*) filter (where status='completed') as completed,
         count(*) filter (where status='cancelled') as cancelled,
         (select count(*) from public.payments) as payments
    into v from public.bookings;
  if v.orders <> b.orders or v.total <> b.total or v.deposit <> b.deposit
     or v.completed <> b.completed or v.cancelled <> b.cancelled or v.payments <> b.payments then
    raise exception 'BOOKING_FACTS_CHANGED';
  end if;

  select count(*), min(d), max(d), min(c), max(c)
    into v_days, v_min_day, v_max_day, v_min_count, v_max_count
  from (select (starts_at at time zone 'Asia/Ho_Chi_Minh')::date as d, count(*) as c
        from public.bookings group by 1) x;
  if v_days <> 19 or v_min_day <> date '2026-10-14' or v_max_day <> date '2026-11-01'
     or v_min_count < 3 or v_max_count > 7 then
    raise exception 'DISTRIBUTION_INVALID days=% min_day=% max_day=% min=% max=%',
      v_days, v_min_day, v_max_day, v_min_count, v_max_count;
  end if;

  select count(*) into v_overlap
  from public.bookings a join public.bookings c
    on c.court_id = a.court_id and c.id > a.id
   and tstzrange(a.starts_at, a.ends_at) && tstzrange(c.starts_at, c.ends_at);
  if v_overlap > 0 then raise exception 'COURT_OVERLAP %', v_overlap; end if;

  select count(*) into v_outside
  from public.bookings bk
  join public.courts c on c.id = bk.court_id
  join public.venues ve on ve.id = c.venue_id
  where (bk.starts_at at time zone 'Asia/Ho_Chi_Minh')::time < coalesce(c.open_time, ve.open_time)
     or (bk.ends_at at time zone 'Asia/Ho_Chi_Minh')::time > coalesce(c.close_time, ve.close_time);
  if v_outside > 0 then raise exception 'OUTSIDE_OPEN_HOURS %', v_outside; end if;

  select count(*) into v_bad_times
  from public.bookings
  where created_at >= starts_at
     or (paid_at is not null and paid_at >= starts_at)
     or (cancelled_at is not null and cancelled_at >= starts_at);
  if v_bad_times > 0 then raise exception 'TIMELINE_ORDER_BROKEN %', v_bad_times; end if;
end $$;

select jsonb_pretty(jsonb_build_object(
  'orders', (select count(*) from public.bookings),
  'first_start', (select min(starts_at) at time zone 'Asia/Ho_Chi_Minh' from public.bookings),
  'last_start', (select max(starts_at) at time zone 'Asia/Ho_Chi_Minh' from public.bookings),
  'per_day', (select jsonb_agg(x) from (
      select (starts_at at time zone 'Asia/Ho_Chi_Minh')::date as day, count(*) as orders
      from public.bookings group by 1 order by 1) x)
)) as result;

rollback;
