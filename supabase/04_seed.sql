-- ============================================================
-- Sân Ngon — 04. Seed
-- Demo duy nhất: điền email chủ sân trong SQL Editor sau demo-roles.sql.
-- Không gán lại chủ sân, không sửa dữ liệu hiện có khi chạy lại.
-- ============================================================
do $$
declare
  v_owner_email text := 'owner@example.com';
  v_owner uuid; v_venue uuid; v_court uuid; v_i int;
  v_rows text[][] := array[
    array['san-demo', 'Sân Ngon Demo', 'Hà Nội', 'Nam Từ Liêm', '2']
  ];
  v_row text[];
begin
  if v_owner_email in ('owner@example.com', '') then
    raise exception 'Điền email chủ sân demo trước khi chạy.';
  end if;
  select p.id into v_owner from public.profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower(trim(v_owner_email)) and p.role = 'owner';
  if v_owner is null then
    raise exception 'Không tìm thấy chủ sân. Chạy demo-roles.sql trước.';
  end if;
  if exists (select 1 from venues where owner_id = v_owner) then
    raise notice 'Chủ sân đã có cụm sân; giữ nguyên dữ liệu, bỏ qua seed.';
    return;
  end if;
  if exists (select 1 from venues where slug = 'san-demo') then
    raise exception 'Slug san-demo đã thuộc tài khoản khác; không chuyển chủ sân.';
  end if;

  foreach v_row slice 1 in array v_rows loop
    insert into venues (owner_id, slug, name, address, district, phone, description,
                        amenities, open_time, close_time, status)
    values (v_owner, v_row[1], v_row[2], v_row[3], v_row[4], '0987654321',
            'Cỏ nhân tạo, đèn cao áp, có mái che một phần.',
            array['light','parking','shower','canteen'], '05:00', '23:00', 'active')
    on conflict (slug) do nothing
    returning id into v_venue;

    continue when v_venue is null;

    for v_i in 1..(v_row[5])::int loop
      insert into courts (venue_id, name, sport, surface, slot_minutes, is_indoor, sort_order)
      values (v_venue, 'Sân ' || v_i, 'football5', 'Cỏ nhân tạo', 60, v_i = 1, v_i)
      returning id into v_court;

      insert into price_rules (court_id, label, days, start_time, end_time, price_per_hour, priority) values
        (v_court, 'Giờ thường',        '{1,2,3,4,5}', '05:00','16:00', 200000, 0),
        (v_court, 'Giờ vàng',          '{1,2,3,4,5}', '16:00','21:00', 350000, 10),
        (v_court, 'Giờ đêm',           '{1,2,3,4,5}', '21:00','23:00', 250000, 10),
        (v_court, 'Cuối tuần',         '{0,6}',       '05:00','16:00', 280000, 0),
        (v_court, 'Giờ vàng cuối tuần','{0,6}',       '16:00','23:00', 400000, 10);
    end loop;
    v_venue := null;
  end loop;
end $$;

-- Kiểm tra:
-- select * from get_venue_availability((select id from venues where slug='san-demo'), current_date + 1) limit 20;
