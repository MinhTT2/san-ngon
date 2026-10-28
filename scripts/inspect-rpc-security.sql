-- Read-only catalog inventory: no customer rows, function bodies or secrets.
select jsonb_build_object(
  'database', current_database(),
  'schema_create', jsonb_build_object(
    'anon', has_schema_privilege('anon', 'public', 'CREATE'),
    'authenticated', has_schema_privilege('authenticated', 'public', 'CREATE')),
  'functions', (select jsonb_agg(jsonb_build_object(
    'signature', p.oid::regprocedure::text,
    'owner', pg_get_userbyid(p.proowner),
    'security_definer', p.prosecdef,
    'trigger', p.prorettype = 'trigger'::regtype,
    'settings', p.proconfig,
    'anon', has_function_privilege('anon', p.oid, 'EXECUTE'),
    'authenticated', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
    'service_role', has_function_privilege('service_role', p.oid, 'EXECUTE')
  ) order by p.proname, p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and not exists (select 1 from pg_depend d
      where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'))
) as rpc_security;
