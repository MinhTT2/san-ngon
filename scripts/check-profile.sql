-- npx supabase db query --linked --file scripts/check-profile.sql
-- Mọi dữ liệu kiểm tra được rollback.
begin;
insert into auth.users(id) values
  ('e2800000-0000-4000-8000-000000000001'),
  ('e2800000-0000-4000-8000-000000000002');
update profiles set full_name = 'Other user', phone = '0900000002'
where id = 'e2800000-0000-4000-8000-000000000002';

do $$ begin
  assert not has_function_privilege('anon', 'public.update_profile(text,text)', 'EXECUTE'), 'anon must not edit';
  begin
    perform update_profile('Test user', '0900000001');
    raise exception 'CHECK_FAILED: missing session accepted';
  exception when raise_exception then if sqlerrm <> 'AUTH_REQUIRED' then raise; end if; end;
end $$;

select set_config('request.jwt.claim.sub', 'e2800000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$ declare result jsonb; begin
  result := update_profile('  Nguyễn Văn An  ', ' 0900000001 ');
  assert result = '{"full_name":"Nguyễn Văn An","phone":"0900000001"}'::jsonb, 'saved and trimmed';
  assert (select full_name = 'Nguyễn Văn An' and phone = '0900000001' and role = 'player'
    and owner_application_status is null from profiles where id = auth.uid()), 'own profile saved without promotion';
  begin
    perform update_profile(' ', '0900000001');
    raise exception 'CHECK_FAILED: empty name accepted';
  exception when raise_exception then if sqlerrm <> 'NAME_INVALID' then raise; end if; end;
  begin
    perform update_profile(repeat('A', 101), '0900000001');
    raise exception 'CHECK_FAILED: long name accepted';
  exception when raise_exception then if sqlerrm <> 'NAME_INVALID' then raise; end if; end;
  begin
    perform update_profile('Test user', '123');
    raise exception 'CHECK_FAILED: bad phone accepted';
  exception when raise_exception then if sqlerrm <> 'PHONE_INVALID' then raise; end if; end;
  update profiles set full_name = 'Bypass' where id = 'e2800000-0000-4000-8000-000000000002';
  assert not found, 'cannot edit another profile';
  begin
    update profiles set role = 'admin' where id = auth.uid();
    raise exception 'CHECK_FAILED: role escalation';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  assert (select full_name = 'Other user' and phone = '0900000002'
    from profiles where id = 'e2800000-0000-4000-8000-000000000002'), 'other profile unchanged';
end $$;
update profiles set banned_until = 'infinity' where id = auth.uid();
set local role authenticated;
do $$ begin
  begin
    perform update_profile('Bypass ban', '0900000001');
    raise exception 'CHECK_FAILED: banned account accepted';
  exception when raise_exception then if sqlerrm <> 'ACCOUNT_BANNED' then raise; end if; end;
end $$;
reset role;
rollback;
