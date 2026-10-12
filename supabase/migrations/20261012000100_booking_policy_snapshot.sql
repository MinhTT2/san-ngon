-- Freeze published ordinary-booking terms; tournament terms remain separate.
alter table public.bookings
 add column cancel_window_hours int not null default 2 check(cancel_window_hours between 0 and 168),
 add column refund_working_days int check(refund_working_days between 1 and 30),
 add column cancellation_policy_version text not null default 'previous-unversioned',
 add column policy_recorded_at timestamptz not null default now();
-- Historical SQL used 2 hours. Historical refund turnaround was not recorded,
-- so do not invent or retroactively impose a new promise on old bookings.
create function public.freeze_booking_policy()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then
  new.cancel_window_hours:=2;
  new.refund_working_days:=3;
  new.cancellation_policy_version:='ordinary-2026-10-09';
  new.policy_recorded_at:=now();
 elsif new.cancel_window_hours is distinct from old.cancel_window_hours
  or new.refund_working_days is distinct from old.refund_working_days
  or new.cancellation_policy_version is distinct from old.cancellation_policy_version
  or new.policy_recorded_at is distinct from old.policy_recorded_at then
  raise exception 'BOOKING_POLICY_IMMUTABLE';
 end if;
 return new;
end $$;
revoke all on function public.freeze_booking_policy() from public,anon,authenticated;
create trigger bookings_policy_snapshot before insert or update on public.bookings
for each row execute function public.freeze_booking_policy();
create or replace function cancel_booking(p_code text, p_pending_only boolean default false)
returns bookings
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_booking bookings%rowtype;
  v_is_owner boolean;
  v_row bookings%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_booking from bookings where code = p_code for update;
  if v_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;

  v_is_owner := owns_court(v_booking.court_id);
  if v_booking.user_id <> v_uid and not v_is_owner then
    raise exception 'BOOKING_NOT_FOUND';   -- không tiết lộ đơn của người khác có tồn tại
  end if;

  if p_pending_only and v_booking.status <> 'pending' then
    raise exception 'NOT_CANCELLABLE';
  end if;
  if v_booking.status not in ('pending','confirmed') then
    raise exception 'NOT_CANCELLABLE';
  end if;

  update bookings set
    status = 'cancelled',
    cancelled_at = now(),
    refund_status = case
      -- Chưa trả cọc thì không có gì để hoàn.
      when v_booking.status = 'pending' then 'none'::refund_status
      -- Chủ sân hủy thì khách luôn được hoàn, bất kể còn bao lâu.
      when v_is_owner and v_booking.user_id <> v_uid then 'needed'::refund_status
      when v_booking.starts_at - now() >= make_interval(hours => v_booking.cancel_window_hours) then 'needed'::refund_status
      else 'none'::refund_status
    end
  where id = v_booking.id
  returning * into v_row;

  return v_row;
end $$;
revoke all on function cancel_booking(text, boolean) from public, anon;
grant execute on function cancel_booking(text, boolean) to authenticated;

create or replace function public.search_my_bookings(
 p_query text default null, p_filter text default 'active', p_page int default 1,
 p_from date default null, p_to date default null
) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
 v_query text := lower(public.unaccent_vi(trim(coalesce(p_query,''))));
 v_result jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.account_active() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if char_length(v_query)>100 then raise exception 'QUERY_TOO_LONG'; end if;
 if p_filter is null or p_filter not in ('active','pending','confirmed','history','all') then raise exception 'INVALID_STATUS'; end if;
 if p_from is not null and p_to is not null and p_from>p_to then raise exception 'INVALID_DATE_RANGE'; end if;
 with matching as materialized (
  select b.id,b.code,b.starts_at,b.ends_at,b.status,b.total_amount,b.deposit_amount,
   b.expires_at,b.paid_at,b.refund_status,b.cancel_window_hours,b.refund_working_days,b.cancellation_policy_version,
   b.starts_at - make_interval(hours => b.cancel_window_hours) as cancel_refund_deadline,
   (b.status='pending' and b.expires_at>now()) as pending,
   (b.status='confirmed' and b.ends_at>now()) as confirmed,
   jsonb_build_object('name',coalesce(b.court_name_snapshot,c.name),'sport',coalesce(b.sport_snapshot,c.sport),'venues',jsonb_build_object(
    'name',coalesce(b.venue_name_snapshot,v.name),'district',coalesce(b.venue_district_snapshot,v.district),'slug',v.slug,'status',v.status)) as courts
  from public.bookings b join public.courts c on c.id=b.court_id join public.venues v on v.id=c.venue_id
  where b.user_id=auth.uid()
   and (p_from is null or b.starts_at>=(p_from::timestamp at time zone 'Asia/Ho_Chi_Minh'))
   and (p_to is null or b.starts_at<((p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh'))
   and not exists (
    select 1 from regexp_split_to_table(v_query,'[[:space:]]+') word
    where word<>'' and strpos(lower(public.unaccent_vi(concat_ws(' ',b.code,coalesce(b.court_name_snapshot,c.name),coalesce(b.venue_name_snapshot,v.name),coalesce(b.venue_district_snapshot,v.district),
     case coalesce(b.sport_snapshot,c.sport) when 'badminton' then 'Cầu lông' when 'pickleball' then 'Pickleball' else 'Bóng đá' end))),word)=0
   )
 ), counts as (
  select count(*) as total,count(*) filter(where pending) as pending,count(*) filter(where confirmed) as confirmed,
   count(*) filter(where not pending and not confirmed) as history from matching
 ), filtered as materialized (
  select * from matching where p_filter='all' or (p_filter='active' and (pending or confirmed))
   or (p_filter='pending' and pending) or (p_filter='confirmed' and confirmed)
   or (p_filter='history' and not pending and not confirmed)
 ), limits as (
  select count(*) as matched,greatest(1,ceil(count(*)/30.0)::int) as pages,
   least(greatest(1,coalesce(p_page,1)),greatest(1,ceil(count(*)/30.0)::int)) as page from filtered
 ), paged as (
  select * from filtered order by (pending or confirmed) desc,pending desc,
   case when pending or confirmed then starts_at end asc,
   case when not pending and not confirmed then starts_at end desc,id desc
  limit 30 offset (select (page-1)*30 from limits)
 )
 select jsonb_build_object('total',c.total,'pending',c.pending,'confirmed',c.confirmed,'history',c.history,
  'matched',l.matched,'page',l.page,'pages',l.pages,'page_size',30,'now_ms',floor(extract(epoch from now())*1000),
  'rows',coalesce((select jsonb_agg(to_jsonb(p)-'pending'-'confirmed' order by (p.pending or p.confirmed) desc,p.pending desc,
   case when p.pending or p.confirmed then p.starts_at end asc,
   case when not p.pending and not p.confirmed then p.starts_at end desc,p.id desc) from paged p),'[]'::jsonb))
 into v_result from counts c cross join limits l;
 return v_result;
end $$;

notify pgrst,'reload schema';
