-- Số khung còn trống của nhiều cụm sân trong một lượt.
--
-- Trang chủ hứa "sân trống tối nay, biết ngay trong 10 giây" nhưng thẻ sân ở
-- /tim-san không nói gì về chỗ trống — phải mở từng sân ra mới biết.
--
-- Gọi lại get_venue_availability() qua lateral join thay vì chép lại phần sinh
-- khung giờ: toàn bộ chuyện múi giờ, slot_minutes và giờ mở cửa chỉ được có một
-- bản. Một lượt cho cả trang, không phải mỗi thẻ một vòng mạng.
create or replace function public.venues_free_slots(
  p_venue_ids uuid[],
  p_date date,
  p_peak_from int default 16,
  p_peak_to   int default 21
)
returns table (
  venue_id uuid,
  con_trong int,
  con_trong_gio_vang int,
  som_nhat timestamptz
)
language sql stable security definer set search_path = public as $$
  select v.id,
         count(*) filter (where a.is_available)::int,
         count(*) filter (
           where a.is_available
             and extract(hour from a.starts_at at time zone 'Asia/Ho_Chi_Minh')::int
                 between p_peak_from and p_peak_to - 1
         )::int,
         min(a.starts_at) filter (where a.is_available)
  from unnest(p_venue_ids) as v(id)
  cross join lateral get_venue_availability(v.id, p_date) a
  group by v.id;
$$;

revoke execute on function public.venues_free_slots(uuid[], date, int, int) from public;
-- Trang tìm sân là trang công khai, khách chưa đăng nhập cũng phải xem được.
grant execute on function public.venues_free_slots(uuid[], date, int, int) to anon, authenticated;
