-- Submission dates and administrative ordering are independent of signup dates.
alter table public.profiles
  add column owner_application_submitted_at timestamptz,
  add column admin_sort_at timestamptz;

update public.profiles set owner_application_submitted_at = created_at
where owner_application_status is not null;

create function public.record_owner_submission_time()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.owner_application_status = 'pending'
    and old.owner_application_status is distinct from new.owner_application_status then
    new.owner_application_submitted_at := now();
  end if;
  return new;
end $$;

revoke all on function public.record_owner_submission_time() from public, anon, authenticated;

create trigger profiles_submission_time before update of owner_application_status on public.profiles
for each row execute function public.record_owner_submission_time();

-- Neither column is writable by browser clients; existing column grants stay intact.
comment on column public.profiles.admin_sort_at is 'SQL-managed display ordering only; never an account creation date.';

notify pgrst, 'reload schema';

create or replace function public.admin_list_users(p_search text default '', p_status text default 'all', p_role text default 'all', p_page int default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_page is null or p_page < 1 or p_page > 100000 then raise exception 'INVALID_INPUT'; end if;
  with filtered as (
    select p.id, p.full_name, p.phone, p.role, p.created_at, coalesce(p.admin_sort_at, p.created_at) as sort_at, u.email,
      p.banned_until, p.ban_reason, p.banned_at,
      coalesce(p.banned_until > now(), false) as is_banned
    from profiles p join auth.users u on u.id = p.id
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
