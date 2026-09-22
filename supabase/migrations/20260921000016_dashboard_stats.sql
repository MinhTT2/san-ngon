-- Số liệu cho dashboard admin và chủ sân.
--
-- get_admin_stats()/get_owner_stats() (20260922000003) đã lo doanh thu, lấp đầy
-- và xếp hạng. Hàm dưới đây chỉ bù đúng phần chúng không có: lưới lấp đầy theo
-- giờ × thứ — thứ trả lời thẳng câu "khung nào đang ế mà hạ giá".
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


