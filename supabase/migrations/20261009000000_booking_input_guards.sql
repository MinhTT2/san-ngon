-- Enforce booking input and the existing three-slot limit for direct RPC calls too.
-- Existing bookings, prices, payment receivers and cancellation terms are untouched.
begin;

create or replace function public.create_booking(
  p_court_id uuid, p_starts_at timestamptz, p_ends_at timestamptz,
  p_customer_name text, p_customer_phone text, p_note text default null
) returns bookings
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_venue venues%rowtype;
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

  v_deposit := v_total;

  loop
    v_try := v_try + 1;
    v_code := 'SAN' || gen_booking_code();
    begin
      insert into bookings (code, court_id, user_id, starts_at, ends_at,
                            total_amount, deposit_amount, customer_name, customer_phone, note)
      values (v_code, p_court_id, v_uid, p_starts_at, p_ends_at,
              v_total, v_deposit,
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

notify pgrst, 'reload schema';
commit;
