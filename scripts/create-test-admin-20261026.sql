-- Dedicated admin access requested by the operator; existing credentials stay intact.
-- Supply san_ngon.test_admin_password through a private SQL session, never Git.
-- Defaults to rollback. Trusted SQL administration only.
begin isolation level repeatable read;
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(2026102605);
select set_config('request.jwt.claim.sub',(select id::text from profiles where role='admin'
 and (banned_until is null or banned_until<=now()) order by created_at limit 1),true);
create temp table before_users on commit drop as select id,to_jsonb(u) original from auth.users u;
create temp table before_profiles on commit drop as select id,to_jsonb(p) original from profiles p;
do $$ declare new_id uuid; secret text;report jsonb;begin
 if not is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 secret:=current_setting('san_ngon.test_admin_password',true);
 if secret is null or length(secret)<24 then raise exception 'PRIVATE_PASSWORD_REQUIRED';end if;
 if exists(select 1 from auth.users where lower(email)='admin.test.2610@example.com') then raise exception 'TEST_ADMIN_ALREADY_EXISTS';end if;
 new_id:=admin_save_user(null,'Admin kiểm thử 26/10','','admin','admin.test.2610@example.com',secret);
 update auth.users set raw_app_meta_data=raw_app_meta_data||jsonb_build_object(
  'account_kind','simulation','simulation_batch','admin-test-20261026') where id=new_id;
 assert (select count(*) from auth.users)=(select count(*)+1 from before_users),'one account added';
 assert (select count(*) from profiles)=(select count(*)+1 from before_profiles),'one profile added';
 assert not exists(select 1 from before_users b left join auth.users u on u.id=b.id where to_jsonb(u) is distinct from b.original),'existing credentials unchanged';
 assert not exists(select 1 from before_profiles b left join profiles p on p.id=b.id where to_jsonb(p) is distinct from b.original),'existing profiles unchanged';
 assert exists(select 1 from auth.identities where user_id=new_id and provider='email'),'email login identity';
 assert exists(select 1 from auth.users where id=new_id and email_confirmed_at is not null),'email login ready';
 perform set_config('request.jwt.claim.sub',new_id::text,true);
 assert is_admin(),'new account has admin access';
 report:=admin_list_users('admin.test.2610@example.com','all','all',1,'newest');
 assert (report->>'total')::int=1 and report#>>'{users,0,role}'='admin','account visible to admin';
 assert (report#>>'{users,0,is_simulated_account}')::boolean,'test identity is labeled';
end $$;
select jsonb_build_object('email','admin.test.2610@example.com','role','admin','existing_credentials_changed',false) result;
rollback;
