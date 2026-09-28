-- Dùng quyền của phiên hiện tại và RLS profiles_update_own.
-- Không nhận id hay các trường quyền/hồ sơ xét duyệt từ người gọi.
create or replace function public.update_profile(p_full_name text, p_phone text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profile jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.account_active() then raise exception 'ACCOUNT_BANNED'; end if;
  if length(trim(coalesce(p_full_name, ''))) not between 2 and 100 then
    raise exception 'NAME_INVALID';
  end if;
  if coalesce(trim(p_phone), '') !~ '^0[0-9]{9}$' then
    raise exception 'PHONE_INVALID';
  end if;

  update profiles set full_name = trim(p_full_name), phone = trim(p_phone)
  where id = v_uid
  returning jsonb_build_object('full_name', full_name, 'phone', phone) into v_profile;
  if not found then raise exception 'PROFILE_REQUIRED'; end if;
  return v_profile;
end $$;

revoke all on function public.update_profile(text, text) from public, anon;
grant execute on function public.update_profile(text, text) to authenticated;
