-- Closures are separate from customer bookings. Both writes lock the court row.
create table public.court_closures (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (char_length(reason) <= 200),
  exclude using gist (court_id with =, tstzrange(starts_at, ends_at) with &&)
);
alter table public.court_closures enable row level security;
create policy court_closures_owner_read on public.court_closures for select to authenticated
  using (public.owns_court(court_id));
revoke all on public.court_closures from public, anon, authenticated;
grant select on public.court_closures to authenticated;

create or replace function public.close_court(
  p_court_id uuid, p_date date, p_start_time time default null,
  p_end_time time default null, p_reason text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_start timestamptz; v_end timestamptz; v_id uuid;
begin
  perform 1 from courts c join venues v on v.id = c.venue_id
    where c.id = p_court_id and v.owner_id = auth.uid() for update of c;
  if not found then raise exception 'COURT_NOT_FOUND'; end if;
  if p_date is null or p_date < (now() at time zone 'Asia/Ho_Chi_Minh')::date
    or p_date > (now() at time zone 'Asia/Ho_Chi_Minh')::date + 365 then
    raise exception 'CLOSURE_DATE_INVALID';
  end if;
  if (p_start_time is null) <> (p_end_time is null)
    or p_end_time <= p_start_time then raise exception 'INVALID_HOURS'; end if;
  if char_length(p_reason) > 200 then raise exception 'CLOSURE_REASON_LONG'; end if;
  v_start := (p_date + coalesce(p_start_time, '00:00'::time)) at time zone 'Asia/Ho_Chi_Minh';
  v_end := case when p_end_time is null then (p_date + 1)::timestamp
    else p_date + p_end_time end at time zone 'Asia/Ho_Chi_Minh';
  if v_end <= now() then raise exception 'CLOSURE_DATE_INVALID'; end if;
  if exists (select 1 from bookings b where b.court_id = p_court_id
    and b.status in ('pending', 'confirmed')
    and tstzrange(b.starts_at, b.ends_at) && tstzrange(v_start, v_end)) then
    raise exception 'CLOSURE_HAS_BOOKINGS';
  end if;
  insert into court_closures (court_id, starts_at, ends_at, reason)
    values (p_court_id, v_start, v_end, nullif(trim(p_reason), '')) returning id into v_id;
  return v_id;
exception when exclusion_violation then raise exception 'CLOSURE_OVERLAP';
end $$;

create or replace function public.reopen_court(p_court_id uuid, p_closure_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform 1 from courts c join venues v on v.id = c.venue_id
    where c.id = p_court_id and v.owner_id = auth.uid() for update of c;
  if not found then raise exception 'COURT_NOT_FOUND'; end if;
  delete from court_closures where id = p_closure_id and court_id = p_court_id;
  if not found then raise exception 'CLOSURE_NOT_FOUND'; end if;
end $$;

-- A stale browser and concurrent create_booking cannot bypass a closure.
-- Keep bookings_no_overlap: this trigger only coordinates closures with bookings.
create or replace function public.check_booking_court_open()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('pending', 'confirmed') then
    perform 1 from courts where id = new.court_id for update;
    if exists (select 1 from court_closures x where x.court_id = new.court_id
      and tstzrange(x.starts_at, x.ends_at) && tstzrange(new.starts_at, new.ends_at)) then
      raise exception 'SLOT_TAKEN';
    end if;
  end if;
  return new;
end $$;
create trigger bookings_check_court_open before insert or update of court_id, starts_at, ends_at, status
  on public.bookings for each row execute function public.check_booking_court_open();

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
        select 1 from court_closures x where x.court_id = sl.court_id
          and tstzrange(x.starts_at, x.ends_at) && tstzrange(sl.starts_at, sl.ends_at)
      )
      and not exists (
      select 1 from bookings b
      where b.court_id = sl.court_id
        and b.status in ('pending','confirmed')
        and tstzrange(b.starts_at, b.ends_at) && tstzrange(sl.starts_at, sl.ends_at)
    )) as is_available
  from priced sl
  order by sl.sort_order, sl.court_name, sl.starts_at;
$$;


