-- Chạy sau demo-roles.sql. Thay email chủ sân thật trước khi chạy.
do $$
declare
  v_owner_email text := 'owner@example.com';
  v_owner uuid;
  v_venue uuid;
  v_court uuid;
  i int;
begin
  if v_owner_email in ('owner@example.com', '') then raise exception 'Điền email chủ sân demo trước khi chạy.'; end if;
  select p.id into v_owner from profiles p join auth.users u on u.id = p.id
    where lower(u.email) = lower(trim(v_owner_email)) and p.role = 'owner';
  if v_owner is null then raise exception 'Chạy demo-roles.sql trước.'; end if;
  if exists (select 1 from venues where owner_id = v_owner) then raise notice 'Chủ sân đã có cụm sân; bỏ qua seed.'; return; end if;
  if exists (select 1 from venues where slug = 'san-demo') then raise exception 'Slug san-demo đã tồn tại.'; end if;
  insert into venues (owner_id, slug, name, address, district, phone, description, amenities, open_time, close_time, status)
  values (v_owner, 'san-demo', 'Sân Ngon Demo', 'Ngõ 5 Lê Đức Thọ', 'Nam Từ Liêm', '0987654321', 'Cỏ nhân tạo, đèn cao áp.', array['light','parking'], '05:00', '23:00', 'active')
  returning id into v_venue;
  for i in 1..2 loop
    insert into courts (venue_id, name, sport, surface, slot_minutes, is_indoor, sort_order)
    values (v_venue, 'Sân ' || i, 'football5', 'Cỏ nhân tạo', 60, i = 1, i) returning id into v_court;
    insert into price_rules (court_id, label, days, start_time, end_time, price_per_hour, priority) values
      (v_court, 'Giờ thường', '{0,1,2,3,4,5,6}', '05:00', '16:00', 200000, 0),
      (v_court, 'Giờ vàng', '{0,1,2,3,4,5,6}', '16:00', '21:00', 350000, 10),
      (v_court, 'Giờ đêm', '{0,1,2,3,4,5,6}', '21:00', '23:00', 250000, 0);
  end loop;
end $$;
