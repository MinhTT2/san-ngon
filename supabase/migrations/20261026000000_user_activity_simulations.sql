-- Presentation durations stay separate from server-measured account activity.
create table public.user_activity_simulations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  seconds integer not null check (seconds between 300 and 600),
  batch text not null check (length(batch) between 1 and 100)
);
alter table public.user_activity_simulations enable row level security;
revoke all on public.user_activity_simulations from public, anon, authenticated;
comment on table public.user_activity_simulations is 'SQL-managed synthetic presentation data; never actual usage or GA4.';

create or replace function public.admin_list_users(p_search text default '', p_status text default 'all', p_role text default 'all', p_page int default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_page is null or p_page < 1 or p_page > 100000 then raise exception 'INVALID_INPUT'; end if;
  with filtered as (
    select p.id, p.full_name, p.phone, p.role, p.created_at, coalesce(p.admin_sort_at, p.created_at) as sort_at, u.email,
      p.banned_until, p.ban_reason, p.banned_at,
      coalesce(p.banned_until > now(), false) as is_banned,
      floor(a.total_seconds)::bigint as usage_seconds, a.tracking_started_at, a.last_active_at,
      s.seconds as simulation_usage_seconds
    from profiles p join auth.users u on u.id = p.id
    left join user_activity_totals a on a.user_id = p.id
    left join user_activity_simulations s on s.user_id = p.id
    where (coalesce(p_search, '') = '' or position(lower(trim(p_search)) in lower(concat_ws(' ', p.full_name, p.phone, u.email))) > 0)
      and (p_role = 'all' or p.role::text = p_role)
  ), matched as (
    select * from filtered where p_status = 'all'
      or (p_status = 'banned' and is_banned) or (p_status = 'active' and not is_banned)
  ), page as (select * from matched order by sort_at desc, id limit 20 offset (p_page - 1) * 20)
  select jsonb_build_object('users', coalesce((select jsonb_agg(to_jsonb(page) - 'sort_at' order by sort_at desc, id) from page), '[]'::jsonb),
    'total', (select count(*) from matched),
    'active', (select count(*) from filtered where not is_banned),
    'banned', (select count(*) from filtered where is_banned)) into v_result;
  return v_result;
end $$;
notify pgrst, 'reload schema';