-- Owner-only view. Dates and all availability decisions stay in SQL.
create or replace function public.get_owner_court_schedule(p_court_id uuid, p_date date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_court courts%rowtype; v_venue venues%rowtype;
  v_date date := coalesce(p_date, (now() at time zone 'Asia/Ho_Chi_Minh')::date);
  v_start timestamptz; v_end timestamptz;
  v_days jsonb; v_slots jsonb; v_bookings jsonb; v_closures jsonb;
begin
  select c.* into v_court from courts c join venues v on v.id = c.venue_id
    where c.id = p_court_id and v.owner_id = auth.uid();
  if not found then raise exception 'COURT_NOT_FOUND'; end if;
  select * into v_venue from venues where id = v_court.venue_id;
  v_start := v_date::timestamp at time zone 'Asia/Ho_Chi_Minh';
  v_end := (v_date + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh';

  select coalesce(jsonb_agg(to_jsonb(d) order by d.date), '[]') into v_days from (
    select v_date + i as date,
      extract(isodow from v_date + i)::int as weekday,
      (select count(*) from get_venue_availability(v_court.venue_id, v_date + i) a
        where a.court_id = p_court_id and a.is_available) as free,
      (select count(*) from bookings b where b.court_id = p_court_id
        and b.status in ('pending','confirmed')
        and tstzrange(b.starts_at,b.ends_at) && tstzrange(
          (v_date + i)::timestamp at time zone 'Asia/Ho_Chi_Minh',
          (v_date + i + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh')) as booked,
      (select count(*) from court_closures x where x.court_id = p_court_id
        and tstzrange(x.starts_at,x.ends_at) && tstzrange(
          (v_date + i)::timestamp at time zone 'Asia/Ho_Chi_Minh',
          (v_date + i + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh')) as closed
    from generate_series(0, 6) i
  ) d;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.starts_at), '[]') into v_slots from (
    select a.starts_at, a.ends_at, a.price,
      case when exists (select 1 from bookings b where b.court_id = p_court_id
          and b.status = 'confirmed' and tstzrange(b.starts_at,b.ends_at) && tstzrange(a.starts_at,a.ends_at)) then 'confirmed'
        when exists (select 1 from bookings b where b.court_id = p_court_id
          and b.status = 'pending' and tstzrange(b.starts_at,b.ends_at) && tstzrange(a.starts_at,a.ends_at)) then 'pending'
        when exists (select 1 from court_closures x where x.court_id = p_court_id
          and tstzrange(x.starts_at,x.ends_at) && tstzrange(a.starts_at,a.ends_at)) then 'closed'
        when a.starts_at <= now() then 'past'
        when a.price <= 0 then 'unpriced'
        when a.is_available then 'free' else 'unavailable' end as status
    from get_venue_availability(v_court.venue_id, v_date) a where a.court_id = p_court_id
  ) s;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.starts_at), '[]') into v_bookings from (
    select code, starts_at, ends_at, status, customer_name, customer_phone
    from bookings where court_id = p_court_id
      and tstzrange(starts_at,ends_at) && tstzrange(v_start,v_end)
      and status <> 'cancelled'
  ) b;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_at), '[]') into v_closures from (
    select id, starts_at, ends_at, reason from court_closures where court_id = p_court_id
      and tstzrange(starts_at,ends_at) && tstzrange(v_start,v_end)
  ) x;
  return jsonb_build_object('date', v_date, 'today', (now() at time zone 'Asia/Ho_Chi_Minh')::date,
    'previous', v_date - 7, 'next', v_date + 7, 'last_closure_date', (now() at time zone 'Asia/Ho_Chi_Minh')::date + 365,
    'days', v_days, 'slots', v_slots, 'bookings', v_bookings, 'closures', v_closures);
end $$;

revoke all on function public.close_court(uuid,date,time,time,text),
  public.reopen_court(uuid,uuid), public.get_owner_court_schedule(uuid,date),
  public.check_booking_court_open() from public, anon;
grant execute on function public.close_court(uuid,date,time,time,text),
  public.reopen_court(uuid,uuid), public.get_owner_court_schedule(uuid,date) to authenticated;
