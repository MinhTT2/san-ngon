-- Giữ các bất biến vận hành khi chủ sân sửa cụm và sân con.

-- Owner đã được duyệt là đủ để mở venue; dữ liệu demo cũ được backfill ở dưới.
update public.profiles
set owner_application_status = 'active'
where role = 'owner' and owner_application_status is null;

create or replace function public.validate_venue_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if length(trim(new.name)) not between 3 and 120 then raise exception 'NAME_INVALID'; end if;
  if length(trim(new.address)) not between 3 and 200 then raise exception 'ADDRESS_INVALID'; end if;
  if length(trim(new.district)) not between 2 and 60 then raise exception 'DISTRICT_REQUIRED'; end if;
  if new.phone is not null and trim(new.phone) !~ '^0[0-9]{9}$' then raise exception 'PHONE_INVALID'; end if;
  if new.description is not null and length(trim(new.description)) > 500 then
    raise exception 'DESCRIPTION_TOO_LONG';
  end if;
  return new;
end;
$$;

drop trigger if exists venues_validate_fields on public.venues;
create trigger venues_validate_fields
before insert or update of name, address, district, phone, description on public.venues
for each row execute function public.validate_venue_fields();

create or replace function public.require_active_venue_court()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  if tg_op = 'DELETE' then v_venue_id := old.venue_id; else v_venue_id := new.venue_id; end if;
  if exists (select 1 from public.venues where id = v_venue_id and status = 'active')
     and not exists (select 1 from public.courts where venue_id = v_venue_id and is_active) then
    raise exception 'VENUE_LAST_ACTIVE_COURT';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.require_active_venue_has_court()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'active'
     and not exists (select 1 from public.courts where venue_id = new.id and is_active) then
    raise exception 'VENUE_LAST_ACTIVE_COURT';
  end if;
  return new;
end;
$$;

drop trigger if exists courts_require_active_venue_court on public.courts;
create constraint trigger courts_require_active_venue_court
after insert or update or delete on public.courts
deferrable initially deferred
for each row execute function public.require_active_venue_court();

drop trigger if exists venues_require_active_court on public.venues;
create constraint trigger venues_require_active_court
after insert or update on public.venues
deferrable initially deferred
for each row execute function public.require_active_venue_has_court();

create or replace function public.require_profile_payout_for_active_venues()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.venues where owner_id = new.id and status = 'active')
     and (coalesce(trim(new.payout_bank), '') = ''
       or coalesce(trim(new.payout_account), '') !~ '^[0-9]{6,30}$') then
    raise exception 'PAYOUT_REQUIRED';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_require_payout on public.profiles;
create trigger profiles_require_payout
before update of payout_bank, payout_account on public.profiles
for each row execute function public.require_profile_payout_for_active_venues();

