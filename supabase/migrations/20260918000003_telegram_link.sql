-- Tự liên kết Telegram: mã ngắn hạn được tạo sau khi chủ sân đăng nhập.
alter table profiles
  add column if not exists telegram_link_token_hash text,
  add column if not exists telegram_link_expires_at timestamptz;

create index if not exists profiles_telegram_link_idx
  on profiles (telegram_link_token_hash)
  where telegram_link_token_hash is not null;

create or replace function connect_telegram(p_token text, p_chat_id text)
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
  where telegram_link_token_hash = encode(digest(p_token, 'sha256'), 'hex')
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

revoke execute on function connect_telegram(text, text) from public, authenticated;
grant execute on function connect_telegram(text, text) to anon;
