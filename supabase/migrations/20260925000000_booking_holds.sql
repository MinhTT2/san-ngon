-- Unpaid bookings hold a slot for 15 minutes; expiry must not depend on cron timing.
-- Only anonymous slot state is public, never booking IDs or customer details.
drop function public.get_venue_availability(uuid, date);
create or replace function get_venue_availability(p_venue_id uuid, p_date date)
returns table (
  court_id uuid, court_name text, sport sport_type, slot_minutes int,
  starts_at timestamptz, ends_at timestamptz, price int, is_available boolean,
  slot_status text, hold_expires_at timestamptz
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
      and occupied.status is null) as is_available,
    case when occupied.status = 'pending' then 'held'
      when occupied.status = 'confirmed' then 'booked'
      when sl.price <= 0 or sl.starts_at <= now()
        or sl.starts_at > now() + make_interval(days => sl.booking_horizon_days)
        or exists (select 1 from court_closures x where x.court_id = sl.court_id
          and tstzrange(x.starts_at, x.ends_at) && tstzrange(sl.starts_at, sl.ends_at))
        then 'unavailable'
      else 'available' end as slot_status,
    case when occupied.status = 'pending' then occupied.expires_at end as hold_expires_at
  from priced sl
  left join lateral (
    select b.status, b.expires_at from bookings b
    where b.court_id = sl.court_id
      and (b.status = 'confirmed' or (b.status = 'pending' and b.expires_at > now()))
      and tstzrange(b.starts_at, b.ends_at) && tstzrange(sl.starts_at, sl.ends_at)
    limit 1
  ) occupied on true
  order by sl.sort_order, sl.court_name, sl.starts_at;
$$;

revoke all on function get_venue_availability(uuid, date) from public;
grant execute on function get_venue_availability(uuid, date) to anon, authenticated;

create or replace function create_booking(
  p_court_id uuid, p_starts_at timestamptz, p_ends_at timestamptz,
  p_customer_name text, p_customer_phone text, p_note text default null
) returns bookings
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_venue venues%rowtype;
  v_total int; v_covered numeric; v_wanted numeric;
  v_deposit int; v_code text; v_row bookings%rowtype;
  v_try int := 0; v_pending int;
  c_max_pending constant int := 2;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_ends_at <= p_starts_at then raise exception 'INVALID_RANGE'; end if;
  if p_starts_at <= now() then raise exception 'SLOT_IN_PAST'; end if;
  if coalesce(trim(p_customer_phone),'') = '' then raise exception 'PHONE_REQUIRED'; end if;

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
         coalesce(sum(extract(epoch from (a.ends_at - a.starts_at))),0)
    into v_total, v_covered
  from get_venue_availability(v_venue.id, (p_starts_at at time zone 'Asia/Ho_Chi_Minh')::date) a
  where a.court_id = p_court_id
    and a.starts_at >= p_starts_at and a.ends_at <= p_ends_at
    and a.is_available;

  v_wanted := extract(epoch from (p_ends_at - p_starts_at));
  if v_covered <> v_wanted then raise exception 'SLOT_TAKEN'; end if;
  if v_total <= 0 then raise exception 'NO_PRICE_RULE'; end if;

  v_deposit := ceil(v_total * v_venue.deposit_pct / 100.0 / 1000)::int * 1000;

  loop
    v_try := v_try + 1;
    v_code := 'SAN' || gen_booking_code();
    begin
      insert into bookings (code, court_id, user_id, starts_at, ends_at,
                            total_amount, deposit_amount, customer_name, customer_phone, note)
      values (v_code, p_court_id, v_uid, p_starts_at, p_ends_at,
              v_total, v_deposit,
              nullif(trim(coalesce(p_customer_name,'')),''), trim(p_customer_phone), p_note)
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

