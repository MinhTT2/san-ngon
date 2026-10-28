-- Reporting only: preserve purchases, frozen booking prices and measured activity.
create or replace function public.get_admin_stats(p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare report jsonb; vip jsonb;
begin
  -- This also validates the date range and the active admin account.
  report := public.website_booking_stats(null,p_from,p_to);
  select jsonb_build_object(
    'revenue',coalesce(sum(amount::bigint) filter(where reviewed_at >= (p_from::timestamp at time zone 'Asia/Ho_Chi_Minh')
      and reviewed_at < ((p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh')),0),
    'purchases',count(*) filter(where reviewed_at >= (p_from::timestamp at time zone 'Asia/Ho_Chi_Minh')
      and reviewed_at < ((p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh')),
    'total_revenue',coalesce(sum(amount::bigint),0),'total_purchases',count(*),
    'active_users',(select count(*) from user_vip_memberships where enabled and paid_until>now())
  ) into vip from vip_purchases where status='approved';
  return report || jsonb_build_object('vip',vip);
end $$;

create or replace function public.admin_list_users(p_search text, p_status text, p_role text, p_page int, p_sort text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_page is null or p_page < 1 or p_page > 100000 then raise exception 'INVALID_INPUT'; end if;
  if p_sort is null or p_sort not in ('newest','hours_desc','hours_asc','usage_desc','usage_asc','bookings_desc') then raise exception 'INVALID_INPUT'; end if;
  with hours as (
    select user_id, count(*)::int as booking_count,
      count(*) filter(where status in ('confirmed','completed'))::int as confirmed_booking_count,
      coalesce(sum(extract(epoch from (ends_at-starts_at))/60) filter(where status in ('confirmed','completed')),0)::numeric as booked_minutes,
      round(coalesce(sum(extract(epoch from (ends_at-starts_at))*1000) filter(where status in ('confirmed','completed')),0))::bigint as booked_milliseconds
    from bookings group by user_id
  ), purchases as (
    -- Aggregate independently so renewals never multiply booking counts/durations.
    select user_id,count(*)::int as vip_purchase_count,sum(amount::bigint) as vip_purchase_total
    from vip_purchases where status='approved' group by user_id
  ), filtered as (
    select exists(select 1 from user_vip_memberships vip where vip.user_id=p.id and vip.enabled and vip.paid_until>now()) as is_vip,
      coalesce(u.raw_app_meta_data->>'account_kind','')='simulation' as is_simulated_account,
      p.id,p.full_name,p.phone,p.role,p.created_at,coalesce(p.admin_sort_at,p.created_at) as sort_at,u.email,
      p.banned_until,p.ban_reason,p.banned_at,coalesce(h.booked_minutes,0) as booked_minutes,coalesce(h.booking_count,0) as booking_count,
      coalesce(h.confirmed_booking_count,0) as confirmed_booking_count,coalesce(h.booked_milliseconds,0) as booked_milliseconds,
      floor(a.total_seconds)::bigint as usage_seconds,(a.total_seconds*1000)::bigint as usage_milliseconds,
      a.tracking_started_at,a.last_active_at,s.seconds as simulation_usage_seconds,
      coalesce(v.vip_purchase_count,0) as vip_purchase_count,coalesce(v.vip_purchase_total,0) as vip_purchase_total,
      coalesce(p.banned_until>now(),false) as is_banned
    from profiles p join auth.users u on u.id=p.id
    left join hours h on h.user_id=p.id
    left join purchases v on v.user_id=p.id
    left join user_activity_totals a on a.user_id=p.id
    left join user_activity_simulations s on s.user_id=p.id
    where (coalesce(p_search,'')='' or position(lower(trim(p_search)) in lower(concat_ws(' ',p.full_name,p.phone,u.email)))>0)
      and (p_role='all' or p.role::text=p_role)
  ), matched as (
    select * from filtered where p_status='all'
      or (p_status='banned' and is_banned) or (p_status='active' and not is_banned)
      or (p_status='booked' and booking_count>0) or (p_status='vip' and is_vip)
  ), page as (
    select * from matched order by
      case when p_sort='usage_desc' then coalesce(usage_milliseconds,0) end desc,
      case when p_sort='usage_asc' then coalesce(usage_milliseconds,0) end asc,
      case when p_sort='bookings_desc' then booking_count end desc,
      case when p_sort='hours_desc' then booked_minutes end desc,
      case when p_sort='hours_asc' then booked_minutes end asc,
      sort_at desc,id limit 20 offset (p_page-1)*20
  )
  select jsonb_build_object('users',coalesce((select jsonb_agg(to_jsonb(page)-'sort_at' order by
      case when p_sort='usage_desc' then coalesce(usage_milliseconds,0) end desc,
      case when p_sort='usage_asc' then coalesce(usage_milliseconds,0) end asc,
      case when p_sort='bookings_desc' then booking_count end desc,
      case when p_sort='hours_desc' then booked_minutes end desc,
      case when p_sort='hours_asc' then booked_minutes end asc,
      sort_at desc,id) from page),'[]'::jsonb),
    'total',(select count(*) from matched),
    'bookers',(select count(*) from matched where booking_count>0),
    'booking_total',(select coalesce(sum(booking_count),0) from matched),
    'measured_over_five',(select count(*) from matched where usage_milliseconds>300000),
    'bookers_measured_over_five',(select count(*) from matched where booking_count>0 and usage_milliseconds>300000),
    'bookers_sample_only_over_five',(select count(*) from matched where booking_count>0 and coalesce(usage_milliseconds,0)<=300000 and simulation_usage_seconds>300),
    'bookers_without_five_minutes',(select count(*) from matched where booking_count>0 and coalesce(usage_milliseconds,0)<=300000 and coalesce(simulation_usage_seconds,0)<=300),
    'simulation_total',(select count(*) from matched where is_simulated_account),
    'active',(select count(*) from filtered where not is_banned),
    'banned',(select count(*) from filtered where is_banned)) into v_result;
  return v_result;
end $$;

revoke all on function public.get_admin_stats(date,date) from public,anon;
revoke all on function public.admin_list_users(text,text,text,int,text) from public,anon;
grant execute on function public.get_admin_stats(date,date) to authenticated;
grant execute on function public.admin_list_users(text,text,text,int,text) to authenticated;
notify pgrst,'reload schema';
