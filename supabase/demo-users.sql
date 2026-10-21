-- Manual demo data, never a schema migration.
-- Run: npx supabase db query --linked --file supabase/demo-users.sql
-- Repeat runs skip existing demo accounts without changing their data.
-- No password, real contact details, bookings, payments or public community profiles.
-- Optional follow-ups: demo-user-details.sql then demo-user-activity.sql.
begin;
select pg_advisory_xact_lock(20261020, 50);
create temporary table demo_players on commit drop as
select gen_random_uuid() as id, name as full_name,
  lower(handle) || '@players.san-ngon.invalid' as email,
  ((date '2026-09-22' + ((n * 17) % 28)::integer)
    + time '06:00' + make_interval(mins => ((n * 137) % 960)::integer))
    at time zone 'Asia/Ho_Chi_Minh' as joined_at
from unnest(array[
  'Nguyễn Minh Đức','Trần Hoàng Nam','Lê Quang Huy','Phạm Tuấn Anh','Hoàng Đức Anh',
  'Vũ Hải Long','Đặng Tiến Dũng','Bùi Trung Kiên','Đỗ Thành Đạt','Ngô Việt Anh',
  'Nguyễn Thu Hà','Trần Phương Linh','Lê Ngọc Anh','Phạm Khánh Huyền','Hoàng Mai Anh',
  'Vũ Thảo Nguyên','Đặng Bảo Ngọc','Bùi Quỳnh Trang','Đỗ Thanh Tâm','Ngô Hà My',
  'Nguyễn Quốc Bảo','Trần Minh Khang','Lê Gia Hưng','Phạm Xuân Trường','Hoàng Nhật Minh',
  'Vũ Anh Tuấn','Đặng Văn Phúc','Bùi Đức Huy','Đỗ Mạnh Cường','Ngô Hữu Thắng',
  'Nguyễn Hải Yến','Trần Diệu Linh','Lê Thanh Hương','Phạm Tú Anh','Hoàng Kim Chi',
  'Vũ Ngọc Mai','Đặng Minh Châu','Bùi Thu Thủy','Đỗ Phương Thảo','Ngô Bích Ngọc',
  'Nguyễn Duy Khánh','Trần Hồng Sơn','Lê Việt Hoàng','Phạm Công Minh','Hoàng Anh Duy',
  'Vũ Đức Thành','Đặng Quang Vinh','Bùi Thanh Bình','Đỗ Ngọc Sơn','Ngô Tuấn Kiệt'
], array[
  'minhduc.nguyen','hoangnam.tran','quanghuy.le','tuananh.pham','ducanh.hoang',
  'hailong.vu','tiendung.dang','trungkien.bui','thanhdat.do','vietanh.ngo',
  'thuha.nguyen','phuonglinh.tran','ngocanh.le','khanhhuyen.pham','maianh.hoang',
  'thaonguyen.vu','baongoc.dang','quynhtrang.bui','thanhtam.do','hamy.ngo',
  'quocbao.nguyen','minhkhang.tran','giahung.le','xuantruong.pham','nhatminh.hoang',
  'anhtuan.vu','vanphuc.dang','duchuy.bui','manhcuong.do','huuthang.ngo',
  'haiyen.nguyen','dieulinh.tran','thanhhuong.le','tuanh.pham','kimchi.hoang',
  'ngocmai.vu','minhchau.dang','thuthuy.bui','phuongthao.do','bichngoc.ngo',
  'duykhanh.nguyen','hongson.tran','viethoang.le','congminh.pham','anhduy.hoang',
  'ducthanh.vu','quangvinh.dang','thanhbinh.bui','ngocson.do','tuankiet.ngo'
]) with ordinality as names(name, handle, n)
where not exists (select 1 from auth.users u
  where lower(u.email) = lower(handle) || '@players.san-ngon.invalid'
    or (u.raw_user_meta_data->>'demo_seed' = 'demo-players-20261020'
      and u.raw_user_meta_data->>'full_name' = name));

insert into auth.users(id, instance_id, aud, role, email,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', full_name, 'demo_seed', 'demo-players-20261020'),
  joined_at, joined_at, '', '', '', ''
from demo_players;

insert into auth.identities(id, user_id, provider_id, identity_data, provider, created_at, updated_at)
select gen_random_uuid(), id, id::text,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', false),
  'email', joined_at, joined_at from demo_players;

update public.profiles p set created_at = d.joined_at
from demo_players d where p.id = d.id;

-- Fail atomically if the profile trigger or date alignment is missing.
do $$ begin
  if exists (select 1 from demo_players d left join public.profiles p on p.id = d.id
    where p.id is null or p.created_at <> d.joined_at or p.role <> 'player') then
    raise exception 'Demo player profile verification failed';
  end if;
end $$;
commit;

select count(*) as demo_users, count(distinct p.created_at) as distinct_join_times,
  min(p.created_at at time zone 'Asia/Ho_Chi_Minh') as first_joined_vn,
  max(p.created_at at time zone 'Asia/Ho_Chi_Minh') as last_joined_vn
from auth.users u join public.profiles p on p.id = u.id
where u.raw_user_meta_data->>'demo_seed' = 'demo-players-20261020';
