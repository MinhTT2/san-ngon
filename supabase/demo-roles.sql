-- Chạy trong SQL Editor sau khi tạo hai Auth users. Thay email thật ở đây.
do $$
declare
  v_admin_email text := 'admin@example.com';
  v_owner_email text := 'owner@example.com';
  v_admin uuid;
  v_owner uuid;
begin
  if v_admin_email in ('admin@example.com', '') or v_owner_email in ('owner@example.com', '')
     or lower(v_admin_email) = lower(v_owner_email) then
    raise exception 'Điền hai email thật, khác nhau trước khi chạy.';
  end if;
  select id into v_admin from auth.users where lower(email) = lower(trim(v_admin_email));
  select id into v_owner from auth.users where lower(email) = lower(trim(v_owner_email));
  if v_admin is null or v_owner is null then
    raise exception 'Tạo cả hai Auth users trước. Chưa thay đổi role nào.';
  end if;
  insert into public.profiles (id, role) values (v_admin, 'admin'), (v_owner, 'owner')
  on conflict (id) do update set role = excluded.role;
end $$;
