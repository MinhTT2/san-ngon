-- Duyệt người quản lý trước, sau đó họ mới tạo cụm sân và sân con.
alter table public.profiles
  add column if not exists owner_application_status text
    check (owner_application_status in ('pending', 'active', 'rejected')),
  add column if not exists business_license_path text,
  add column if not exists business_license_name text;

create index if not exists profiles_owner_application_idx
  on public.profiles (owner_application_status)
  where owner_application_status is not null;

create or replace function public.register_owner(
  p_full_name text,
  p_phone text,
  p_business_license_path text,
  p_business_license_name text,
  p_payout_bank text,
  p_payout_account text
) returns profiles
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profile profiles%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(trim(p_full_name), '') = '' then raise exception 'REPRESENTATIVE_REQUIRED'; end if;
  if coalesce(trim(p_phone), '') !~ '^0[0-9]{9}$' then raise exception 'PHONE_INVALID'; end if;
  if coalesce(trim(p_payout_bank), '') = '' or coalesce(trim(p_payout_account), '') = '' then
    raise exception 'PAYOUT_REQUIRED';
  end if;
  if trim(p_payout_account) !~ '^[0-9]{6,30}$' then raise exception 'PAYOUT_INVALID'; end if;
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
  ) then raise exception 'BUSINESS_LICENSE_MISSING'; end if;

  select * into v_profile from profiles where id = v_uid for update;
  if not found then raise exception 'PROFILE_REQUIRED'; end if;
  if v_profile.owner_application_status = 'pending' then raise exception 'OWNER_APPLICATION_EXISTS'; end if;
  if v_profile.owner_application_status = 'active' then raise exception 'OWNER_ALREADY_APPROVED'; end if;

  update profiles set
    full_name = trim(p_full_name), phone = trim(p_phone),
    payout_bank = trim(p_payout_bank), payout_account = trim(p_payout_account),
    business_license_path = p_business_license_path,
    business_license_name = left(trim(p_business_license_name), 255),
    owner_application_status = 'pending'
  where id = v_uid
  returning * into v_profile;
  return v_profile;
end $$;

grant execute on function public.register_owner(text, text, text, text, text, text) to authenticated;

create or replace function public.review_owner(p_owner_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles%rowtype;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status is null or p_status not in ('active', 'rejected') then raise exception 'INVALID_STATUS'; end if;
  select * into v_profile from profiles where id = p_owner_id for update;
  if not found then raise exception 'OWNER_NOT_FOUND'; end if;
  if coalesce(v_profile.owner_application_status, '') <> 'pending' then raise exception 'OWNER_ALREADY_REVIEWED'; end if;

  if p_status = 'active' then
    if length(trim(coalesce(v_profile.full_name, ''))) not between 2 and 120
       or coalesce(v_profile.phone, '') !~ '^0[0-9]{9}$' then
      raise exception 'REPRESENTATIVE_REQUIRED';
    end if;
    if not exists (
      select 1 from storage.objects
      where bucket_id = 'venue-documents' and name = v_profile.business_license_path
        and (storage.foldername(name))[1] = v_profile.id::text
    ) then raise exception 'BUSINESS_LICENSE_MISSING'; end if;
    if coalesce(trim(v_profile.payout_bank), '') = ''
       or coalesce(v_profile.payout_account, '') !~ '^[0-9]{6,30}$' then
      raise exception 'PAYOUT_REQUIRED';
    end if;
  end if;

  update profiles set
    owner_application_status = p_status,
    role = case when p_status = 'active' then 'owner'::user_role else role end
  where id = p_owner_id;

  if p_status = 'active' then
    insert into notifications (user_id, kind, channel, title, body)
    values (p_owner_id, 'venue_approved', 'app', 'Hồ sơ chủ sân đã được duyệt',
      'Bạn có thể bắt đầu tạo cụm sân và thêm các sân con của mình.');
  end if;
end $$;

grant execute on function public.review_owner(uuid, text) to authenticated;

drop function if exists public.register_venue(text, text, text, text, text, time, time, jsonb, text, text, text, text);

create or replace function public.create_venue(
  p_name text, p_address text, p_district text, p_phone text,
  p_description text, p_open_time time, p_close_time time,
  p_sports jsonb
) returns venues
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_slug text; v_base text; v_try int := 0;
  v_venue venues%rowtype; v_court uuid; v_i int; v_sort_order int := 0;
  v_sport record;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from profiles where id = v_uid and role = 'owner'
    and (owner_application_status = 'active' or owner_application_status is null)) then
    raise exception 'OWNER_NOT_APPROVED';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'NAME_REQUIRED'; end if;
  if coalesce(trim(p_address), '') = '' then raise exception 'ADDRESS_REQUIRED'; end if;
  if coalesce(trim(p_phone), '') !~ '^0[0-9]{9}$' then raise exception 'PHONE_INVALID'; end if;
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

  v_base := left(coalesce(nullif(slugify(p_name), ''), 'san'), 40);
  v_slug := v_base;
  while exists (select 1 from venues where slug = v_slug) loop
    v_try := v_try + 1;
    if v_try > 50 then raise exception 'SLUG_COLLISION'; end if;
    v_slug := v_base || '-' || v_try;
  end loop;

  insert into venues (owner_id, slug, name, address, district, phone, description, open_time, close_time, status)
  values (v_uid, v_slug, trim(p_name), trim(p_address), trim(p_district), trim(p_phone),
          nullif(trim(coalesce(p_description, '')), ''), p_open_time, p_close_time, 'active')
  returning * into v_venue;

  for v_sport in select sport::sport_type, court_count, price_per_hour
    from jsonb_to_recordset(p_sports) as s(sport text, court_count int, price_per_hour int)
  loop
    for v_i in 1..v_sport.court_count loop
      v_sort_order := v_sort_order + 1;
      insert into courts (venue_id, name, sport, slot_minutes, sort_order)
      values (v_venue.id, 'Sân ' || v_sort_order, v_sport.sport, 60, v_sort_order)
      returning id into v_court;
      insert into price_rules (court_id, label, days, start_time, end_time, price_per_hour, priority)
      values (v_court, 'Giá chung', '{0,1,2,3,4,5,6}', p_open_time, p_close_time, v_sport.price_per_hour, 0);
    end loop;
  end loop;
  return v_venue;
end $$;

grant execute on function public.create_venue(text, text, text, text, text, time, time, jsonb) to authenticated;
