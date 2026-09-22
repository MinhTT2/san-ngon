-- Bảng giá theo khung giờ cho chủ sân.
--
-- Máy tính giá (get_venue_availability, create_booking) đã đọc price_rules theo
-- priority từ đầu, và seed demo dùng đủ năm khung. Nhưng mọi đường tạo sân trong
-- app — create_venue, create_court, update_court — chỉ đẻ đúng một dòng
-- 'Giá chung' cho cả tuần, kèm ghi chú "chủ sân tách giờ vàng sau". Đây là phần
-- "sau" đó: sân đăng qua app cuối cùng cũng thu được giá giờ vàng.
--
-- Cách chồng giá giữ nguyên như get_venue_availability đang làm: 'Giá chung'
-- (priority 0) phủ toàn bộ giờ mở cửa, các khung đặc biệt (priority 10) đè lên.

create or replace function public.set_court_price_rules(p_court_id uuid, p_rules jsonb)
returns setof price_rules
language plpgsql security definer set search_path = public as $$
declare
  v_open  time;
  v_close time;
  v_count int;
begin
  -- Giờ hiệu lực của sân con: giờ riêng nếu có, không thì theo cụm.
  select coalesce(c.open_time, v.open_time), coalesce(c.close_time, v.close_time)
    into v_open, v_close
  from courts c join venues v on v.id = c.venue_id
  where c.id = p_court_id and v.owner_id = auth.uid();
  if not found then raise exception 'COURT_NOT_FOUND'; end if;

  if p_rules is null or jsonb_typeof(p_rules) <> 'array' then raise exception 'RULES_INVALID'; end if;
  v_count := jsonb_array_length(p_rules);
  if v_count > 12 then raise exception 'TOO_MANY_RULES'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_rules) r
    where coalesce(trim(r->>'label'), '') = '' or length(trim(r->>'label')) > 60
  ) then raise exception 'LABEL_REQUIRED'; end if;

  -- days phải là mảng số 0..6, không rỗng, không trùng.
  if exists (
    select 1 from jsonb_array_elements(p_rules) r
    where jsonb_typeof(r->'days') <> 'array'
       or jsonb_array_length(r->'days') between 0 and 0
       or jsonb_array_length(r->'days') > 7
       or exists (select 1 from jsonb_array_elements_text(r->'days') d where d !~ '^[0-6]$')
       or (select count(distinct d) from jsonb_array_elements_text(r->'days') d) <> jsonb_array_length(r->'days')
  ) then raise exception 'DAYS_INVALID'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_rules) r
    where coalesce(r->>'start_time', '') !~ '^[0-2][0-9]:[0-5][0-9]$'
       or coalesce(r->>'end_time', '')   !~ '^[0-2][0-9]:[0-5][0-9]$'
       or (r->>'end_time')::time <= (r->>'start_time')::time
  ) then raise exception 'TIME_INVALID'; end if;

  -- Khung nằm ngoài giờ mở cửa thì không bao giờ áp được: chặn luôn cho chủ sân
  -- biết, thay vì để họ nhập xong tưởng đã xong việc.
  if exists (
    select 1 from jsonb_array_elements(p_rules) r
    where (r->>'start_time')::time < v_open or (r->>'end_time')::time > v_close
  ) then raise exception 'OUTSIDE_HOURS'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_rules) r
    where coalesce(r->>'price_per_hour', '') !~ '^[0-9]+$'
       or (r->>'price_per_hour')::int < 1000 or (r->>'price_per_hour')::int > 10000000
  ) then raise exception 'PRICE_RANGE'; end if;

  -- Hai khung cùng priority mà đè nhau thì get_venue_availability chọn cái đắt
  -- hơn — đúng luật nhưng chủ sân không đoán được. Bắt sửa ngay tại đây.
  if exists (
    with r as (
      select ordinality as idx,
             (value->>'start_time')::time as st,
             (value->>'end_time')::time   as et,
             array(select d::int from jsonb_array_elements_text(value->'days') d) as days
      from jsonb_array_elements(p_rules) with ordinality
    )
    select 1 from r a join r b on b.idx > a.idx
    where a.days && b.days and a.st < b.et and b.st < a.et
  ) then raise exception 'RULES_OVERLAP'; end if;

  delete from price_rules where court_id = p_court_id and priority > 0;

  insert into price_rules (court_id, label, days, start_time, end_time, price_per_hour, priority)
  select p_court_id, trim(r->>'label'),
         array(select d::int from jsonb_array_elements_text(r->'days') d),
         (r->>'start_time')::time, (r->>'end_time')::time,
         (r->>'price_per_hour')::int, 10
  from jsonb_array_elements(p_rules) r;

  return query select * from price_rules where court_id = p_court_id order by priority, start_time;
end $$;

revoke execute on function public.set_court_price_rules(uuid, jsonb) from public, anon;
grant execute on function public.set_court_price_rules(uuid, jsonb) to authenticated;
