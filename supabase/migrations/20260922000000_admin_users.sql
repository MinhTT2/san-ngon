-- Quản lý tài khoản qua RPC; service role vẫn chỉ dùng tại webhook.
alter table public.profiles
  add column banned_until timestamptz,
  add column ban_reason text,
  add column banned_at timestamptz;

create or replace function public.account_active()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid()
    and (banned_until is null or banned_until <= now()));
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin'
    and (banned_until is null or banned_until <= now()));
$$;

-- JWT đã phát vẫn còn hạn: bảo vệ cả RLS và các RPC SECURITY DEFINER ghi dữ liệu.
create or replace function public.reject_banned_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.account_active() then
    raise exception 'ACCOUNT_BANNED' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['profiles','venues','courts','price_rules','bookings','payments','notifications'] loop
    execute format('create trigger reject_banned_write before insert or update or delete on public.%I for each row execute function public.reject_banned_write()', t);
    if t <> 'profiles' then
      execute format('create policy active_account on public.%I as restrictive to authenticated using (public.account_active()) with check (public.account_active())', t);
    end if;
  end loop;
end $$;
create policy active_account on public.profiles as restrictive to authenticated
  using (public.account_active() or id = auth.uid()) with check (public.account_active());
create policy active_account on storage.objects as restrictive to authenticated
  using (public.account_active()) with check (public.account_active());

create or replace function public.admin_list_users(p_search text default '', p_status text default 'all', p_role text default 'all', p_page int default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_page is null or p_page < 1 or p_page > 100000 then raise exception 'INVALID_INPUT'; end if;
  with filtered as (
    select p.id, p.full_name, p.phone, p.role, p.created_at, u.email,
      p.banned_until, p.ban_reason, p.banned_at,
      coalesce(p.banned_until > now(), false) as is_banned
    from profiles p join auth.users u on u.id = p.id
    where (coalesce(p_search, '') = '' or position(lower(trim(p_search)) in lower(concat_ws(' ', p.full_name, p.phone, u.email))) > 0)
      and (p_role = 'all' or p.role::text = p_role)
  ), matched as (
    select * from filtered where p_status = 'all'
      or (p_status = 'banned' and is_banned) or (p_status = 'active' and not is_banned)
  ), page as (select * from matched order by created_at desc, id limit 20 offset (p_page - 1) * 20)
  select jsonb_build_object('users', coalesce((select jsonb_agg(page) from page), '[]'::jsonb),
    'total', (select count(*) from matched),
    'active', (select count(*) from filtered where not is_banned),
    'banned', (select count(*) from filtered where is_banned)) into v_result;
  return v_result;
end $$;

create or replace function public.admin_save_user(p_id uuid, p_full_name text, p_phone text, p_role public.user_role, p_email text default null, p_password text default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid := p_id; v_target profiles%rowtype;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_role is null or length(trim(coalesce(p_full_name, ''))) not between 2 and 100
    or (nullif(trim(p_phone), '') is not null and trim(p_phone) !~ '^0[0-9]{9}$') then raise exception 'INVALID_INPUT'; end if;
  -- Tuần demo chỉ có vài admin; khóa thao tác quản trị để bảo vệ admin cuối cùng.
  perform pg_advisory_xact_lock(22092026);
  if p_id is null then
    if length(coalesce(p_email, '')) > 254 or coalesce(p_email, '') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      or length(coalesce(p_password, '')) < 12 or octet_length(p_password) > 72 then raise exception 'INVALID_INPUT'; end if;
    if exists (select 1 from auth.users where lower(email) = lower(trim(p_email))) then raise exception 'EMAIL_EXISTS'; end if;
    v_id := gen_random_uuid();
    -- Cùng transaction với hồ sơ; admin chịu trách nhiệm xác minh email trước khi tạo.
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', lower(trim(p_email)),
      crypt(p_password, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', trim(p_full_name), 'phone', trim(p_phone)), now(), now(), '', '', '', '');
    insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
    values (v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', lower(trim(p_email)), 'email_verified', true), 'email', now(), now());
  else
    select * into v_target from profiles where id = p_id for update;
    if not found then raise exception 'USER_NOT_FOUND'; end if;
    if p_id = auth.uid() and p_role <> v_target.role then raise exception 'SELF_PROTECTED'; end if;
    if v_target.role = 'admin' and p_role <> 'admin' and not exists (
      select 1 from profiles where id <> p_id and role = 'admin' and (banned_until is null or banned_until <= now())
    ) then raise exception 'LAST_ADMIN'; end if;
    if p_role <> 'owner' and v_target.role = 'owner' and exists (select 1 from venues where owner_id = p_id) then raise exception 'OWNER_HAS_VENUES'; end if;
  end if;
  update profiles set full_name = trim(p_full_name), phone = nullif(trim(p_phone), ''), role = p_role where id = v_id;
  return v_id;
end $$;

create or replace function public.admin_user_action(p_id uuid, p_action text, p_reason text default null, p_days int default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_target profiles%rowtype; v_until timestamptz;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_action is null or p_action not in ('ban','unban','delete') then raise exception 'INVALID_INPUT'; end if;
  if p_id = auth.uid() then raise exception 'SELF_PROTECTED'; end if;
  perform pg_advisory_xact_lock(22092026);
  select * into v_target from profiles where id = p_id for update;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  if p_action <> 'unban' and v_target.role = 'admin' and not exists (
    select 1 from profiles where id <> p_id and role = 'admin' and (banned_until is null or banned_until <= now())
  ) then raise exception 'LAST_ADMIN'; end if;
  if p_action = 'delete' then
    if exists (select 1 from bookings where user_id = p_id) or exists (select 1 from venues where owner_id = p_id)
      or exists (select 1 from storage.objects where bucket_id = 'venue-documents' and (storage.foldername(name))[1] = p_id::text)
      then raise exception 'USER_HAS_DATA'; end if;
    delete from auth.users where id = p_id;
    return;
  end if;
  if p_action = 'ban' then
    if length(trim(coalesce(p_reason, ''))) not between 5 and 500 or p_days is null or p_days not in (0,1,7,30) then raise exception 'INVALID_INPUT'; end if;
    v_until := case when p_days = 0 then 'infinity'::timestamptz else now() + make_interval(days => p_days) end;
  end if;
  update profiles set banned_until = v_until,
    ban_reason = case when p_action = 'ban' then trim(p_reason) end,
    banned_at = case when p_action = 'ban' then now() end where id = p_id;
  -- GoTrue chặn đăng nhập mới; RLS/trigger ở trên chặn JWT cũ ngay lập tức.
  update auth.users set banned_until = case when v_until = 'infinity'::timestamptz then '2999-01-01'::timestamptz else v_until end,
    updated_at = now() where id = p_id;
end $$;

revoke all on function public.admin_list_users(text,text,text,int), public.admin_save_user(uuid,text,text,user_role,text,text), public.admin_user_action(uuid,text,text,int), public.reject_banned_write() from public, anon;
grant execute on function public.admin_list_users(text,text,text,int), public.admin_save_user(uuid,text,text,user_role,text,text), public.admin_user_action(uuid,text,text,int) to authenticated;
