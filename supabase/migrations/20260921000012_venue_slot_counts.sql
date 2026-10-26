-- Exclude unpriced slots and slots beyond the booking horizon from availability.
create or replace function get_venue_availability(p_venue_id uuid, p_date date)
returns table (
  court_id uuid, court_name text, sport sport_type, slot_minutes int,
  starts_at timestamptz, ends_at timestamptz, price int, is_available boolean
)
language sql stable security definer set search_path = public as $$
  with v as (
    select id, open_time, close_time, booking_horizon_days from venues
    where id = p_venue_id and status = 'active'
  ),
  c as (
    select id, name, sport, slot_minutes, open_time, close_time, sort_order
    from courts where venue_id = p_venue_id and is_active
  ),
  slots as (
    select c.id as court_id, c.name as court_name, c.sport, c.slot_minutes, c.sort_order,
           s as starts_at,
           s + make_interval(mins => c.slot_minutes) as ends_at
    from c cross join v
    cross join lateral generate_series(
      ((p_date + coalesce(c.open_time, v.open_time)) at time zone 'Asia/Ho_Chi_Minh'),
      ((p_date + coalesce(c.close_time, v.close_time)
        + case when coalesce(c.close_time, v.close_time) <= coalesce(c.open_time, v.open_time)
               then interval '1 day' else interval '0' end
       ) at time zone 'Asia/Ho_Chi_Minh') - make_interval(mins => c.slot_minutes),
      make_interval(mins => c.slot_minutes)
    ) as s
  )
  , priced as (
  select sl.*, v.booking_horizon_days,
    coalesce((
      select round(pr.price_per_hour * sl.slot_minutes / 60.0)::int
      from price_rules pr
      where pr.court_id = sl.court_id
        and extract(dow from (sl.starts_at at time zone 'Asia/Ho_Chi_Minh'))::int = any(pr.days)
        and (sl.starts_at at time zone 'Asia/Ho_Chi_Minh')::time >= pr.start_time
        and (sl.starts_at at time zone 'Asia/Ho_Chi_Minh')::time <  pr.end_time
      order by pr.priority desc, pr.price_per_hour desc limit 1
    ), 0)::int as price
  from slots sl cross join v
  )
  select sl.court_id, sl.court_name, sl.sport, sl.slot_minutes, sl.starts_at, sl.ends_at, sl.price,
    (sl.price > 0 and sl.starts_at > now()
      and sl.starts_at <= now() + make_interval(days => sl.booking_horizon_days)
      and not exists (
      select 1 from bookings b
      where b.court_id = sl.court_id
        and b.status in ('pending','confirmed')
        and tstzrange(b.starts_at, b.ends_at) && tstzrange(sl.starts_at, sl.ends_at)
    )) as is_available
  from priced sl
  order by sl.sort_order, sl.court_name, sl.starts_at;
$$;

-- One batch for the venue cards, using the same priced slots as checkout.
create or replace function public.get_venue_slot_counts(
  p_venue_ids uuid[], p_date date default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  p_sport sport_type default null
) returns table (venue_id uuid, available_date date, available_slots bigint)
language sql stable security definer set search_path = public as $$
  select v.id, p_date, (
    select count(*) from public.get_venue_availability(v.id, p_date) a
    where a.is_available and (p_sport is null or a.sport = p_sport)
  )
  from public.venues v
  where v.id = any(p_venue_ids) and v.status = 'active';
$$;

revoke all on function public.get_venue_slot_counts(uuid[], date, sport_type) from public;

grant execute on function public.get_venue_slot_counts(uuid[], date, sport_type) to anon, authenticated;