create or replace function confirm_payment(
  p_ref_code text, p_amount int, p_bank_tx_id text, p_raw jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_payment payments%rowtype;
  v_booking bookings%rowtype;
  v_court courts%rowtype;
  v_venue venues%rowtype;
  v_owner profiles%rowtype;
begin
  if exists (select 1 from payments where bank_tx_id = p_bank_tx_id) then
    return jsonb_build_object('ok', true, 'reason', 'ALREADY_PROCESSED');
  end if;

  select * into v_payment from payments
  where ref_code = p_ref_code order by created_at desc limit 1;
  if v_payment.id is null then
    return jsonb_build_object('ok', false, 'reason', 'REF_NOT_FOUND');
  end if;

  select * into v_booking from bookings where id = v_payment.booking_id for update;

  -- A late webhook must never revive a slot that has already become available.
  if v_booking.status = 'pending' and v_booking.expires_at <= now() then
    update bookings set status = 'cancelled', cancelled_at = now() where id = v_booking.id;
    v_booking.status := 'cancelled';
  end if;

  if v_booking.status in ('cancelled','no_show') then
    update payments set bank_tx_id = p_bank_tx_id, raw = p_raw, status = 'failed'
     where id = v_payment.id;
    update bookings set refund_status = 'needed' where id = v_booking.id;
    return jsonb_build_object('ok', false, 'reason', 'BOOKING_CANCELLED', 'code', v_booking.code);
  end if;

  if v_booking.status in ('confirmed', 'completed') then
    update payments set bank_tx_id = p_bank_tx_id, raw = p_raw, status = 'paid', paid_at = now()
     where id = v_payment.id;
    return jsonb_build_object('ok', true, 'reason', 'ALREADY_CONFIRMED', 'code', v_booking.code);
  end if;

  if p_amount < v_payment.amount then
    update payments set bank_tx_id = p_bank_tx_id, raw = p_raw, status = 'pending'
     where id = v_payment.id;
    return jsonb_build_object('ok', false, 'reason', 'UNDERPAID',
      'expected', v_payment.amount, 'received', p_amount, 'code', v_booking.code);
  end if;

  update payments set status='paid', paid_at=now(), bank_tx_id=p_bank_tx_id, raw=p_raw
   where id = v_payment.id;
  update bookings set status='confirmed', paid_at=now() where id = v_booking.id;

  select * into v_court from courts where id = v_booking.court_id;
  select * into v_venue from venues where id = v_court.venue_id;
  select * into v_owner from profiles where id = v_venue.owner_id;

  -- Thông báo trong app cho cả hai bên
  insert into notifications (user_id, booking_id, kind, channel, title, body)
  values (v_booking.user_id, v_booking.id, 'deposit_paid', 'app',
          'Đã nhận cọc ' || v_booking.code,
          v_venue.name || ' — ' || v_court.name),
         (v_venue.owner_id, v_booking.id, 'new_booking', 'app',
          'Đơn mới ' || v_booking.code,
          v_court.name || ' · ' || v_booking.customer_phone);

  return jsonb_build_object(
    'ok', true, 'reason', 'CONFIRMED',
    'code', v_booking.code,
    'booking_id', v_booking.id,
    'owner_id', v_venue.owner_id,
    'court_name', v_court.name,
    'venue_name', v_venue.name,
    'starts_at', v_booking.starts_at,
    'ends_at', v_booking.ends_at,
    'total_amount', v_booking.total_amount,
    'deposit_amount', v_booking.deposit_amount,
    'customer_name', v_booking.customer_name,
    'customer_phone', v_booking.customer_phone,
    'owner_telegram_chat_id', v_owner.telegram_chat_id
  );
end $$;

create or replace function confirm_payment_manual(p_code text)
returns bookings
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_booking bookings%rowtype;
  v_court courts%rowtype;
  v_venue venues%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select b.* into v_booking
  from bookings b
  where b.code = p_code
    and exists (
      select 1 from courts c join venues v on v.id = c.venue_id
      where c.id = b.court_id and v.owner_id = v_uid
    )
  for update;

  if v_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;
  if v_booking.status <> 'pending' or v_booking.expires_at <= now() then raise exception 'NOT_PENDING'; end if;

  update bookings
  set status = 'confirmed', paid_at = coalesce(paid_at, now())
  where id = v_booking.id
  returning * into v_booking;

  update payments
  set status = 'paid', paid_at = coalesce(paid_at, now())
  where booking_id = v_booking.id and status = 'pending';

  select c.* into v_court from courts c where c.id = v_booking.court_id;
  select v.* into v_venue from venues v where v.id = v_court.venue_id;

  insert into notifications (user_id, booking_id, kind, channel, title, body)
  values
    (v_booking.user_id, v_booking.id, 'deposit_paid', 'app',
     'Đã nhận cọc ' || v_booking.code,
     v_venue.name || ' — ' || v_court.name),
    (v_venue.owner_id, v_booking.id, 'new_booking', 'app',
     'Đã xác nhận tay ' || v_booking.code,
     v_court.name || ' · ' || v_booking.customer_phone);

  return v_booking;
end $$;

drop function public.cancel_booking(text);
create or replace function cancel_booking(p_code text, p_pending_only boolean default false)
returns bookings
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_booking bookings%rowtype;
  v_is_owner boolean;
  v_row bookings%rowtype;
  c_window constant interval := interval '2 hours';
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_booking from bookings where code = p_code for update;
  if v_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;

  v_is_owner := owns_court(v_booking.court_id);
  if v_booking.user_id <> v_uid and not v_is_owner then
    raise exception 'BOOKING_NOT_FOUND';   -- không tiết lộ đơn của người khác có tồn tại
  end if;

  if p_pending_only and v_booking.status <> 'pending' then
    raise exception 'NOT_CANCELLABLE';
  end if;
  if v_booking.status not in ('pending','confirmed') then
    raise exception 'NOT_CANCELLABLE';
  end if;

  update bookings set
    status = 'cancelled',
    cancelled_at = now(),
    refund_status = case
      -- Chưa trả cọc thì không có gì để hoàn.
      when v_booking.status = 'pending' then 'none'::refund_status
      -- Chủ sân hủy thì khách luôn được hoàn, bất kể còn bao lâu.
      when v_is_owner and v_booking.user_id <> v_uid then 'needed'::refund_status
      when v_booking.starts_at - now() >= c_window then 'needed'::refund_status
      else 'none'::refund_status
    end
  where id = v_booking.id
  returning * into v_row;

  return v_row;
end $$;
revoke all on function cancel_booking(text, boolean) from public, anon;
grant execute on function cancel_booking(text, boolean) to authenticated;

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
        and (b.status = 'confirmed' or (b.status = 'pending' and b.expires_at > now()))
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
          and b.status = 'pending' and b.expires_at > now() and tstzrange(b.starts_at,b.ends_at) && tstzrange(a.starts_at,a.ends_at)) then 'pending'
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
      and status <> 'cancelled' and (status <> 'pending' or expires_at > now())
  ) b;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_at), '[]') into v_closures from (
    select id, starts_at, ends_at, reason from court_closures where court_id = p_court_id
      and tstzrange(starts_at,ends_at) && tstzrange(v_start,v_end)
  ) x;
  return jsonb_build_object('date', v_date, 'today', (now() at time zone 'Asia/Ho_Chi_Minh')::date,
    'previous', v_date - 7, 'next', v_date + 7, 'last_closure_date', (now() at time zone 'Asia/Ho_Chi_Minh')::date + 365,
    'days', v_days, 'slots', v_slots, 'bookings', v_bookings, 'closures', v_closures);
end $$;

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
    and (b.status = 'confirmed' or (b.status = 'pending' and b.expires_at > now()))
    and tstzrange(b.starts_at, b.ends_at) && tstzrange(v_start, v_end)) then
    raise exception 'CLOSURE_HAS_BOOKINGS';
  end if;
  insert into court_closures (court_id, starts_at, ends_at, reason)
    values (p_court_id, v_start, v_end, nullif(trim(p_reason), '')) returning id into v_id;
  return v_id;
exception when exclusion_violation then raise exception 'CLOSURE_OVERLAP';
end $$;

-- Bookings must be created through the server-priced RPC, not direct REST inserts.
drop policy if exists bookings_insert_own on bookings;

-- Keep the background cleanup for lists/realtime; availability is correct even if it is late.
create extension if not exists pg_cron;
select cron.schedule('expire-pending-bookings', '* * * * *',
  'select public.expire_pending_bookings()');
notify pgrst, 'reload schema';
