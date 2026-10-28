-- Read-only backup of exactly the functions touched by migration 20261028000200.
-- Save the output privately outside Git before deploying; no customer rows or Vault.
with functions as (
  select p.*, format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) as signature
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = any(array[
    'gen_booking_code','unaccent_vi','slugify',
    'register_owner','create_venue','update_venue','delete_venue',
    'create_court','update_court','delete_court','get_owner_stats',
    'check_booking_court_open','handle_new_user','notify_owner_application_submitted',
    'reject_banned_write','require_active_venue_court','require_active_venue_has_court',
    'require_profile_payout_for_active_venues','require_venue_payout',
    'require_venue_photos_before_publish','validate_venue_fields'
  ])
)
select jsonb_build_object(
  'database', current_database(), 'captured_at', now(),
  'migration_versions', (select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
  'functions', (select jsonb_agg(jsonb_build_object(
    'signature', p.signature, 'owner', pg_get_userbyid(p.proowner),
    'definition', pg_get_functiondef(p.oid), 'acl', p.proacl,
    -- Only these three grantees are changed by the candidate migration.
    -- CREATE OR REPLACE preserves the remaining roles' existing grants.
    'restore_sql', pg_get_functiondef(p.oid) || E'\n' ||
      format('revoke execute on function %s from public, anon, authenticated;', p.signature) || E'\n' ||
      coalesce((select string_agg(format('grant execute on function %s to %s%s;', p.signature,
        case when a.grantee = 0 then 'public' else quote_ident(pg_get_userbyid(a.grantee)) end,
        case when a.is_grantable then ' with grant option' else '' end), E'\n' order by a.grantee)
        from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where a.grantee = 0 or pg_get_userbyid(a.grantee) in ('anon','authenticated')), '')
  ) order by p.proname, p.oid) from functions p)
) as rpc_backup;