create or replace function public.create_venue(
  p_name text, p_address text, p_district text, p_phone text,
  p_description text, p_open_time time, p_close_time time,
  p_sports jsonb
) returns public.venues
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_slug text; v_base text; v_try int := 0;
  v_venue public.venues%rowtype; v_court uuid; v_i int := 0; v_sort_order int := 0;
  v_sport record;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.profiles where id = v_uid and role = 'owner'
      and owner_application_status = 'active'
  ) then raise exception 'OWNER_NOT_APPROVED'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'NAME_REQUIRED'; end if;
  if length(trim(p_name)) > 120 then raise exception 'NAME_TOO_LONG'; end if;
  if coalesce(trim(p_address), '') = '' then raise exception 'ADDRESS_REQUIRED'; end if;
  if length(trim(p_address)) > 200 then raise exception 'ADDRESS_TOO_LONG'; end if;
  if length(trim(coalesce(p_district, ''))) < 2 then raise exception 'DISTRICT_REQUIRED'; end if;
  if length(trim(coalesce(p_district, ''))) > 60 then raise exception 'DISTRICT_TOO_LONG'; end if;
  if coalesce(trim(p_phone), '') !~ '^0[0-9]{9}$' then raise exception 'PHONE_INVALID'; end if;
  if p_description is not null and length(trim(p_description)) > 500 then raise exception 'DESCRIPTION_TOO_LONG'; end if;
  if p_close_time <= p_open_time then raise exception 'INVALID_HOURS'; end if;
  if p_sports is null or jsonb_typeof(p_sports) <> 'array'
     or jsonb_array_length(p_sports) < 1 or jsonb_array_length(p_sports) > 6 then
    raise exception 'SPORT_REQUIRED';
  end if;
  if (select count(distinct item->>'sport') from jsonb_array_elements(p_sports) item) <> jsonb_array_length(p_sports) then
    raise exception 'SPORT_DUPLICATE';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_sports) item
    where coalesce(item->>'sport', '') not in ('football5','football7','football11','badminton','pickleball','tennis')
       or coalesce(item->>'court_count', '') !~ '^[0-9]+$'
       or coalesce(item->>'price_per_hour', '') !~ '^[0-9]+$'
       or (item->>'court_count')::int < 1 or (item->>'court_count')::int > 20
       or (item->>'price_per_hour')::int < 1000 or (item->>'price_per_hour')::int > 10000000
  ) then raise exception 'SPORT_CONFIG_INVALID'; end if;
  if (select coalesce(sum((item->>'court_count')::int), 0) from jsonb_array_elements(p_sports) item) > 20 then
    raise exception 'COURT_COUNT_RANGE';
  end if;

  v_base := left(coalesce(nullif(public.slugify(p_name), ''), 'san'), 40);
  v_slug := v_base;
  while exists (select 1 from public.venues where slug = v_slug) loop
    v_try := v_try + 1;
    if v_try > 50 then raise exception 'SLUG_COLLISION'; end if;
    v_slug := v_base || '-' || v_try;
  end loop;

  insert into public.venues (owner_id, slug, name, address, district, phone, description, open_time, close_time, status)
  values (v_uid, v_slug, trim(p_name), trim(p_address), trim(p_district), trim(p_phone),
          nullif(trim(coalesce(p_description, '')), ''), p_open_time, p_close_time, 'active')
  returning * into v_venue;

  for v_sport in select sport::public.sport_type, court_count, price_per_hour
    from jsonb_to_recordset(p_sports) as s(sport text, court_count int, price_per_hour int)
  loop
    for v_i in 1..v_sport.court_count loop
      v_sort_order := v_sort_order + 1;
      insert into public.courts (venue_id, name, sport, slot_minutes, sort_order)
      values (v_venue.id, 'Sân ' || v_sort_order, v_sport.sport, 60, v_sort_order)
      returning id into v_court;
      insert into public.price_rules (court_id, label, days, start_time, end_time, price_per_hour, priority)
      values (v_court, 'Giá chung', '{0,1,2,3,4,5,6}', p_open_time, p_close_time, v_sport.price_per_hour, 0);
    end loop;
  end loop;
  return v_venue;
end;
$$;

grant execute on function public.create_venue(text, text, text, text, text, time, time, jsonb) to authenticated;

create or replace function public.update_venue(
  p_venue_id uuid, p_name text, p_address text, p_district text, p_phone text,
  p_description text, p_open_time time, p_close_time time,
  p_deposit_pct int, p_booking_horizon_days int
) returns public.venues
language plpgsql security definer set search_path = public as $$
declare
  v_venue public.venues%rowtype;
