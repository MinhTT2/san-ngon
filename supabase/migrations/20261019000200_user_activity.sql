-- Informational usage estimates, independent of GA4 and never used for billing.
create table public.user_activity_totals (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  total_seconds numeric(18,3) not null default 0 check (total_seconds >= 0),
  tracking_started_at timestamptz not null default now(),
  last_active_at timestamptz,
  last_heartbeat_at timestamptz,
  session_id uuid,
  is_active boolean not null default false
);
alter table public.user_activity_totals enable row level security;
revoke all on public.user_activity_totals from public, anon, authenticated;

create function public.record_user_activity(p_session_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid();
  previous public.user_activity_totals%rowtype;
  recorded_at timestamptz;
  elapsed numeric;
begin
  if actor is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not public.account_active() then raise exception 'ACCOUNT_BANNED' using errcode = '42501'; end if;
  if p_session_id is null or p_active is null then raise exception 'INVALID_INPUT'; end if;
  if p_active then
    insert into public.user_activity_totals(user_id) values (actor) on conflict do nothing;
  end if;
  select * into previous from public.user_activity_totals where user_id = actor for update;
  if not found then return; end if;
  recorded_at := clock_timestamp();
  elapsed := greatest(0, extract(epoch from recorded_at - previous.last_heartbeat_at));
  -- A single account lease prevents double-counting across tabs and devices.
  -- Only its holder can close it. Silent/crashed sessions expire after 45s.
  if previous.session_id is distinct from p_session_id then
    if not p_active or (previous.is_active and elapsed <= 45) then return; end if;
    update public.user_activity_totals set session_id = p_session_id, is_active = true,
      last_heartbeat_at = recorded_at, last_active_at = recorded_at where user_id = actor;
    return;
  end if;
  update public.user_activity_totals set
    total_seconds = total_seconds + case when previous.is_active and elapsed <= 45 then elapsed else 0 end,
    is_active = p_active,
    last_heartbeat_at = recorded_at,
    last_active_at = case when p_active or (previous.is_active and elapsed <= 45) then recorded_at else last_active_at end
  where user_id = actor;
end $$;
revoke all on function public.record_user_activity(uuid, boolean) from public, anon;
grant execute on function public.record_user_activity(uuid, boolean) to authenticated;

-- Preserve the latest admin ordering and filters; expose totals only after SQL's admin check.
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
      floor(a.total_seconds)::bigint as usage_seconds, a.tracking_started_at, a.last_active_at
    from profiles p join auth.users u on u.id = p.id
    left join user_activity_totals a on a.user_id = p.id
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
