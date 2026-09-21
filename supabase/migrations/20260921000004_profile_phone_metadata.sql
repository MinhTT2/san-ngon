-- Lưu số điện thoại người chơi nhập lúc đăng ký vào hồ sơ ngay khi
-- Supabase tạo user. create_booking vẫn ghi lại bản sao trên từng đơn.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, avatar_url)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          nullif(trim(new.raw_user_meta_data->>'phone'), ''),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;
