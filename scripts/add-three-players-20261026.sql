-- Three operator-provisioned player accounts; no email delivery or activity fabrication.
-- Credentials arrive through private san_ngon.extra_players JSON in this transaction.
-- Default rollback; only commit after inspecting preflight and saving a private backup.
begin isolation level repeatable read;
set local lock_timeout='5s';
set local statement_timeout='45s';
select pg_advisory_xact_lock(22092026);
select set_config('request.jwt.claim.sub',(select id::text from profiles where role='admin'
 and (banned_until is null or banned_until<=now()) order by created_at limit 1),true);
create temp table extra_input on commit drop as
 select * from jsonb_to_recordset(current_setting('san_ngon.extra_players',true)::jsonb)
 as x(full_name text,email text,password text);
create temp table before_users on commit drop as select id,to_jsonb(u) original from auth.users u;
create temp table before_profiles on commit drop as select id,to_jsonb(p) original from profiles p;
create temp table before_business on commit drop as
 select 'bookings' name,md5(coalesce(jsonb_agg(to_jsonb(b) order by b.id)::text,'')) digest from bookings b
 union all select 'payments',md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text,'')) from payments p
 union all select 'notifications',md5(coalesce(jsonb_agg(to_jsonb(n) order by n.id)::text,'')) from notifications n
 union all select 'usage',md5(coalesce(jsonb_agg(to_jsonb(a) order by a.user_id)::text,'')) from user_activity_totals a
 union all select 'sample_usage',md5(coalesce(jsonb_agg(to_jsonb(a) order by a.user_id)::text,'')) from user_activity_simulations a;
do $$ declare person record;new_id uuid;begin
 if not is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 assert (select count(*) from extra_input)=3,'exactly three input accounts';
 assert (select count(distinct lower(email)) from extra_input)=3,'unique email inputs';
 assert not exists(select 1 from extra_input where length(password)<24),'strong private passwords';
 if exists(select 1 from auth.users where raw_app_meta_data->>'simulation_batch'='users-extra3-20261026')
 then raise exception 'BATCH_ALREADY_APPLIED';end if;
 if exists(select 1 from auth.users u join extra_input i on lower(u.email)=lower(i.email))
 then raise exception 'EMAIL_COLLISION';end if;
 for person in select * from extra_input order by email loop
  new_id:=admin_save_user(null,person.full_name,'','player',person.email,person.password);
  update auth.users set raw_app_meta_data=raw_app_meta_data||jsonb_build_object(
   'account_kind','simulation','simulation_batch','users-extra3-20261026',
   'provisioning','operator-password','mailbox_ownership_verified',false) where id=new_id;
  update auth.identities set identity_data=identity_data||jsonb_build_object('email_verified',false)
   where user_id=new_id and provider='email';
 end loop;
 assert (select count(*) from auth.users)=(select count(*)+3 from before_users),'three auth accounts added';
 assert (select count(*) from profiles)=(select count(*)+3 from before_profiles),'three profiles added';
 assert not exists(select 1 from before_users b left join auth.users u on u.id=b.id where to_jsonb(u) is distinct from b.original),'existing users unchanged';
 assert not exists(select 1 from before_profiles b left join profiles p on p.id=b.id where to_jsonb(p) is distinct from b.original),'existing profiles unchanged';
 assert (select digest from before_business where name='bookings')=(select md5(coalesce(jsonb_agg(to_jsonb(b) order by b.id)::text,'')) from bookings b),'bookings preserved';
 assert (select digest from before_business where name='payments')=(select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text,'')) from payments p),'payments preserved';
 assert (select digest from before_business where name='notifications')=(select md5(coalesce(jsonb_agg(to_jsonb(n) order by n.id)::text,'')) from notifications n),'notifications preserved';
 assert (select digest from before_business where name='usage')=(select md5(coalesce(jsonb_agg(to_jsonb(a) order by a.user_id)::text,'')) from user_activity_totals a),'measured usage preserved';
 assert (select digest from before_business where name='sample_usage')=(select md5(coalesce(jsonb_agg(to_jsonb(a) order by a.user_id)::text,'')) from user_activity_simulations a),'sample usage preserved';
 assert (select count(*) from auth.users u join extra_input i on i.email=u.email
  join profiles p on p.id=u.id where p.role='player' and u.email_confirmed_at is not null
  and u.encrypted_password=extensions.crypt(i.password,u.encrypted_password))=3,'three working player credentials';
end $$;
select jsonb_build_object('added',3,'players',(select count(*) from profiles where role='player'),
 'total_accounts',(select count(*) from auth.users),
 'users',(select jsonb_agg(jsonb_build_object('id',u.id,'email',u.email)) from auth.users u
  join extra_input i on i.email=u.email)) result;
rollback;
