-- Private review history survives resubmission; approval remains an authenticated SQL decision.
alter table public.profiles
  add column owner_rejection_reason text,
  add column owner_reviewed_at timestamptz,
  add column owner_reviewed_by uuid references public.profiles(id) on delete set null;

create table public.owner_application_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  status text not null check(status in ('active','rejected')),
  reason text,
  created_at timestamptz not null default now(),
  check((status='active' and reason is null) or (status='rejected' and reason is not null and length(reason) between 10 and 1000))
);
create index owner_application_reviews_owner_idx on public.owner_application_reviews(owner_id,created_at desc,id);
alter table public.owner_application_reviews enable row level security;
revoke all on public.owner_application_reviews from public,anon,authenticated;
grant select on public.owner_application_reviews to authenticated;
create policy owner_application_reviews_read on public.owner_application_reviews for select to authenticated
using(public.account_active() and (owner_id=auth.uid() or public.is_admin()));

-- Remove the old signature so a two-argument rejection cannot bypass the reason requirement.
drop function public.review_owner(uuid,text);
create or replace function public.review_owner(p_owner_id uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles%rowtype;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status is null or p_status not in ('active', 'rejected') then raise exception 'INVALID_STATUS'; end if;
  if p_status = 'rejected' and length(trim(coalesce(p_reason,''))) not between 10 and 1000 then
    raise exception 'REJECTION_REASON_REQUIRED';
  end if;
  select * into v_profile from profiles where id = p_owner_id for update;
  if not found then raise exception 'OWNER_NOT_FOUND'; end if;
  if coalesce(v_profile.owner_application_status, '') <> 'pending' then raise exception 'OWNER_ALREADY_REVIEWED'; end if;

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
    owner_rejection_reason = case when p_status = 'rejected' then trim(p_reason) else null end,
    owner_reviewed_at = now(), owner_reviewed_by = auth.uid(),
    role = case when p_status = 'active' then 'owner'::user_role else role end
  where id = p_owner_id;

  insert into public.owner_application_reviews(owner_id, reviewer_id, status, reason)
  values (p_owner_id, auth.uid(), p_status, case when p_status = 'rejected' then trim(p_reason) else null end);

  if p_status = 'active' then
    insert into notifications (user_id, kind, channel, title, body)
    values (p_owner_id, 'venue_approved', 'app', 'Hồ sơ chủ sân đã được duyệt',
      'Bạn có thể bắt đầu tạo cụm sân và thêm các sân con của mình.');
  end if;
end $$;

revoke all on function public.review_owner(uuid,text,text) from public,anon;
grant execute on function public.review_owner(uuid,text,text) to authenticated;

create or replace function public.register_owner(
  p_full_name text,
  p_phone text,
  p_business_license_path text,
  p_business_license_name text,
  p_payout_bank text,
  p_payout_account text
) returns profiles
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profile profiles%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(trim(p_full_name), '') = '' then raise exception 'REPRESENTATIVE_REQUIRED'; end if;
  if coalesce(trim(p_phone), '') !~ '^0[0-9]{9}$' then raise exception 'PHONE_INVALID'; end if;
  -- The OAuth step follows the saved application. Keep older callers compatible.
  if nullif(trim(p_payout_bank), '') is not null or nullif(trim(p_payout_account), '') is not null then
    if coalesce(trim(p_payout_bank), '') = '' or coalesce(trim(p_payout_account), '') !~ '^[0-9]{6,30}$' then
      raise exception 'PAYOUT_INVALID';
    end if;
  end if;
  if coalesce(trim(p_business_license_path), '') = ''
     or coalesce(trim(p_business_license_name), '') = '' then
    raise exception 'BUSINESS_LICENSE_REQUIRED';
  end if;
  if p_business_license_path !~ ('^' || v_uid::text || '/[0-9a-f-]+\.(pdf|jpg|png)$') then
    raise exception 'BUSINESS_LICENSE_INVALID';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'venue-documents' and name = p_business_license_path
  ) then raise exception 'BUSINESS_LICENSE_MISSING'; end if;

  select * into v_profile from profiles where id = v_uid for update;
  if not found then raise exception 'PROFILE_REQUIRED'; end if;
  if v_profile.owner_application_status = 'pending' then raise exception 'OWNER_APPLICATION_EXISTS'; end if;
  if v_profile.owner_application_status = 'active' then raise exception 'OWNER_ALREADY_APPROVED'; end if;

  update profiles set
    full_name = trim(p_full_name), phone = trim(p_phone),
    payout_bank = coalesce((select bank from sepay_connections where owner_id=v_uid and status='ready'), nullif(trim(p_payout_bank), '')),
    payout_account = coalesce((select account_number from sepay_connections where owner_id=v_uid and status='ready'), nullif(trim(p_payout_account), '')),
    business_license_path = p_business_license_path,
    business_license_name = left(trim(p_business_license_name), 255),
    owner_application_status = 'pending',
    owner_rejection_reason = null, owner_reviewed_at = null, owner_reviewed_by = null
  where id = v_uid
  returning * into v_profile;
  return v_profile;
end $$;

grant execute on function public.register_owner(text, text, text, text, text, text) to authenticated;


create or replace function public.notify_owner_application_rejected()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(user_id,kind,channel,title,body)
  values(new.id,'venue_approved','app','Hồ sơ chủ sân cần bổ sung',
    'Thông tin cần bổ sung: ' || coalesce(new.owner_rejection_reason,'Liên hệ Sân Ngon để kiểm tra hồ sơ đã được xử lý trước đây.') ||
    E'\nMở Đăng ký chủ sân để cập nhật và gửi lại hồ sơ.');
  return new;
end $$;
revoke all on function public.notify_owner_application_rejected() from public,anon,authenticated;
