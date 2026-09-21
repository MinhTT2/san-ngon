-- Vai trò không phải trường người dùng được tự sửa: RLS theo id là chưa đủ.
revoke update on public.profiles from public, anon, authenticated;
grant update (full_name, phone, avatar_url, telegram_chat_id,
  telegram_link_token_hash, telegram_link_expires_at, payout_bank, payout_account)
  on public.profiles to authenticated;

-- Chuyển trạng thái chỉ qua hàm SQL kiểm tra hồ sơ, kể cả với admin.
revoke update on public.venues from public, anon, authenticated;
grant update (name, address, district, city, lat, lng, phone, description,
  images, amenities, open_time, close_time, deposit_pct, booking_horizon_days)
  on public.venues to authenticated;

create or replace function public.review_venue(p_venue_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_venue venues%rowtype;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status is null or p_status not in ('active', 'rejected') then
    raise exception 'INVALID_STATUS';
  end if;

  select * into v_venue from venues where id = p_venue_id for update;
  if not found then raise exception 'VENUE_NOT_FOUND'; end if;
  if v_venue.status <> 'pending' then raise exception 'VENUE_ALREADY_REVIEWED'; end if;

  if p_status = 'active' then
    if not exists (
      select 1 from profiles where id = v_venue.owner_id
        and length(trim(full_name)) between 2 and 120
        and phone ~ '^0[0-9]{9}$'
    ) then raise exception 'REPRESENTATIVE_REQUIRED'; end if;
    if not exists (
      select 1 from storage.objects
      where bucket_id = 'venue-documents' and name = v_venue.business_license_path
        and (storage.foldername(name))[1] = v_venue.owner_id::text
    ) then raise exception 'BUSINESS_LICENSE_MISSING'; end if;
  end if;

  update venues set status = p_status::venue_status where id = p_venue_id;
end $$;

revoke execute on function public.review_venue(uuid, text) from public, anon;
grant execute on function public.review_venue(uuid, text) to authenticated;

-- Không được xóa giấy tờ đã gửi rồi thay file khác sau khi admin kiểm tra.
drop policy if exists venue_documents_delete on storage.objects;
create policy venue_documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'venue-documents' and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (select 1 from public.venues v where v.business_license_path = storage.objects.name));
