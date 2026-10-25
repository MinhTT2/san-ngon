-- Read-only operational inventory. No customer data, credentials, commands or changes.
select jsonb_build_object(
  'rollback_fixture_users', (select count(*) from auth.users
    where left(id::text, 8) in ('a0000000','e0930000','e0900000','c0000000','e9f10000','e1030000')),
  'operator', (select jsonb_build_object('multi_owner_enabled',multi_owner_enabled,'accepts_new_bookings',accepts_new_bookings) from public.booking_operator),
  'cron', (select jsonb_agg(jsonb_build_object('name',jobname,'active',active) order by jobname) from cron.job),
  'realtime_tables', (select jsonb_agg(tablename order by tablename) from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public')
) as readiness;
