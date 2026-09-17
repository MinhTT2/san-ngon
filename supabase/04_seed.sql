-- ============================================================
-- Sân Ngon — 04. Seed
-- Chạy SAU khi đã đăng nhập ít nhất 1 lần. Thay bằng sân thật ngày 27/09.
-- ============================================================
do $$
declare
  v_owner uuid; v_venue uuid; v_court uuid; v_i int;
  v_rows text[][] := array[
    array['san-my-dinh',    'Sân bóng Mỹ Đình',     'Ngõ 5 Lê Đức Thọ',   'Nam Từ Liêm', '4'],
    array['san-cau-giay',   'Sân Cầu Giấy Arena',   '92 Trần Thái Tông',  'Cầu Giấy',    '4'],
    array['san-thanh-xuan', 'Sân Thanh Xuân Center','283 Khuất Duy Tiến', 'Thanh Xuân',  '3'],
    array['san-bach-khoa',  'Sân Bách Khoa',        '17 Tạ Quang Bửu',    'Hai Bà Trưng','3'],
    array['san-long-bien',  'Sân Long Biên Sport',  '2 Ngọc Lâm',         'Long Biên',   '2']
  ];
  v_row text[];
begin
  select id into v_owner from profiles order by created_at limit 1;
  if v_owner is null then
    raise exception 'Chưa có user nào. Đăng nhập vào app một lần rồi chạy lại.';
  end if;
  update profiles set role = 'owner' where id = v_owner;

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
-- select * from get_venue_availability((select id from venues where slug='san-my-dinh'), current_date + 1) limit 20;
