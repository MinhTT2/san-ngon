-- npx supabase db query --linked --file scripts/check-profile.sql
-- Mọi dữ liệu kiểm tra được rollback.
begin;
insert into auth.users(id) values
  ('e2800000-0000-4000-8000-000000000001'),
  ('e2800000-0000-4000-8000-000000000002');
update profiles set full_name = 'Other user', phone = '0900000002'
where id = 'e2800000-0000-4000-8000-000000000002';
insert into storage.objects(bucket_id, name, metadata) values
  ('avatars', 'e2800000-0000-4000-8000-000000000001/e2800000-0000-4000-8000-000000000001.png', '{"mimetype":"image/png","size":100}'),
  ('avatars', 'e2800000-0000-4000-8000-000000000002/e2800000-0000-4000-8000-000000000002.png', '{"mimetype":"image/png","size":100}');

do $$ begin
  assert not has_function_privilege('anon', 'public.update_profile(text,text)', 'EXECUTE'), 'anon must not edit';
  assert not has_function_privilege('anon', 'public.set_profile_avatar(text)', 'EXECUTE'), 'anon must not set avatar';
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
  result := update_profile('Nguyễn Văn An', '+84 (900) 000-001');
  assert result->>'phone' = '0900000001', '+84 normalized in SQL';
  begin
    perform update_profile('Nguyễn Văn An', '+840900000001');
    raise exception 'CHECK_FAILED: duplicate prefix accepted';
  exception when raise_exception then if sqlerrm <> 'PHONE_INVALID' then raise; end if; end;
  result := set_profile_avatar(auth.uid()::text || '/' || auth.uid()::text || '.png');
  assert result->>'avatar_url' = auth.uid()::text || '/' || auth.uid()::text || '.png', 'own avatar saved';
  begin
    perform set_profile_avatar('e2800000-0000-4000-8000-000000000002/e2800000-0000-4000-8000-000000000002.png');
    raise exception 'CHECK_FAILED: other avatar accepted';
  exception when raise_exception then if sqlerrm <> 'AVATAR_INVALID' then raise; end if; end;
  begin
    perform set_profile_avatar(auth.uid()::text || '/e2800000-0000-4000-8000-000000000099.png');
    raise exception 'CHECK_FAILED: missing file accepted';
  exception when raise_exception then if sqlerrm <> 'AVATAR_INVALID' then raise; end if; end;
  begin
    update profiles set avatar_url = 'https://example.invalid/avatar.png' where id = auth.uid();
    raise exception 'CHECK_FAILED: direct avatar update accepted';
  exception when insufficient_privilege then null; end;
  result := set_profile_avatar(null);
  assert result->>'avatar_url' is null and result->>'previous_avatar_url' is not null, 'avatar removed';
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
  begin
    perform set_profile_avatar(null);
    raise exception 'CHECK_FAILED: banned avatar write';
  exception when raise_exception then if sqlerrm <> 'ACCOUNT_BANNED' then raise; end if; end;
end $$;
reset role;
rollback;
