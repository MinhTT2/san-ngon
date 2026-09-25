-- Exercise admin permissions and stale sessions without retaining fixtures.
begin;
insert into auth.users(id) values ('e1000000-0000-4000-8000-000000000001'),('e1000000-0000-4000-8000-000000000002');
update profiles set role='admin' where id='e1000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000002',true);
do $$ begin
  begin perform admin_list_users(); raise exception 'CHECK_FAILED: player read admin list';
  exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
  begin perform admin_user_action('e1000000-0000-4000-8000-000000000001','ban','Test only',7); raise exception 'CHECK_FAILED: player banned admin';
  exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000001',true);
do $$ declare v_id uuid; begin
  begin perform admin_user_action(auth.uid(),'ban','Test only',7); raise exception 'CHECK_FAILED: self ban';
  exception when raise_exception then if sqlerrm<>'SELF_PROTECTED' then raise; end if; end;
  v_id:=admin_save_user(null,'Check user','0900000000','player','mvp-check-'||gen_random_uuid()||'@example.invalid','TestOnly!Password123');
  assert exists(select 1 from profiles where id=v_id and role='player'), 'profile created';
  assert exists(select 1 from auth.identities where user_id=v_id and provider='email'), 'email identity created';
  perform admin_save_user(v_id,'Updated user','0900000001','player');
  assert (select full_name='Updated user' from profiles where id=v_id), 'profile updated';
  perform admin_user_action(v_id,'ban','SQL rollback check',7);
  assert (select banned_until>now() from auth.users where id=v_id), 'new login blocked';
  perform set_config('request.jwt.claim.sub',v_id::text,true);
  assert not account_active(), 'stale JWT inactive';
  begin update profiles set full_name='Bypass' where id=v_id; raise exception 'CHECK_FAILED: banned write';
  exception when insufficient_privilege then assert sqlerrm='ACCOUNT_BANNED'; end;
  perform set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000001',true);
  perform admin_user_action(v_id,'unban');
  assert (select banned_until is null from auth.users where id=v_id), 'unbanned';
  perform admin_user_action(v_id,'delete');
  assert not exists(select 1 from profiles where id=v_id), 'unused account deleted';
end $$;
rollback;
