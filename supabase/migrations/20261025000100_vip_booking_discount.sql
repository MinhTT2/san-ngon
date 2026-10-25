begin;

-- Separate from editable profile fields: a browser cannot promote itself to VIP.
create table public.user_vip_memberships (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  paid_until timestamptz,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.user_vip_memberships enable row level security;
revoke all on public.user_vip_memberships from public, anon, authenticated;
grant select on public.user_vip_memberships to authenticated;
create policy vip_read on public.user_vip_memberships for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create function public.admin_set_user_vip(p_user_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_enabled is null then raise exception 'INVALID_INPUT'; end if;
  if p_enabled then raise exception 'VIP_PAYMENT_REQUIRED'; end if;
  -- Same profile lock as create_booking: each booking sees one membership state.
  perform 1 from profiles where id = p_user_id for no key update;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  insert into user_vip_memberships(user_id,enabled,updated_by)
  values(p_user_id,p_enabled,auth.uid())
  on conflict(user_id) do update set enabled=excluded.enabled,
    updated_by=excluded.updated_by,updated_at=now();
  insert into operations_audit(actor_id,action,entity_id,details)
  values(auth.uid(),'user.vip_updated',p_user_id,jsonb_build_object('enabled',p_enabled));
end $$;
revoke all on function public.admin_set_user_vip(uuid,boolean) from public,anon;
grant execute on function public.admin_set_user_vip(uuid,boolean) to authenticated;

-- Round the discount down to whole VND; never round the deposit to thousands.
create function public.booking_vip_discount(p_user_id uuid, p_amount int)
returns int language sql stable security definer set search_path = public as $$
  select case when exists(select 1 from user_vip_memberships where user_id=p_user_id and enabled and paid_until>now())
    then floor(p_amount::numeric / 10)::int else 0 end;
$$;
revoke all on function public.booking_vip_discount(uuid,int) from public,anon,authenticated;

alter table public.bookings
  add column original_amount int,
  add column vip_discount_amount int not null default 0;
-- No historical price changes. Old orders have no VIP discount.
update public.bookings set original_amount=total_amount;
alter table public.bookings alter column original_amount set not null;
alter table public.bookings add constraint booking_vip_amounts check (
  original_amount > 0 and vip_discount_amount >= 0
  and total_amount = original_amount - vip_discount_amount
  and vip_discount_amount in (0, floor(original_amount::numeric / 10)::int)
);

create function public.preserve_booking_vip_price()
returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='INSERT' then
    new.original_amount:=coalesce(new.original_amount,new.total_amount+new.vip_discount_amount);
    return new;
  end if;
  if row(new.original_amount,new.vip_discount_amount,new.total_amount,new.deposit_amount)
    is distinct from row(old.original_amount,old.vip_discount_amount,old.total_amount,old.deposit_amount) then
    raise exception 'BOOKING_PRICE_IMMUTABLE';
  end if;
  return new;
end $$;
revoke all on function public.preserve_booking_vip_price() from public,anon,authenticated;
create trigger preserve_booking_vip_price before insert or update on public.bookings
  for each row execute function public.preserve_booking_vip_price();

create function public.get_booking_quote(p_court_id uuid,p_starts_at timestamptz,p_ends_at timestamptz)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_base int; v_discount int; v_covered numeric; v_count int; v_venue uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.account_active() then raise exception 'ACCOUNT_BANNED'; end if;
  if p_starts_at is null or p_ends_at is null or not isfinite(p_starts_at) or not isfinite(p_ends_at)
    or p_ends_at<=p_starts_at then raise exception 'INVALID_RANGE'; end if;
  if p_starts_at<=now() then raise exception 'SLOT_IN_PAST'; end if;
  select v.id into v_venue from venues v join courts c on c.venue_id=v.id
    where c.id=p_court_id and c.is_active and v.status='active'
      and p_starts_at<=now()+make_interval(days=>v.booking_horizon_days);
  if v_venue is null then raise exception 'COURT_NOT_FOUND'; end if;
  select coalesce(sum(a.price),0),coalesce(sum(extract(epoch from(a.ends_at-a.starts_at))),0),count(*)
    into v_base,v_covered,v_count
    from get_venue_availability(v_venue,(p_starts_at at time zone 'Asia/Ho_Chi_Minh')::date) a
    where a.court_id=p_court_id and a.starts_at>=p_starts_at and a.ends_at<=p_ends_at and a.is_available;
  if v_covered<>extract(epoch from(p_ends_at-p_starts_at)) then raise exception 'SLOT_TAKEN'; end if;
  if v_count>3 then raise exception 'TOO_MANY_SLOTS'; end if;
  if v_base<=0 then raise exception 'NO_PRICE_RULE'; end if;
  v_discount:=public.booking_vip_discount(auth.uid(),v_base);
  return jsonb_build_object('original_amount',v_base,'vip_discount_amount',v_discount,
    'total_amount',v_base-v_discount,'deposit_amount',v_base-v_discount);
end $$;
revoke all on function public.get_booking_quote(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_booking_quote(uuid,timestamptz,timestamptz) to authenticated;

-- The complete latest create_booking and admin_list_users definitions follow.

create or replace function public.create_booking(
  p_court_id uuid, p_starts_at timestamptz, p_ends_at timestamptz,
  p_customer_name text, p_customer_phone text, p_note text default null
) returns bookings
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_venue venues%rowtype;
  v_original int; v_discount int;
  v_total int; v_covered numeric; v_wanted numeric;
  v_deposit int; v_code text; v_row bookings%rowtype;
  v_try int := 0; v_pending int; v_slot_count bigint;
  c_max_pending constant int := 2;
  c_max_slots constant int := 3;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_starts_at is null or p_ends_at is null
    or not isfinite(p_starts_at) or not isfinite(p_ends_at)
    or p_ends_at <= p_starts_at then raise exception 'INVALID_RANGE'; end if;
  if p_starts_at <= now() then raise exception 'SLOT_IN_PAST'; end if;
  if coalesce(trim(p_customer_phone),'') = '' then raise exception 'PHONE_REQUIRED'; end if;
  if trim(p_customer_phone) !~ '^0[0-9]{9}$' then raise exception 'PHONE_INVALID'; end if;
  if char_length(trim(coalesce(p_customer_name, ''))) > 100 then raise exception 'NAME_TOO_LONG'; end if;
  if char_length(trim(coalesce(p_note, ''))) > 500 then raise exception 'NOTE_TOO_LONG'; end if;

  select v.* into v_venue
  from venues v join courts c on c.venue_id = v.id
  where c.id = p_court_id and c.is_active and v.status = 'active';
  if v_venue.id is null then raise exception 'COURT_NOT_FOUND'; end if;

  -- Chân trời đặt trước
  if p_starts_at > now() + make_interval(days => v_venue.booking_horizon_days) then
    raise exception 'TOO_FAR_AHEAD';
  end if;

  -- Serialize this user's hold limit. GiST still arbitrates overlaps between users.
  perform 1 from profiles where id = v_uid for no key update;
  -- Release stale holds before inserting: the GiST predicate intentionally has no clock.
  update bookings set status = 'cancelled', cancelled_at = now()
    where court_id = p_court_id and status = 'pending' and expires_at <= now();

  -- Tối đa 2 đơn đang chờ thanh toán, chặn người khóa hàng loạt khung giờ
  select count(*) into v_pending from bookings
  where user_id = v_uid and status = 'pending' and expires_at > now();
  if v_pending >= c_max_pending then raise exception 'TOO_MANY_PENDING'; end if;

  -- Cộng giá các khung còn trống nằm trọn trong khoảng đã chọn
  select coalesce(sum(a.price),0),
         coalesce(sum(extract(epoch from (a.ends_at - a.starts_at))),0), count(*)
    into v_total, v_covered, v_slot_count
  from get_venue_availability(v_venue.id, (p_starts_at at time zone 'Asia/Ho_Chi_Minh')::date) a
  where a.court_id = p_court_id
    and a.starts_at >= p_starts_at and a.ends_at <= p_ends_at
    and a.is_available;

  v_wanted := extract(epoch from (p_ends_at - p_starts_at));
  if v_covered <> v_wanted then raise exception 'SLOT_TAKEN'; end if;
  -- Count real SQL-provided slots: three 30-minute slots and three 120-minute
  -- slots are both allowed. The browser/API is not a business-rule boundary.
  if v_slot_count > c_max_slots then raise exception 'TOO_MANY_SLOTS'; end if;
  if v_total <= 0 then raise exception 'NO_PRICE_RULE'; end if;

  v_original := v_total;
  v_discount := public.booking_vip_discount(v_uid,v_original);
  v_total := v_original - v_discount;
  v_deposit := v_total;

  loop
    v_try := v_try + 1;
    v_code := 'SAN' || gen_booking_code();
    begin
      insert into bookings (code, court_id, user_id, starts_at, ends_at,
                            original_amount, vip_discount_amount, total_amount, deposit_amount, customer_name, customer_phone, note)
      values (v_code, p_court_id, v_uid, p_starts_at, p_ends_at,
              v_original, v_discount, v_total, v_deposit,
              nullif(trim(coalesce(p_customer_name,'')),''), trim(p_customer_phone), nullif(trim(coalesce(p_note, '')), ''))
      returning * into v_row;
      exit;
    exception
      when exclusion_violation then raise exception 'SLOT_TAKEN';
      when unique_violation then
        if v_try >= 5 then raise exception 'CODE_COLLISION'; end if;
    end;
  end loop;

  insert into payments (booking_id, amount, ref_code)
  values (v_row.id, v_deposit, v_row.code);

  -- Nhớ số điện thoại cho lần đặt sau
  update profiles set phone = trim(p_customer_phone) where id = v_uid;

  return v_row;
end $$;

revoke all on function public.create_booking(uuid, timestamptz, timestamptz, text, text, text) from public, anon;
grant execute on function public.create_booking(uuid, timestamptz, timestamptz, text, text, text) to authenticated;


create or replace function public.admin_list_users(p_search text, p_status text, p_role text, p_page int, p_sort text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_page is null or p_page < 1 or p_page > 100000 then raise exception 'INVALID_INPUT'; end if;
  if p_sort is null or p_sort not in ('newest','hours_desc','hours_asc') then raise exception 'INVALID_INPUT'; end if;
  with hours as (
    select user_id, sum(extract(epoch from (ends_at-starts_at))/60)::numeric as booked_minutes
    from bookings where status in ('confirmed','completed') group by user_id
  ), filtered as (
    select exists(select 1 from user_vip_memberships vip where vip.user_id=p.id and vip.enabled and vip.paid_until>now()) as is_vip, p.id, p.full_name, p.phone, p.role, p.created_at, coalesce(p.admin_sort_at, p.created_at) as sort_at, u.email,
      p.banned_until, p.ban_reason, p.banned_at, coalesce(h.booked_minutes,0) as booked_minutes,
      floor(a.total_seconds)::bigint as usage_seconds, a.tracking_started_at, a.last_active_at,
      coalesce(p.banned_until > now(), false) as is_banned
    from profiles p join auth.users u on u.id = p.id left join hours h on h.user_id=p.id left join user_activity_totals a on a.user_id=p.id
    where (coalesce(p_search, '') = '' or position(lower(trim(p_search)) in lower(concat_ws(' ', p.full_name, p.phone, u.email))) > 0)
      and (p_role = 'all' or p.role::text = p_role)
  ), matched as (
    select * from filtered where p_status = 'all'
      or (p_status = 'banned' and is_banned) or (p_status = 'active' and not is_banned)
  ), page as (select * from matched order by case when p_sort='hours_desc' then booked_minutes end desc, case when p_sort='hours_asc' then booked_minutes end asc, sort_at desc, id limit 20 offset (p_page - 1) * 20)
  select jsonb_build_object('users', coalesce((select jsonb_agg(to_jsonb(page) - 'sort_at' order by case when p_sort='hours_desc' then booked_minutes end desc, case when p_sort='hours_asc' then booked_minutes end asc, sort_at desc, id) from page), '[]'::jsonb),
    'total', (select count(*) from matched),
    'active', (select count(*) from filtered where not is_banned),
    'banned', (select count(*) from filtered where is_banned)) into v_result;
  return v_result;
end $$;


revoke all on function public.admin_list_users(text,text,text,int,text) from public, anon;
grant execute on function public.admin_list_users(text,text,text,int,text) to authenticated;

notify pgrst, 'reload schema';
commit;
