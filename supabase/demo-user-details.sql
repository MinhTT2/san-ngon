-- Enrich only the 50 explicitly marked demo players. Sends no email or SMS.
-- Run after demo-users.sql:
-- npx supabase db query --linked --file supabase/demo-user-details.sql
-- Synthetic contact values are for presentation, never verified ownership.
begin;
select pg_advisory_xact_lock(20261020, 50);
create temporary table demo_details on commit drop as
with accounts as (
  select u.id, coalesce(u.raw_user_meta_data->>'demo_original_email', u.email) as original_email,
    row_number() over (order by u.raw_user_meta_data->>'full_name', u.id)::integer as n
  from auth.users u
  where u.raw_user_meta_data->>'demo_seed' = 'demo-players-20261020'
), contacts as (
  select *, split_part(original_email, '@', 1) as handle,
    (('x' || substr(md5(id::text), 1, 7))::bit(28)::bigint % 10000000)::text as suffix
  from accounts
)
select id, original_email,
  case n % 4
    when 0 then replace(handle, '.', '') || (93 + n % 11)::text
    when 1 then handle || (1990 + n % 15)::text
    when 2 then split_part(handle, '.', 2) || '.' || split_part(handle, '.', 1)
    else replace(handle, '.', '_') || (10 + n)::text
  end || case when n % 10 = 0 then '@outlook.com'
    when n % 9 = 0 then '@yahoo.com' else '@gmail.com' end as email,
  (array['032','033','034','035','036','037','038','039','086','088','090','091','093','094','096','097','098'])[1 + n % 17]
    || lpad(suffix, 7, '0') as phone
from contacts;

do $$ begin
  if (select count(*) from demo_details) <> 50 then
    raise exception 'Expected exactly 50 marked demo accounts';
  end if;
  if exists (select 1 from demo_details d join auth.users u
    on lower(u.email) = d.email and u.id <> d.id) then
    raise exception 'Generated demo email conflicts with an existing account';
  end if;
  if exists (select 1 from demo_details d join public.profiles p
    on p.phone = d.phone and p.id <> d.id) then
    raise exception 'Generated demo phone conflicts with an existing profile';
  end if;
end $$;

update auth.users u set email = d.email,
  raw_user_meta_data = u.raw_user_meta_data || jsonb_build_object(
    'phone', d.phone, 'demo_original_email', d.original_email,
    'synthetic_contact', true)
from demo_details d where u.id = d.id;

update auth.identities i set identity_data = i.identity_data ||
  jsonb_build_object('email', d.email, 'email_verified', false)
from demo_details d where i.user_id = d.id and i.provider = 'email';

update public.profiles p set phone = d.phone
from demo_details d where p.id = d.id;

do $$ begin
  if (select count(distinct email) from demo_details) <> 50
    or (select count(distinct phone) from demo_details) <> 50
    or exists (select 1 from demo_details d
      join auth.users u on u.id = d.id join public.profiles p on p.id = d.id
      where u.email <> d.email or p.phone is distinct from d.phone
        or p.created_at <> u.created_at or p.role <> 'player'
        or p.phone !~ '^0[0-9]{9}$') then
    raise exception 'Demo contact verification failed';
  end if;
end $$;
commit;

select count(*) as demo_users, count(distinct u.email) as unique_emails,
  count(distinct p.phone) as unique_phones, count(distinct p.created_at) as join_times
from auth.users u join public.profiles p on p.id = u.id
where u.raw_user_meta_data->>'demo_seed' = 'demo-players-20261020';
