-- Ảnh đại diện công khai, tách riêng ảnh sân và giấy tờ xác minh.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp']);

create policy avatars_insert on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and public.account_active()
  and name ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$'));
create policy avatars_read_own on storage.objects for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and public.account_active()
  and (storage.foldername(name))[1] = auth.uid()::text
  and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.avatar_url = storage.objects.name));

-- avatar_url giữ URL OAuth cũ hoặc đường dẫn trong bucket avatars cho ảnh upload.
-- Không cho bỏ qua việc kiểm tra file bằng update trực tiếp.
revoke update (avatar_url) on public.profiles from authenticated;
create or replace function public.set_profile_avatar(p_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_previous text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.account_active() then raise exception 'ACCOUNT_BANNED'; end if;
  select avatar_url into v_previous from profiles where id = v_uid for update;
  if not found then raise exception 'PROFILE_REQUIRED'; end if;
  if p_path is not null and (
    p_path !~ ('^' || v_uid::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')
    or not exists (select 1 from storage.objects o where o.bucket_id = 'avatars' and o.name = p_path
      and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')
      and (o.metadata->>'size')::bigint between 1 and 5242880)
  ) then raise exception 'AVATAR_INVALID'; end if;
  update profiles set avatar_url = p_path where id = v_uid;
  return jsonb_build_object('avatar_url', p_path, 'previous_avatar_url', v_previous);
end $$;
revoke all on function public.set_profile_avatar(text) from public, anon;
grant execute on function public.set_profile_avatar(text) to authenticated;

create or replace function public.update_profile(p_full_name text, p_phone text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_uid uuid := auth.uid(); v_profile jsonb; v_phone text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.account_active() then raise exception 'ACCOUNT_BANNED'; end if;
  if length(trim(coalesce(p_full_name, ''))) not between 2 and 100 then
    raise exception 'NAME_INVALID';
  end if;
  v_phone := regexp_replace(coalesce(p_phone, ''), '[[:space:]().-]', '', 'g');
  v_phone := regexp_replace(v_phone, '^\+84', '0');
  if v_phone !~ '^0[0-9]{9}$' then raise exception 'PHONE_INVALID'; end if;
  update profiles set full_name = trim(p_full_name), phone = v_phone where id = v_uid
  returning jsonb_build_object('full_name', full_name, 'phone', phone) into v_profile;
  if not found then raise exception 'PROFILE_REQUIRED'; end if;
  return v_profile;
end $$;
