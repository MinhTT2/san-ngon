-- Supabase installs pgcrypto in the extensions schema. The original function
-- used search_path = public, so /start failed with "function digest(...) does
-- not exist" even though pgcrypto was enabled.
create or replace function public.connect_telegram(p_token text, p_chat_id text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if coalesce(trim(p_token), '') = '' or coalesce(trim(p_chat_id), '') = '' then
    return false;
  end if;

  select id into v_id
  from profiles
  where telegram_link_token_hash = encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex')
    and telegram_link_expires_at > now()
  for update;

  if v_id is null then return false; end if;

  update profiles
  set telegram_chat_id = trim(p_chat_id),
      telegram_link_token_hash = null,
      telegram_link_expires_at = null
  where id = v_id;

  return true;
end $$;

revoke execute on function public.connect_telegram(text, text) from public, authenticated;
grant execute on function public.connect_telegram(text, text) to anon;
