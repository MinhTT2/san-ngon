-- Thông báo cho admin khi hồ sơ mới gửi và cho chủ sân khi hồ sơ bị từ chối.
create or replace function public.notify_owner_application_submitted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, kind, channel, title, body)
  select id, 'owner_application'::notif_kind, 'app',
    'Có hồ sơ chủ sân mới cần duyệt',
    format('%s vừa gửi hồ sơ đăng ký chủ sân.', coalesce(new.full_name, 'Một người dùng'))
  from profiles
  where role = 'admin';
  return new;
end $$;

drop trigger if exists owner_application_submitted on public.profiles;
create trigger owner_application_submitted
after update of owner_application_status on public.profiles
for each row
when (new.owner_application_status = 'pending' and old.owner_application_status is distinct from new.owner_application_status)
execute function public.notify_owner_application_submitted();

create or replace function public.notify_owner_application_rejected()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, kind, channel, title, body)
  values (new.id, 'venue_approved', 'app', 'Hồ sơ chủ sân cần bổ sung',
    'Hồ sơ chưa được duyệt lần này. Liên hệ Sân Ngon để biết thông tin cần cập nhật.');
  return new;
end $$;

drop trigger if exists owner_application_rejected on public.profiles;
create trigger owner_application_rejected
after update of owner_application_status on public.profiles
for each row
when (new.owner_application_status = 'rejected' and old.owner_application_status is distinct from new.owner_application_status)
execute function public.notify_owner_application_rejected();

-- Chỉ admin mới được gọi; route dùng kết quả này để gửi email sau khi duyệt.
create or replace function public.get_owner_email(p_owner_id uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  return (select email from auth.users where id = p_owner_id);
end $$;

revoke execute on function public.get_owner_email(uuid) from public, anon;
grant execute on function public.get_owner_email(uuid) to authenticated;
