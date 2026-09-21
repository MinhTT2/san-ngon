-- Hồ sơ chủ sân bắt buộc có giấy tờ kinh doanh trước khi chờ duyệt.
alter table venues add column if not exists business_license_path text;
alter table venues add column if not exists business_license_name text;

insert into storage.buckets (id, name, public)
values ('venue-documents', 'venue-documents', false)
on conflict (id) do update set public = false;

drop policy if exists venue_documents_insert on storage.objects;
create policy venue_documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'venue-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists venue_documents_select on storage.objects;
create policy venue_documents_select on storage.objects for select to authenticated
  using (bucket_id = 'venue-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists venue_documents_delete on storage.objects;
create policy venue_documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'venue-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop function if exists register_venue(text, text, text, text, text, time, time, jsonb, text, text);

create or replace function register_venue(
  p_name text, p_address text, p_district text, p_phone text,
  p_description text, p_open_time time, p_close_time time,
  p_sports jsonb,
  p_business_license_path text, p_business_license_name text,
  p_payout_bank text, p_payout_account text
) returns venues
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_slug text; v_base text; v_try int := 0;
  v_venue venues%rowtype; v_court uuid; v_i int; v_sort_order int := 0;
  v_sport record;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'NAME_REQUIRED'; end if;
  if coalesce(trim(p_address),'') = '' then raise exception 'ADDRESS_REQUIRED'; end if;
  if coalesce(trim(p_phone),'') = '' then raise exception 'PHONE_REQUIRED'; end if;
  if p_close_time <= p_open_time then raise exception 'INVALID_HOURS'; end if;
  if coalesce(trim(p_business_license_path), '') = ''
     or coalesce(trim(p_business_license_name), '') = '' then
    raise exception 'BUSINESS_LICENSE_REQUIRED';
  end if;
  if p_business_license_path !~ ('^' || v_uid::text || '/[0-9a-f-]+\.(pdf|jpg|png)$') then
    raise exception 'BUSINESS_LICENSE_INVALID';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'venue-documents' and name = p_business_license_path
  ) then
    raise exception 'BUSINESS_LICENSE_MISSING';
  end if;

  if p_sports is null or jsonb_typeof(p_sports) <> 'array'
     or jsonb_array_length(p_sports) < 1 or jsonb_array_length(p_sports) > 6 then
    raise exception 'SPORT_REQUIRED';
  end if;
  if (select count(distinct item->>'sport') from jsonb_array_elements(p_sports) item)
     <> jsonb_array_length(p_sports) then
    raise exception 'SPORT_DUPLICATE';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_sports) item
    where coalesce(item->>'sport', '') not in ('football5','football7','football11','badminton','pickleball','tennis')
       or coalesce(item->>'court_count', '') !~ '^[0-9]+$'
       or coalesce(item->>'price_per_hour', '') !~ '^[0-9]+$'
  ) then
    raise exception 'SPORT_CONFIG_INVALID';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_sports) item
    where (item->>'court_count')::int < 1 or (item->>'court_count')::int > 20
       or (item->>'price_per_hour')::int < 1000 or (item->>'price_per_hour')::int > 10000000
  ) then
    raise exception 'SPORT_CONFIG_INVALID';
  end if;
  if (select coalesce(sum((item->>'court_count')::int), 0) from jsonb_array_elements(p_sports) item) > 20 then
    raise exception 'COURT_COUNT_RANGE';
  end if;

  -- Một tài khoản một cụm sân trong MVP. Cụm thứ hai chờ bản sau.
  if exists (select 1 from venues where owner_id = v_uid) then
    raise exception 'VENUE_EXISTS';
  end if;

  v_base := left(coalesce(nullif(slugify(p_name), ''), 'san'), 40);
  v_slug := v_base;
  while exists (select 1 from venues where slug = v_slug) loop
    v_try := v_try + 1;
    if v_try > 50 then raise exception 'SLUG_COLLISION'; end if;
    v_slug := v_base || '-' || v_try;
  end loop;

  insert into venues (owner_id, slug, name, address, district, phone, description,
                      business_license_path, business_license_name,
                      open_time, close_time, status)
  values (v_uid, v_slug, trim(p_name), trim(p_address), trim(p_district), trim(p_phone),
          nullif(trim(coalesce(p_description,'')),''), p_business_license_path,
          left(trim(p_business_license_name), 255), p_open_time, p_close_time, 'pending')
  returning * into v_venue;

  for v_sport in
    select sport::sport_type, court_count, price_per_hour
    from jsonb_to_recordset(p_sports) as s(sport text, court_count int, price_per_hour int)
  loop
    for v_i in 1..v_sport.court_count loop
      v_sort_order := v_sort_order + 1;
    insert into courts (venue_id, name, sport, slot_minutes, sort_order)
    values (v_venue.id, 'Sân ' || v_sort_order, v_sport.sport, 60, v_sort_order)
    returning id into v_court;

    -- Bảng giá khởi điểm: một mức cho cả tuần. Chủ sân tách giờ vàng sau.
    insert into price_rules (court_id, label, days, start_time, end_time, price_per_hour, priority)
    values (v_court, 'Giá chung', '{0,1,2,3,4,5,6}', p_open_time, p_close_time, v_sport.price_per_hour, 0);
    end loop;
  end loop;

  update profiles set
    role = 'owner',
    phone = coalesce(phone, trim(p_phone)),
    payout_bank = nullif(trim(coalesce(p_payout_bank,'')),''),
    payout_account = nullif(trim(coalesce(p_payout_account,'')),'')
  where id = v_uid;

  return v_venue;
end $$;
grant execute on function register_venue(text, text, text, text, text, time, time, jsonb, text, text, text, text) to authenticated;
