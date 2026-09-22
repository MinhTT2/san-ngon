-- Từ chối hồ sơ chủ sân phải kèm lý do.
--
-- Trước đây review_owner() chỉ đổi trạng thái. Người bị từ chối nhận một thông
-- báo chung chung "liên hệ Sân Ngon để biết thông tin cần cập nhật" — nghĩa là
-- phải gọi điện mới biết thiếu gì, trong khi register_owner() cho phép họ nộp
-- lại ngay. Admin sáu tháng sau mở hồ sơ cũng không biết vì sao đã từ chối.

alter table public.profiles
  add column if not exists owner_rejection_reason text,
  add column if not exists owner_reviewed_at      timestamptz,
  add column if not exists owner_reviewed_by      uuid references public.profiles(id) on delete set null;

-- Bản hai tham số phải bỏ hẳn, không để lại làm overload: route cũ gọi trúng nó
-- thì lại từ chối được mà không có lý do.
drop function if exists public.review_owner(uuid, text);

create or replace function public.review_owner(p_owner_id uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles%rowtype;
  v_reason  text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status is null or p_status not in ('active', 'rejected') then raise exception 'INVALID_STATUS'; end if;
  if p_status = 'rejected' and v_reason is null then raise exception 'REASON_REQUIRED'; end if;

  select * into v_profile from profiles where id = p_owner_id for update;
  if not found then raise exception 'OWNER_NOT_FOUND'; end if;
  if coalesce(v_profile.owner_application_status, '') <> 'pending' then raise exception 'OWNER_ALREADY_REVIEWED'; end if;

  -- Ba điều kiện dưới đây cũng chính là ba dòng trong bảng đối chiếu ở giao
  -- diện. Đổi ở đây thì phải đổi cả ownerChecklist() trong lib/owner-review.ts.
  if p_status = 'active' then
    if length(trim(coalesce(v_profile.full_name, ''))) not between 2 and 120
       or coalesce(v_profile.phone, '') !~ '^0[0-9]{9}$' then
      raise exception 'REPRESENTATIVE_REQUIRED';
    end if;
    if not exists (
      select 1 from storage.objects
      where bucket_id = 'venue-documents' and name = v_profile.business_license_path
        and (storage.foldername(name))[1] = v_profile.id::text
    ) then raise exception 'BUSINESS_LICENSE_MISSING'; end if;
    if coalesce(trim(v_profile.payout_bank), '') = ''
       or coalesce(v_profile.payout_account, '') !~ '^[0-9]{6,30}$' then
      raise exception 'PAYOUT_REQUIRED';
    end if;
  end if;

  update profiles set
    owner_application_status = p_status,
    role = case when p_status = 'active' then 'owner'::user_role else role end,
    owner_rejection_reason = case when p_status = 'rejected' then left(v_reason, 500) end,
    owner_reviewed_at = now(),
    owner_reviewed_by = auth.uid()
  where id = p_owner_id;

  if p_status = 'active' then
    insert into notifications (user_id, kind, channel, title, body)
    values (p_owner_id, 'venue_approved', 'app', 'Hồ sơ chủ sân đã được duyệt',
      'Bạn có thể bắt đầu tạo cụm sân và thêm các sân con của mình.');
  end if;
end $$;

grant execute on function public.review_owner(uuid, text, text) to authenticated;

-- Thông báo từ chối nói thẳng thiếu gì, để chủ sân sửa rồi nộp lại được ngay
-- thay vì phải gọi điện hỏi.
create or replace function public.notify_owner_application_rejected()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, kind, channel, title, body)
  values (new.id, 'venue_approved', 'app', 'Hồ sơ chủ sân cần bổ sung',
    coalesce(
      nullif(trim(coalesce(new.owner_rejection_reason, '')), '') ||
        ' Bạn sửa lại rồi gửi hồ sơ lần nữa nhé.',
      'Hồ sơ chưa được duyệt lần này. Liên hệ Sân Ngon để biết thông tin cần cập nhật.'
    ));
  return new;
end $$;
