-- ============================================================
-- Sân Ngon — 03. Business logic
-- Tính giá, chống trùng, xác nhận tiền: tất cả ở đây, không ở TypeScript.
-- ============================================================

-- Mã đơn 6 ký tự, bỏ O I 0 1 để đọc qua điện thoại không nhầm
create or replace function gen_booking_code()
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := ''; i int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random()*length(alphabet))::int, 1);
  end loop;
  return result;
end $$;

-- ------------------------------------------------------------
-- Lịch trống của cả cụm sân trong một ngày.
-- security definer: cần đọc bookings của người khác để biết khung nào bận,
-- nhưng chỉ trả boolean, không lộ thông tin đơn.
-- Giờ mở cửa lấy theo sân con, rỗng thì lấy theo cụm sân (coalesce).
-- ------------------------------------------------------------
create or replace function get_venue_availability(p_venue_id uuid, p_date date)
returns table (
  court_id uuid, court_name text, sport sport_type, slot_minutes int,
  starts_at timestamptz, ends_at timestamptz, price int, is_available boolean
)
language sql stable security definer set search_path = public as $$
  with v as (
    select id, open_time, close_time from venues
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
  select sl.court_id, sl.court_name, sl.sport, sl.slot_minutes, sl.starts_at, sl.ends_at,
    coalesce((
      select round(pr.price_per_hour * sl.slot_minutes / 60.0)::int
      from price_rules pr
      where pr.court_id = sl.court_id
        and extract(dow from (sl.starts_at at time zone 'Asia/Ho_Chi_Minh'))::int = any(pr.days)
        and (sl.starts_at at time zone 'Asia/Ho_Chi_Minh')::time >= pr.start_time
        and (sl.starts_at at time zone 'Asia/Ho_Chi_Minh')::time <  pr.end_time
      order by pr.priority desc, pr.price_per_hour desc limit 1
    ), 0)::int as price,
    (sl.starts_at > now() and not exists (
      select 1 from bookings b
      where b.court_id = sl.court_id
        and b.status in ('pending','confirmed')
        and tstzrange(b.starts_at, b.ends_at) && tstzrange(sl.starts_at, sl.ends_at)
    )) as is_available
  from slots sl
  order by sl.sort_order, sl.court_name, sl.starts_at;
$$;

-- ------------------------------------------------------------
-- Tạo đơn. Giá tính lại ở server. Không tin gì từ client.
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Webhook gọi hàm này qua service role. Idempotent theo bank_tx_id.
-- Trả về đủ dữ liệu để tầng ứng dụng gửi Telegram mà không phải truy vấn lại.
-- ------------------------------------------------------------
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

  if v_booking.status in ('cancelled','no_show') then
    update payments set bank_tx_id = p_bank_tx_id, raw = p_raw, status = 'failed'
     where id = v_payment.id;
    update bookings set refund_status = 'needed' where id = v_booking.id;
    return jsonb_build_object('ok', false, 'reason', 'BOOKING_CANCELLED', 'code', v_booking.code);
  end if;

  if v_booking.status = 'confirmed' then
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

-- ------------------------------------------------------------
-- Hủy đơn. Người đặt không được update thẳng bảng bookings (xem 02_rls.sql),
-- nên mọi đường hủy đi qua đây.
--
-- Hủy trước giờ đá >= c_window tiếng thì cọc được đánh dấu cần hoàn; muộn hơn
-- thì mất cọc. Mốc 2 tiếng CHƯA CHỐT với chủ sân — đổi hằng số ở đây và ở
-- CANCEL_WINDOW_HOURS trong lib/constants.ts cùng lúc.
-- ------------------------------------------------------------
create or replace function cancel_booking(p_code text)
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

-- ------------------------------------------------------------
-- Đăng ký cụm sân. Chạy trong một transaction: hồ sơ + các sân con + bảng giá
-- khởi điểm, cộng slug không trùng. Hồ sơ vào trạng thái 'pending' chờ duyệt,
-- chưa hiện ở /tim-san.
-- ------------------------------------------------------------
-- Bỏ dấu tiếng Việt không cần extension unaccent — giữ hàm tự viết để deploy
-- chỗ khác không phải bật thêm extension.
create or replace function unaccent_vi(p_text text)
returns text language sql immutable as $$
  select translate(p_text,
    'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyydAAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYYD');
$$;

create or replace function slugify(p_text text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(
    lower(unaccent_vi(p_text)), '[^a-z0-9]+', '-', 'g'));
$$;

-- Bản cũ nhận một môn duy nhất. Xóa overload cũ để client không thể bỏ qua
-- kiểm tra nhiều môn bằng cách gọi trực tiếp RPC cũ.
drop function if exists register_venue(text, text, text, text, text, time, time, sport_type, int, int, text, text);

create or replace function register_venue(
  p_name text, p_address text, p_district text, p_phone text,
  p_description text, p_open_time time, p_close_time time,
  p_sports jsonb,
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
                      open_time, close_time, status)
  values (v_uid, v_slug, trim(p_name), trim(p_address), trim(p_district), trim(p_phone),
          nullif(trim(coalesce(p_description,'')),''), p_open_time, p_close_time, 'pending')
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

-- ------------------------------------------------------------
-- Tác vụ nền
-- ------------------------------------------------------------
create or replace function expire_pending_bookings()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with x as (
    update bookings set status='cancelled', cancelled_at=now()
    where status='pending' and expires_at < now()
    returning 1
  ) select count(*) into n from x;
  return n;
end $$;

create or replace function complete_past_bookings()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with x as (
    update bookings set status='completed'
    where status='confirmed' and ends_at < now() - interval '1 hour'
    returning 1
  ) select count(*) into n from x;
  return n;
end $$;

-- ------------------------------------------------------------
-- Dự phòng khi webhook SePay hỏng. Chỉ chủ sân của đơn đó được xác nhận tay.
-- Không nhận số tiền từ client: chủ sân chỉ xác nhận khoản cọc đã nhận.
-- ------------------------------------------------------------
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
  if v_booking.status <> 'pending' then raise exception 'NOT_PENDING'; end if;

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

-- Chủ sân đánh dấu đã hoàn cọc sau khi chuyển khoản cho khách.
create or replace function mark_refund_done(p_code text)
returns bookings
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_booking bookings%rowtype;
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
  if v_booking.refund_status is distinct from 'needed'::refund_status then
    raise exception 'REFUND_NOT_NEEDED';
  end if;

  update bookings set refund_status = 'done'
  where id = v_booking.id
  returning * into v_booking;
  return v_booking;
end $$;

-- ------------------------------------------------------------
-- Hardening hồ sơ chủ sân. Đặt ở đây để khi cập nhật bản đang chạy chỉ cần
-- chạy lại file business logic (README đã hướng dẫn), không tạo hồ sơ trùng
-- nếu hai request đến cùng lúc và không cho chủ sân tự duyệt hồ sơ.
create unique index if not exists venues_one_per_owner_idx
  on venues (owner_id) where status in ('draft', 'pending');

drop policy if exists venues_owner_write on venues;
drop policy if exists venues_owner_update_pending on venues;
create policy venues_owner_update_pending on venues for update
  using (owner_id = auth.uid() and status = 'pending')
  with check (owner_id = auth.uid() and status = 'pending');

-- ------------------------------------------------------------
grant execute on function get_venue_availability(uuid, date) to anon, authenticated;
grant execute on function create_booking(uuid, timestamptz, timestamptz, text, text, text) to authenticated;
grant execute on function cancel_booking(text) to authenticated;
grant execute on function register_venue(text, text, text, text, text, time, time, jsonb, text, text) to authenticated;
revoke execute on function confirm_payment_manual(text) from public, anon;
grant execute on function confirm_payment_manual(text) to authenticated;
revoke execute on function mark_refund_done(text) from public, anon;
grant execute on function mark_refund_done(text) to authenticated;
-- Phải revoke khỏi PUBLIC, không chỉ anon/authenticated.
--
-- Postgres cấp EXECUTE cho PUBLIC trên mọi hàm mới, và anon kế thừa quyền đó.
-- Revoke riêng anon không gỡ được grant của PUBLIC, nên confirm_payment vẫn
-- gọi được bằng anon key: ai cũng tự xác nhận đơn của mình mà không trả đồng
-- nào. Đã kiểm chứng bằng has_function_privilege trên project thật.
revoke execute on function confirm_payment(text, int, text, jsonb) from public, anon, authenticated;
revoke execute on function expire_pending_bookings() from public, anon, authenticated;
revoke execute on function complete_past_bookings() from public, anon, authenticated;
revoke execute on function gen_booking_code() from public, anon, authenticated;
revoke execute on function owns_court(uuid) from public, anon;
grant execute on function confirm_payment(text, int, text, jsonb) to service_role;