begin
  select * into v_venue from public.venues
  where id = p_venue_id and owner_id = auth.uid() for update;
  if not found then raise exception 'VENUE_NOT_FOUND'; end if;
  if v_venue.status = 'rejected' then raise exception 'VENUE_NOT_EDITABLE'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'NAME_REQUIRED'; end if;
  if length(trim(p_name)) > 120 then raise exception 'NAME_TOO_LONG'; end if;
  if coalesce(trim(p_address), '') = '' then raise exception 'ADDRESS_REQUIRED'; end if;
  if length(trim(p_address)) > 200 then raise exception 'ADDRESS_TOO_LONG'; end if;
  if length(trim(coalesce(p_district, ''))) < 2 then raise exception 'DISTRICT_REQUIRED'; end if;
  if length(trim(coalesce(p_district, ''))) > 60 then raise exception 'DISTRICT_TOO_LONG'; end if;
  if coalesce(trim(p_phone), '') !~ '^0[0-9]{9}$' then raise exception 'PHONE_INVALID'; end if;
  if p_description is not null and length(trim(p_description)) > 500 then raise exception 'DESCRIPTION_TOO_LONG'; end if;
  if p_close_time <= p_open_time then raise exception 'INVALID_HOURS'; end if;
  if p_deposit_pct < 0 or p_deposit_pct > 100 then raise exception 'DEPOSIT_INVALID'; end if;
  if p_booking_horizon_days < 1 or p_booking_horizon_days > 180 then raise exception 'HORIZON_INVALID'; end if;

  if p_open_time is distinct from v_venue.open_time or p_close_time is distinct from v_venue.close_time then
    if exists (
      select 1 from public.courts c
      where c.venue_id = p_venue_id and c.open_time is not null
        and (c.open_time < p_open_time or c.close_time > p_close_time)
    ) then raise exception 'COURT_HOURS_OUTSIDE_VENUE'; end if;
    if exists (
      select 1
      from public.bookings b join public.courts c on c.id = b.court_id
      where c.venue_id = p_venue_id and b.status in ('pending', 'confirmed') and b.ends_at > now()
        and (
          (b.starts_at at time zone 'Asia/Ho_Chi_Minh')::time < p_open_time
          or (b.ends_at at time zone 'Asia/Ho_Chi_Minh')::time > p_close_time
        )
    ) then raise exception 'VENUE_HAS_FUTURE_BOOKINGS'; end if;
  end if;

  update public.venues set
    name = trim(p_name), address = trim(p_address), district = trim(p_district),
    phone = trim(p_phone), description = nullif(trim(coalesce(p_description, '')), ''),
    open_time = p_open_time, close_time = p_close_time,
    deposit_pct = p_deposit_pct, booking_horizon_days = p_booking_horizon_days
  where id = p_venue_id returning * into v_venue;

  update public.price_rules pr set start_time = p_open_time, end_time = p_close_time
  from public.courts c
  where c.id = pr.court_id and c.venue_id = p_venue_id
    and c.open_time is null and c.close_time is null and pr.label = 'Giá chung';
  return v_venue;
end;
$$;

grant execute on function public.update_venue(uuid, text, text, text, text, text, time, time, int, int) to authenticated;

create or replace function public.update_court(
  p_court_id uuid, p_name text, p_sport public.sport_type, p_surface text,
  p_is_indoor boolean, p_slot_minutes int, p_open_time time, p_close_time time,
  p_is_active boolean, p_price_per_hour int
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
  if exists (
    select 1 from public.bookings b
    where b.court_id = p_court_id and b.status in ('pending', 'confirmed') and b.ends_at > now()
      and (p_sport is distinct from v_court.sport
        or p_slot_minutes is distinct from v_court.slot_minutes
        or p_open_time is distinct from v_court.open_time
        or p_close_time is distinct from v_court.close_time
        or coalesce(p_is_active, true) is distinct from v_court.is_active)
  ) then raise exception 'COURT_HAS_FUTURE_BOOKINGS'; end if;

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
end;
$$;

grant execute on function public.update_court(uuid, text, public.sport_type, text, boolean, int, time, time, boolean, int) to authenticated;

create or replace function public.delete_court(p_court_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_court public.courts%rowtype;
begin
  select c.* into v_court
  from public.courts c join public.venues v on v.id = c.venue_id
  where c.id = p_court_id and v.owner_id = auth.uid();
  if not found then raise exception 'COURT_NOT_FOUND'; end if;
  if exists (select 1 from public.bookings where court_id = p_court_id) then
    raise exception 'COURT_HAS_BOOKINGS';
  end if;
  delete from public.courts where id = p_court_id;
end;
$$;

grant execute on function public.delete_court(uuid) to authenticated;
