-- Số liệu cho dashboard admin và chủ sân.
--
-- Hai trang này đang chỉ có vài ô đếm và mấy cái danh sách. Câu hỏi chủ sân hỏi
-- mỗi tuần — "tuần này thu hơn tuần trước không, khung nào đang ế" — thì không
-- trang nào trả lời được.
--
-- Một hàm dùng chung cho cả hai vai: p_venue_id null = toàn hệ thống (chỉ admin),
-- có id = một cụm sân (chủ sân của nó, hoặc admin).

create or replace function public.stats_can_read(p_venue_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_venue_id is null then public.is_admin()
    else public.is_admin() or exists (
      select 1 from venues where id = p_venue_id and owner_id = auth.uid()
    )
  end;
$$;

revoke execute on function public.stats_can_read(uuid) from public, anon;
grant execute on function public.stats_can_read(uuid) to authenticated;

-- ---------- Doanh thu theo ngày ----------
-- Tiền thật là payments đã trả, không phải total_amount của đơn: phần còn lại
-- khách trả tay tại sân, hệ thống không thấy nên không được tính vào.
create or replace function public.stats_revenue_daily(p_venue_id uuid default null, p_days int default 30)
returns table (ngay date, doanh_thu bigint, so_don int)
language plpgsql stable security definer set search_path = public as $$
declare v_days int := greatest(7, least(coalesce(p_days, 30), 180));
begin
  if not public.stats_can_read(p_venue_id) then raise exception 'FORBIDDEN'; end if;

  return query
  with days as (
    select generate_series(
      (now() at time zone 'Asia/Ho_Chi_Minh')::date - (v_days - 1),
      (now() at time zone 'Asia/Ho_Chi_Minh')::date,
      interval '1 day')::date as d
  ),
  paid as (
    select (p.paid_at at time zone 'Asia/Ho_Chi_Minh')::date as d,
           p.amount, b.id as booking_id
    from payments p
    join bookings b on b.id = p.booking_id
    join courts c   on c.id = b.court_id
    where p.paid_at is not null
      and p.status = 'success'
      and (p_venue_id is null or c.venue_id = p_venue_id)
  )
  select days.d,
         coalesce(sum(paid.amount), 0)::bigint,
         count(distinct paid.booking_id)::int
  from days left join paid on paid.d = days.d
  group by days.d
  order by days.d;
end $$;

-- ---------- Lưới lấp đầy: giờ × thứ ----------
-- Mẫu số là số lượt có thể bán: mỗi sân con, mỗi lần thứ đó xuất hiện trong kỳ,
-- nếu giờ đó nằm trong giờ mở cửa. Không có mẫu số thì "12 đơn lúc 19h" chẳng
-- nói lên điều gì — sân có 2 sân con khác hẳn sân có 10.
create or replace function public.stats_occupancy_grid(p_venue_id uuid default null, p_days int default 28)
returns table (thu int, gio int, so_don int, so_luot bigint, ty_le numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_days int := greatest(7, least(coalesce(p_days, 28), 120));
begin
  if not public.stats_can_read(p_venue_id) then raise exception 'FORBIDDEN'; end if;

  return query
  with span as (
    select ((now() at time zone 'Asia/Ho_Chi_Minh')::date - (v_days - 1)) as d0,
           (now() at time zone 'Asia/Ho_Chi_Minh')::date as d1
  ),
  ngay as (
    select d::date from span, generate_series(span.d0, span.d1, interval '1 day') d
  ),
  san as (
    select c.id, coalesce(c.open_time, v.open_time) as o, coalesce(c.close_time, v.close_time) as c_
    from courts c join venues v on v.id = c.venue_id
    where c.is_active and (p_venue_id is null or c.venue_id = p_venue_id)
  ),
  luot as (
    select extract(dow from ngay.d)::int as thu,
           g.h::int as gio,
           count(*)::bigint as so_luot
    from ngay cross join san
    cross join lateral generate_series(
      extract(hour from san.o)::int,
      extract(hour from san.c_)::int - 1) g(h)
    group by 1, 2
  ),
  don as (
    select extract(dow from (b.starts_at at time zone 'Asia/Ho_Chi_Minh'))::int as thu,
           extract(hour from (b.starts_at at time zone 'Asia/Ho_Chi_Minh'))::int as gio,
           count(*)::int as so_don
    from bookings b join courts c on c.id = b.court_id, span
    where b.status in ('confirmed', 'completed')
      and (b.starts_at at time zone 'Asia/Ho_Chi_Minh')::date between span.d0 and span.d1
      and (p_venue_id is null or c.venue_id = p_venue_id)
    group by 1, 2
  )
  select luot.thu, luot.gio,
         coalesce(don.so_don, 0),
         luot.so_luot,
         round(coalesce(don.so_don, 0)::numeric / nullif(luot.so_luot, 0), 4)
  from luot left join don on don.thu = luot.thu and don.gio = luot.gio
  order by luot.thu, luot.gio;
end $$;

-- ---------- Tóm tắt kỳ này so với kỳ trước ----------
create or replace function public.stats_summary(p_venue_id uuid default null, p_days int default 30)
returns table (
  doanh_thu bigint, doanh_thu_truoc bigint,
  so_don int, so_don_truoc int,
  so_don_huy int, ty_le_lap_day numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_days int := greatest(7, least(coalesce(p_days, 30), 180));
  v_d0 date; v_dp date;
begin
  if not public.stats_can_read(p_venue_id) then raise exception 'FORBIDDEN'; end if;
  v_d0 := (now() at time zone 'Asia/Ho_Chi_Minh')::date - (v_days - 1);
  v_dp := v_d0 - v_days;

  return query
  with paid as (
    select (p.paid_at at time zone 'Asia/Ho_Chi_Minh')::date as d, p.amount, b.id as bid
    from payments p join bookings b on b.id = p.booking_id join courts c on c.id = b.court_id
    where p.paid_at is not null and p.status = 'success'
      and (p_venue_id is null or c.venue_id = p_venue_id)
  ),
  huy as (
    select count(*)::int as n
    from bookings b join courts c on c.id = b.court_id
    where b.status in ('cancelled', 'no_show')
      and (b.starts_at at time zone 'Asia/Ho_Chi_Minh')::date >= v_d0
      and (p_venue_id is null or c.venue_id = p_venue_id)
  ),
  lap as (select coalesce(avg(ty_le), 0) as r from stats_occupancy_grid(p_venue_id, v_days))
  select
    (select coalesce(sum(amount), 0)::bigint from paid where d >= v_d0),
    (select coalesce(sum(amount), 0)::bigint from paid where d >= v_dp and d < v_d0),
    (select count(distinct bid)::int from paid where d >= v_d0),
    (select count(distinct bid)::int from paid where d >= v_dp and d < v_d0),
    (select n from huy),
    (select round(r, 4) from lap);
end $$;

revoke execute on function public.stats_revenue_daily(uuid, int)  from public, anon;
revoke execute on function public.stats_occupancy_grid(uuid, int) from public, anon;
revoke execute on function public.stats_summary(uuid, int)        from public, anon;
grant execute on function public.stats_revenue_daily(uuid, int)  to authenticated;
grant execute on function public.stats_occupancy_grid(uuid, int) to authenticated;
grant execute on function public.stats_summary(uuid, int)        to authenticated;
