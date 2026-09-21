-- Owner CRUD for venues and courts. Status remains admin-controlled.

-- All writes go through the validated RPCs below. RLS alone is not enough:
-- a direct browser insert/update would otherwise bypass the business checks.
revoke insert, update, delete on public.venues from public, anon, authenticated;
revoke insert, update, delete on public.courts from public, anon, authenticated;
revoke insert, update, delete on public.price_rules from public, anon, authenticated;

drop policy if exists venues_owner_update_pending on public.venues;
create policy venues_owner_update on public.venues for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create or replace function public.update_venue(
  p_venue_id uuid,
  p_name text,
  p_address text,
  p_district text,
  p_phone text,
  p_description text,
  p_open_time time,
  p_close_time time,
  p_deposit_pct int,
  p_booking_horizon_days int
) returns public.venues
language plpgsql security definer set search_path = public as $$
declare
  v_venue public.venues%rowtype;
begin
  select * into v_venue from public.venues
  where id = p_venue_id and owner_id = auth.uid() for update;
  if not found then raise exception 'VENUE_NOT_FOUND'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'NAME_REQUIRED'; end if;
  if length(trim(p_name)) > 120 then raise exception 'NAME_TOO_LONG'; end if;
  if coalesce(trim(p_address), '') = '' then raise exception 'ADDRESS_REQUIRED'; end if;
  if length(trim(p_address)) > 200 then raise exception 'ADDRESS_TOO_LONG'; end if;
  if coalesce(trim(p_district), '') = '' then raise exception 'DISTRICT_REQUIRED'; end if;
  if coalesce(trim(p_phone), '') !~ '^0[0-9]{9}$' then raise exception 'PHONE_INVALID'; end if;
  if p_close_time <= p_open_time then raise exception 'INVALID_HOURS'; end if;
  if p_deposit_pct < 0 or p_deposit_pct > 100 then raise exception 'DEPOSIT_INVALID'; end if;
  if p_booking_horizon_days < 1 or p_booking_horizon_days > 180 then raise exception 'HORIZON_INVALID'; end if;

  update public.venues set
    name = trim(p_name), address = trim(p_address), district = trim(p_district),
    phone = trim(p_phone), description = nullif(trim(coalesce(p_description, '')), ''),
    open_time = p_open_time, close_time = p_close_time,
    deposit_pct = p_deposit_pct, booking_horizon_days = p_booking_horizon_days
  where id = p_venue_id
  returning * into v_venue;

  -- Keep the generated "Giá chung" rule in sync when a court inherits venue hours.
  update public.price_rules pr set start_time = p_open_time, end_time = p_close_time
  from public.courts c
  where c.id = pr.court_id and c.venue_id = p_venue_id
    and c.open_time is null and c.close_time is null and pr.label = 'Giá chung';
  return v_venue;
end $$;

grant execute on function public.update_venue(uuid, text, text, text, text, text, time, time, int, int) to authenticated;

create or replace function public.delete_venue(p_venue_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.venues where id = p_venue_id and owner_id = auth.uid()) then
    raise exception 'VENUE_NOT_FOUND';
  end if;
  if exists (
    select 1 from public.bookings b join public.courts c on c.id = b.court_id
    where c.venue_id = p_venue_id
  ) then raise exception 'VENUE_HAS_BOOKINGS'; end if;
  delete from public.venues where id = p_venue_id and owner_id = auth.uid();
end $$;

grant execute on function public.delete_venue(uuid) to authenticated;

create or replace function public.create_court(
  p_venue_id uuid,
  p_name text,
  p_sport sport_type,
  p_surface text,
  p_is_indoor boolean,
  p_slot_minutes int,
  p_open_time time,
  p_close_time time,
  p_price_per_hour int
) returns public.courts
language plpgsql security definer set search_path = public as $$
declare
  v_venue public.venues%rowtype;
  v_court public.courts%rowtype;
  v_open time; v_close time; v_sort int;
