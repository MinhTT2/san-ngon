create or replace function public.admin_list_users(p_search text, p_status text, p_role text, p_page int, p_sort text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_page is null or p_page < 1 or p_page > 100000 then raise exception 'INVALID_INPUT'; end if;
  if p_sort is null or p_sort not in ('newest','hours_desc','hours_asc') then raise exception 'INVALID_INPUT'; end if;
  with hours as (
    select user_id, sum(extract(epoch from (ends_at-starts_at))/60)::numeric as booked_minutes
    from bookings where status in ('confirmed','completed') group by user_id
  ), filtered as (
    select p.id, p.full_name, p.phone, p.role, p.created_at, coalesce(p.admin_sort_at, p.created_at) as sort_at, u.email,
      p.banned_until, p.ban_reason, p.banned_at, coalesce(h.booked_minutes,0) as booked_minutes,
      floor(a.total_seconds)::bigint as usage_seconds, a.tracking_started_at, a.last_active_at,
      coalesce(p.banned_until > now(), false) as is_banned
    from profiles p join auth.users u on u.id = p.id left join hours h on h.user_id=p.id left join user_activity_totals a on a.user_id=p.id
    where (coalesce(p_search, '') = '' or position(lower(trim(p_search)) in lower(concat_ws(' ', p.full_name, p.phone, u.email))) > 0)
      and (p_role = 'all' or p.role::text = p_role)
  ), matched as (
    select * from filtered where p_status = 'all'
      or (p_status = 'banned' and is_banned) or (p_status = 'active' and not is_banned)
  ), page as (select * from matched order by case when p_sort='hours_desc' then booked_minutes end desc, case when p_sort='hours_asc' then booked_minutes end asc, sort_at desc, id limit 20 offset (p_page - 1) * 20)
  select jsonb_build_object('users', coalesce((select jsonb_agg(to_jsonb(page) - 'sort_at' order by case when p_sort='hours_desc' then booked_minutes end desc, case when p_sort='hours_asc' then booked_minutes end asc, sort_at desc, id) from page), '[]'::jsonb),
    'total', (select count(*) from matched),
    'active', (select count(*) from filtered where not is_banned),
    'banned', (select count(*) from filtered where is_banned)) into v_result;
  return v_result;
end $$;


revoke all on function public.admin_list_users(text,text,text,int,text) from public, anon;
grant execute on function public.admin_list_users(text,text,text,int,text) to authenticated;
notify pgrst, 'reload schema';
