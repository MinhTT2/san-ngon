-- A new venue stays private until its owner adds a useful photo set.
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
          nullif(trim(coalesce(p_description, '')), ''), p_open_time, p_close_time, 'draft')
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

create or replace function public.set_venue_images(p_venue_id uuid, p_images text[], p_expected text[])
returns text[] language plpgsql security definer set search_path = public as $$
declare v_venue venues%rowtype; v_path text;
begin
  select * into v_venue from venues where id = p_venue_id and owner_id = auth.uid() for update;
  if not found then raise exception 'VENUE_NOT_FOUND'; end if;
  if v_venue.status = 'draft' and not exists (
    select 1 from profiles where id = auth.uid() and role = 'owner' and owner_application_status = 'active'
  ) then raise exception 'OWNER_NOT_APPROVED'; end if;
  if p_expected is distinct from v_venue.images then raise exception 'IMAGES_CHANGED'; end if;
  if p_images is null or cardinality(p_images) < 3 or cardinality(p_images) > 8
    or cardinality(p_images) <> (select count(distinct p) from unnest(p_images) p) then
    raise exception 'IMAGES_REQUIRED';
  end if;
  foreach v_path in array p_images loop
    if v_path is null or v_path !~ ('^' || auth.uid()::text || '/' || p_venue_id::text || '/[0-9a-f-]{36}\.(webp|jpg|png)$')
      or not exists (select 1 from storage.objects o where o.bucket_id = 'venue-photos' and o.name = v_path
        and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')
        and (o.metadata->>'size')::bigint between 1 and 5242880) then
      raise exception 'IMAGES_INVALID';
    end if;
  end loop;
  update venues set images = p_images,
    status = case when status = 'draft' then 'active' else status end
    where id = p_venue_id;
  return p_images;
end $$;

-- A draft can only become public through the photo RPC above.
create or replace function public.require_venue_photos_before_publish()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'draft' and new.status = 'active' and cardinality(coalesce(new.images, '{}')) < 3 then
    raise exception 'IMAGES_REQUIRED';
  end if;
  return new;
end $$;
drop trigger if exists venues_require_photos_before_publish on public.venues;
create trigger venues_require_photos_before_publish
before update of status on public.venues
for each row execute function public.require_venue_photos_before_publish();

grant execute on function public.set_venue_images(uuid,text[],text[]) to authenticated;
