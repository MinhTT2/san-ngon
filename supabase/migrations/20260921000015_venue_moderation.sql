-- Quản lý cụm sân cho admin: duyệt, gỡ xuống, mở lại.
--
-- Hai chỗ hỏng của review_venue() cũ, đo được chứ không phải đoán:
--
-- 1. Duyệt một cụm sân chờ duyệt LUÔN ném BUSINESS_LICENSE_MISSING. Hàm tìm
--    giấy phép ở venues.business_license_path, nhưng từ 20260921000007 giấy
--    phép chuyển sang profiles (duyệt người, không duyệt từng sân) và
--    create_venue() không bao giờ ghi cột đó nữa. Tab "Hồ sơ sân" không chỉ
--    rỗng — bấm vào là hỏng.
-- 2. Không gỡ được một cụm sân đang hoạt động: hàm chỉ nhận status = 'pending'
--    nên sân bậy chỉ còn cách khoá cả tài khoản chủ sân, tức là chôn luôn mọi
--    cụm sân khác của họ. Dao mổ trâu.
--
-- create_booking() đã chặn ở v.status = 'active', nên gỡ xuống là chặn thật
-- chứ không chỉ ẩn khỏi trang tìm sân.

alter table public.venues
  add column if not exists hidden_reason text,
  add column if not exists reviewed_at   timestamptz,
  add column if not exists reviewed_by   uuid references public.profiles(id) on delete set null;

drop function if exists public.review_venue(uuid, text);

create or replace function public.review_venue(p_venue_id uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_venue  venues%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status is null or p_status not in ('active', 'rejected') then raise exception 'INVALID_STATUS'; end if;
  if p_status = 'rejected' and v_reason is null then raise exception 'REASON_REQUIRED'; end if;

  select * into v_venue from venues where id = p_venue_id for update;
  if not found then raise exception 'VENUE_NOT_FOUND'; end if;
  if v_venue.status = 'draft' then raise exception 'VENUE_DRAFT'; end if;
  if v_venue.status::text = p_status then raise exception 'VENUE_NO_CHANGE'; end if;

  -- Cho sân chạy nghĩa là cho chủ nó nhận tiền cọc, nên cái cần kiểm là chủ sân
  -- đã được duyệt chưa — giấy phép kinh doanh nằm ở hồ sơ chủ sân, không còn
  -- nằm trên từng cụm sân nữa.
  if p_status = 'active' then
    if not exists (
      select 1 from profiles
      where id = v_venue.owner_id
        and owner_application_status = 'active'
        and banned_at is null
        and length(trim(coalesce(full_name, ''))) between 2 and 120
        and coalesce(phone, '') ~ '^0[0-9]{9}$'
    ) then raise exception 'OWNER_NOT_APPROVED'; end if;
  end if;

  -- Đơn đã đặt KHÔNG bị đụng tới. Khách đã trả cọc cho một khung giờ cụ thể;
  -- gỡ sân khỏi trang tìm là chuyện giữa admin và chủ sân, huỷ kèo của khách là
  -- chuyện khác hẳn. create_booking() lo phần chặn đơn mới.
  update venues set
    status        = p_status::venue_status,
    hidden_reason = case when p_status = 'rejected' then left(v_reason, 500) end,
    reviewed_at   = now(),
    reviewed_by   = auth.uid()
  where id = p_venue_id;

  insert into notifications (user_id, kind, channel, title, body)
  values (
    v_venue.owner_id, 'venue_approved', 'app',
    case when p_status = 'active' then 'Cụm sân đã được duyệt' else 'Cụm sân đã bị gỡ khỏi trang tìm sân' end,
    case when p_status = 'active'
      then format('%s đã hiện trên trang tìm sân và bắt đầu nhận đặt.', v_venue.name)
      else format('%s: %s Đơn khách đã đặt vẫn giữ nguyên.', v_venue.name, v_reason)
    end
  );
end $$;

revoke execute on function public.review_venue(uuid, text, text) from public, anon;
grant execute on function public.review_venue(uuid, text, text) to authenticated;