begin
  select * into v_venue from public.venues where id = p_venue_id and owner_id = auth.uid();
  if not found then raise exception 'VENUE_NOT_FOUND'; end if;
  if v_venue.status = 'rejected' then raise exception 'VENUE_NOT_EDITABLE'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'COURT_NAME_REQUIRED'; end if;
  if length(trim(p_name)) > 80 then raise exception 'COURT_NAME_TOO_LONG'; end if;
  if exists (select 1 from public.courts where venue_id = p_venue_id and lower(name) = lower(trim(p_name))) then
    raise exception 'COURT_NAME_EXISTS';
  end if;
  if p_slot_minutes not in (30, 60, 90, 120) then raise exception 'SLOT_MINUTES_INVALID'; end if;
  if p_price_per_hour < 1000 or p_price_per_hour > 10000000 then raise exception 'PRICE_INVALID'; end if;
  if (p_open_time is null) <> (p_close_time is null) then raise exception 'COURT_HOURS_PAIR_REQUIRED'; end if;
  v_open := coalesce(p_open_time, v_venue.open_time);
  v_close := coalesce(p_close_time, v_venue.close_time);
  if v_close <= v_open then raise exception 'INVALID_HOURS'; end if;
  if p_open_time is not null and (p_open_time < v_venue.open_time or p_close_time > v_venue.close_time) then
    raise exception 'COURT_HOURS_OUTSIDE_VENUE';
  end if;
  select coalesce(max(sort_order), 0) + 1 into v_sort from public.courts where venue_id = p_venue_id;

  insert into public.courts (venue_id, name, sport, surface, is_indoor, slot_minutes, open_time, close_time, sort_order)
  values (p_venue_id, trim(p_name), p_sport, nullif(trim(coalesce(p_surface, '')), ''), coalesce(p_is_indoor, false),
          p_slot_minutes, p_open_time, p_close_time, v_sort)
  returning * into v_court;
  insert into public.price_rules (court_id, label, days, start_time, end_time, price_per_hour, priority)
  values (v_court.id, 'Giá chung', '{0,1,2,3,4,5,6}', v_open, v_close, p_price_per_hour, 0);
  return v_court;
end $$;

grant execute on function public.create_court(uuid, text, sport_type, text, boolean, int, time, time, int) to authenticated;

create or replace function public.update_court(
  p_court_id uuid,
  p_name text,
  p_sport sport_type,
  p_surface text,
  p_is_indoor boolean,
  p_slot_minutes int,
  p_open_time time,
  p_close_time time,
  p_is_active boolean,
  p_price_per_hour int
) returns public.courts
language plpgsql security definer set search_path = public as $$
declare
  v_court public.courts%rowtype;
  v_venue public.venues%rowtype;
  v_open time; v_close time;
begin
  select c.* into v_court
  from public.courts c join public.venues v on v.id = c.venue_id
  where c.id = p_court_id and v.owner_id = auth.uid();
  if not found then raise exception 'COURT_NOT_FOUND'; end if;
  select * into v_venue from public.venues where id = v_court.venue_id;
  if v_venue.status = 'rejected' then raise exception 'VENUE_NOT_EDITABLE'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'COURT_NAME_REQUIRED'; end if;
  if length(trim(p_name)) > 80 then raise exception 'COURT_NAME_TOO_LONG'; end if;
  if exists (select 1 from public.courts where venue_id = v_court.venue_id and id <> p_court_id and lower(name) = lower(trim(p_name))) then
    raise exception 'COURT_NAME_EXISTS';
  end if;
  if p_slot_minutes not in (30, 60, 90, 120) then raise exception 'SLOT_MINUTES_INVALID'; end if;
  if p_price_per_hour < 1000 or p_price_per_hour > 10000000 then raise exception 'PRICE_INVALID'; end if;
  if (p_open_time is null) <> (p_close_time is null) then raise exception 'COURT_HOURS_PAIR_REQUIRED'; end if;
  v_open := coalesce(p_open_time, v_venue.open_time);
  v_close := coalesce(p_close_time, v_venue.close_time);
  if v_close <= v_open then raise exception 'INVALID_HOURS'; end if;
  if p_open_time is not null and (p_open_time < v_venue.open_time or p_close_time > v_venue.close_time) then
    raise exception 'COURT_HOURS_OUTSIDE_VENUE';
  end if;

  update public.courts set name = trim(p_name), sport = p_sport,
    surface = nullif(trim(coalesce(p_surface, '')), ''), is_indoor = coalesce(p_is_indoor, false),
    slot_minutes = p_slot_minutes, open_time = p_open_time, close_time = p_close_time,
    is_active = coalesce(p_is_active, true)
  where id = p_court_id returning * into v_court;
  update public.price_rules set start_time = v_open, end_time = v_close, price_per_hour = p_price_per_hour
  where court_id = p_court_id and label = 'Giá chung';
  if not found then
    insert into public.price_rules (court_id, label, days, start_time, end_time, price_per_hour, priority)
    values (p_court_id, 'Giá chung', '{0,1,2,3,4,5,6}', v_open, v_close, p_price_per_hour, 0);
  end if;
  return v_court;
end $$;

grant execute on function public.update_court(uuid, text, sport_type, text, boolean, int, time, time, boolean, int) to authenticated;

create or replace function public.delete_court(p_court_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.courts c join public.venues v on v.id = c.venue_id
    where c.id = p_court_id and v.owner_id = auth.uid()
  ) then raise exception 'COURT_NOT_FOUND'; end if;
  if exists (select 1 from public.bookings where court_id = p_court_id) then
    raise exception 'COURT_HAS_BOOKINGS';
  end if;
  delete from public.courts where id = p_court_id;
end $$;

grant execute on function public.delete_court(uuid) to authenticated;
