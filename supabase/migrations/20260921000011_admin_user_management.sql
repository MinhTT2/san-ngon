-- Quản trị người dùng: xem, sửa hồ sơ/vai trò, khoá, mở khoá, xoá.
--
-- Mọi kiểm tra quyền nằm ở đây chứ không ở tầng Next.js. Route /api/admin/users/*
-- cố ý không kiểm tra lại: hai chỗ kiểm tra thì sớm muộn lệch nhau, và chỗ lỏng
-- hơn thắng. is_admin() đã có từ 20260921000000_admin_dashboard.sql.

-- ---------- Cột khoá tài khoản ----------
alter table profiles add column if not exists banned_at  timestamptz;
alter table profiles add column if not exists ban_reason text;
alter table profiles add column if not exists banned_by  uuid references profiles(id) on delete set null;

create index if not exists profiles_banned_idx on profiles (banned_at) where banned_at is not null;

-- ---------- Danh sách người dùng ----------
-- Trả kèm tong_so để phân trang mà không cần thêm một lượt đếm riêng.
create or replace function admin_list_users(
  p_q text default null,
  p_role text default null,      -- 'player' | 'owner' | 'admin' | null
  p_status text default null,    -- 'active' | 'banned' | null
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  id uuid, email text, full_name text, phone text, role text,
  banned_at timestamptz, ban_reason text,
  created_at timestamptz, last_sign_in_at timestamptz,
  so_don bigint, so_cum_san bigint, tong_so bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  return query
  with loc as (
    select p.id, u.email::text as email, p.full_name, p.phone, p.role::text as role,
           p.banned_at, p.ban_reason, p.created_at, u.last_sign_in_at
    from profiles p join auth.users u on u.id = p.id
    where (p_role is null or p.role::text = p_role)
      and (p_status is null
           or (p_status = 'banned' and p.banned_at is not null)
           or (p_status = 'active' and p.banned_at is null))
      and (p_q is null or p_q = '' or
           u.email ilike '%' || p_q || '%' or
           coalesce(p.full_name,'') ilike '%' || p_q || '%' or
           coalesce(p.phone,'')     ilike '%' || p_q || '%')
  )
  select l.id, l.email, l.full_name, l.phone, l.role, l.banned_at, l.ban_reason,
         l.created_at, l.last_sign_in_at,
         (select count(*) from bookings b where b.user_id = l.id),
         (select count(*) from venues v where v.owner_id = l.id),
         (select count(*) from loc)
  from loc l
  order by l.created_at desc
  limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset);
end $$;

-- ---------- Sửa hồ sơ ----------
create or replace function admin_update_user(
  p_id uuid, p_full_name text, p_phone text, p_role text
) returns profiles
language plpgsql security definer set search_path = public as $$
declare v_row profiles%rowtype; v_admins int;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_role not in ('player','owner','admin') then raise exception 'ROLE_INVALID'; end if;

  -- Hạ quyền admin cuối cùng là tự khoá mình ra khỏi khu vực quản trị.
  if p_role <> 'admin' then
    select count(*) into v_admins from profiles where role = 'admin';
    if v_admins <= 1 and exists (select 1 from profiles where id = p_id and role = 'admin') then
      raise exception 'LAST_ADMIN';
    end if;
  end if;

  update profiles set
    full_name = nullif(trim(coalesce(p_full_name,'')),''),
    phone     = nullif(trim(coalesce(p_phone,'')),''),
    role      = p_role::user_role
  where id = p_id
  returning * into v_row;

  if v_row.id is null then raise exception 'USER_NOT_FOUND'; end if;
  return v_row;
end $$;

-- ---------- Khoá tài khoản ----------
-- Khoá ở cả hai tầng: profiles.banned_at để app biết, và auth.users.banned_until
-- để chính Supabase từ chối cấp token. Chỉ khoá một tầng thì người đang có phiên
-- vẫn dùng tiếp được tới khi token hết hạn.
create or replace function admin_ban_user(p_id uuid, p_reason text)
returns profiles
language plpgsql security definer set search_path = public as $$
declare v_row profiles%rowtype;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_id = auth.uid() then raise exception 'CANNOT_BAN_SELF'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'REASON_REQUIRED'; end if;

  update profiles set
    banned_at  = now(),
    ban_reason = trim(p_reason),
    banned_by  = auth.uid()
  where id = p_id
  returning * into v_row;

  if v_row.id is null then raise exception 'USER_NOT_FOUND'; end if;

  update auth.users set banned_until = 'infinity'::timestamptz where id = p_id;

  -- Đơn chưa trả tiền thì thả khung giờ ra cho người khác đặt. Đơn đã xác nhận
  -- giữ nguyên: khách đã trả cọc, huỷ hộ họ là chuyện khác.
  update bookings set status = 'cancelled', cancelled_at = now(), refund_status = 'none'
  where user_id = p_id and status = 'pending';

  return v_row;
end $$;

create or replace function admin_unban_user(p_id uuid)
returns profiles
language plpgsql security definer set search_path = public as $$
declare v_row profiles%rowtype;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  update profiles set banned_at = null, ban_reason = null, banned_by = null
  where id = p_id returning * into v_row;
  if v_row.id is null then raise exception 'USER_NOT_FOUND'; end if;

  update auth.users set banned_until = null where id = p_id;
  return v_row;
end $$;

-- ---------- Xoá tài khoản ----------
create or replace function admin_delete_user(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_admins int;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_id = auth.uid() then raise exception 'CANNOT_DELETE_SELF'; end if;
  if not exists (select 1 from profiles where id = p_id) then raise exception 'USER_NOT_FOUND'; end if;

  select count(*) into v_admins from profiles where role = 'admin';
  if v_admins <= 1 and exists (select 1 from profiles where id = p_id and role = 'admin') then
    raise exception 'LAST_ADMIN';
  end if;

  -- Có đơn thì không xoá được, và đúng là không nên: xoá người đặt đi thì chủ
  -- sân mất luôn lịch sử đơn của mình.
  if exists (select 1 from bookings where user_id = p_id) then
    raise exception 'HAS_BOOKINGS';
  end if;

  delete from auth.users where id = p_id;   -- profiles xoá theo cascade
end $$;

-- ---------- Người bị khoá không dùng được nữa ----------
-- Đặt ở trigger chứ không nhét vào create_booking()/register_venue(): chặn được
-- mọi đường vào, kể cả khi ai đó thêm hàm mới, và không phải chép lại thân hàm
-- mỗi lần chúng đổi. auth.uid() null (seed, service_role) thì không vướng.
create or replace function block_banned_users()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from profiles where id = auth.uid() and banned_at is not null) then
    raise exception 'ACCOUNT_BANNED';
  end if;
  return new;
end $$;

drop trigger if exists bookings_block_banned on bookings;
create trigger bookings_block_banned before insert on bookings
  for each row execute function block_banned_users();

drop trigger if exists venues_block_banned on venues;
create trigger venues_block_banned before insert on venues
  for each row execute function block_banned_users();

-- ---------- Quyền ----------
-- Postgres cấp EXECUTE cho PUBLIC trên mọi hàm mới, và anon kế thừa quyền đó,
-- nên phải thu hồi rồi mới cấp lại cho đúng vai.
revoke execute on function admin_list_users(text, text, text, int, int) from public, anon;
revoke execute on function admin_update_user(uuid, text, text, text)     from public, anon;
revoke execute on function admin_ban_user(uuid, text)                    from public, anon;
revoke execute on function admin_unban_user(uuid)                        from public, anon;
revoke execute on function admin_delete_user(uuid)                       from public, anon;
revoke execute on function block_banned_users()                          from public, anon, authenticated;

grant execute on function admin_list_users(text, text, text, int, int) to authenticated;
grant execute on function admin_update_user(uuid, text, text, text)     to authenticated;
grant execute on function admin_ban_user(uuid, text)                    to authenticated;
grant execute on function admin_unban_user(uuid)                        to authenticated;
grant execute on function admin_delete_user(uuid)                       to authenticated;
