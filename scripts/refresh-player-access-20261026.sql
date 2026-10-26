-- Refresh only the two operator-authorized batches of existing player accounts.
-- Private session setting contains credentials; never commit that input.
-- Admin confirmation enables local password login; mailbox ownership is unverified.
-- No emails, bookings, payments, notifications or sample activity are generated.
-- Defaults to rollback; replace the final rollback after a successful preflight.
begin isolation level repeatable read;
set local lock_timeout='5s';
set local statement_timeout='45s';
select pg_advisory_xact_lock(22092026);
select set_config('request.jwt.claim.sub',(select id::text from profiles where role='admin'
 and (banned_until is null or banned_until<=now()) order by created_at limit 1),true);
create temp table refresh_input on commit drop as
 select * from jsonb_to_recordset(current_setting('san_ngon.player_access',true)::jsonb)
 as x(id uuid,old_email text,email text,password text,full_name text);
create temp table before_users on commit drop as select id,to_jsonb(u) original from auth.users u;
create temp table before_profiles on commit drop as select id,to_jsonb(p) original from profiles p;
create temp table before_identities on commit drop as select id,user_id,to_jsonb(i) original from auth.identities i;
create temp table before_business on commit drop as
 select 'bookings' name,md5(coalesce(jsonb_agg(to_jsonb(b) order by b.id)::text,'')) digest from bookings b
 union all select 'payments',md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text,'')) from payments p
 union all select 'notifications',md5(coalesce(jsonb_agg(to_jsonb(n) order by n.id)::text,'')) from notifications n
 union all select 'usage',md5(coalesce(jsonb_agg(to_jsonb(a) order by a.user_id)::text,'')) from user_activity_totals a
 union all select 'sample_usage',md5(coalesce(jsonb_agg(to_jsonb(a) order by a.user_id)::text,'')) from user_activity_simulations a;
do $$ begin
 if not is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 assert (select count(*) from refresh_input)=40,'exactly forty input accounts';
 assert (select count(distinct id) from refresh_input)=40,'unique account IDs';
 assert (select count(distinct lower(email)) from refresh_input)=40,'unique login emails';
 assert (select count(*) from auth.users u join refresh_input i on i.id=u.id
  join profiles p on p.id=u.id where u.email=i.old_email and u.email like '%@example.com'
  and u.raw_app_meta_data->>'simulation_batch' in ('docs-20261026-extra-users','docs-20261026-extra-users-round2')
  and u.raw_app_meta_data->>'account_kind'='simulation' and p.role='player')=40,'only existing authorized batches';
 assert not exists(select 1 from refresh_input where email<>replace(old_email,'@example.com','@gmail.com')
  or length(password)<24),'expected domain change and strong private passwords';
 assert not exists(select 1 from auth.users u join refresh_input i on lower(u.email)=lower(i.email)
  where u.id<>i.id),'no email collisions';
 assert (select count(*) from auth.identities a join refresh_input i on i.id=a.user_id where a.provider='email')=40,'email identities ready';
 update auth.users u set email=i.email,encrypted_password=extensions.crypt(i.password,extensions.gen_salt('bf')),
  email_confirmed_at=now(),updated_at=now(),confirmation_token='',recovery_token='',
  email_change='',email_change_token_new='',
  raw_user_meta_data=u.raw_user_meta_data||jsonb_build_object('email',i.email),
  raw_app_meta_data=u.raw_app_meta_data||jsonb_build_object('provisioning','operator-password',
   'mailbox_ownership_verified',false,'login_email_updated_on','2026-10-26')
 from refresh_input i where u.id=i.id;
 update auth.identities a set identity_data=a.identity_data||jsonb_build_object('email',i.email,'email_verified',false),
  updated_at=now() from refresh_input i where a.user_id=i.id and a.provider='email';
 assert (select count(*) from auth.users)=(select count(*) from before_users),'no accounts added or deleted';
 assert not exists(select 1 from before_users b left join auth.users u on u.id=b.id
  where not exists(select 1 from refresh_input i where i.id=b.id) and to_jsonb(u) is distinct from b.original),'other accounts unchanged';
 assert not exists(select 1 from before_profiles b left join profiles p on p.id=b.id where to_jsonb(p) is distinct from b.original),'all profile information preserved';
 assert not exists(select 1 from before_identities b left join auth.identities a on a.id=b.id
  where not exists(select 1 from refresh_input i where i.id=b.user_id) and to_jsonb(a) is distinct from b.original),'other identities unchanged';
 assert (select count(*) from auth.users u join refresh_input i on i.id=u.id where
  u.email=i.email and u.email_confirmed_at is not null
  and u.encrypted_password=extensions.crypt(i.password,u.encrypted_password)
  and u.raw_app_meta_data->>'account_kind'='simulation'
  and u.raw_app_meta_data->>'mailbox_ownership_verified'='false')=40,'all logins provisioned with internal provenance';
 assert (select digest from before_business where name='bookings')=(select md5(coalesce(jsonb_agg(to_jsonb(b) order by b.id)::text,'')) from bookings b),'bookings preserved';
 assert (select digest from before_business where name='payments')=(select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text,'')) from payments p),'payments preserved';
 assert (select digest from before_business where name='notifications')=(select md5(coalesce(jsonb_agg(to_jsonb(n) order by n.id)::text,'')) from notifications n),'notifications preserved';
 assert (select digest from before_business where name='usage')=(select md5(coalesce(jsonb_agg(to_jsonb(a) order by a.user_id)::text,'')) from user_activity_totals a),'measured usage preserved';
 assert (select digest from before_business where name='sample_usage')=(select md5(coalesce(jsonb_agg(to_jsonb(a) order by a.user_id)::text,'')) from user_activity_simulations a),'sample usage preserved';
end $$;
select jsonb_build_object('updated_accounts',40,'domain','gmail.com','mailbox_ownership_verified',false,
 'all_accounts',(select count(*) from auth.users),'business_data_changed',false) result;
rollback;
