-- Second authorized batch: twenty more explicitly simulated accounts.
-- No emails are sent, no real contact details, no known passwords, no usage.
-- Run through trusted SQL administration after taking a private backup.
-- Defaults to rollback; replace only the last ROLLBACK with COMMIT to apply.
begin isolation level repeatable read;
set local lock_timeout='5s';
set local statement_timeout='45s';
select pg_advisory_xact_lock(2026102604);
select set_config('request.jwt.claim.sub',(select id::text from profiles where role='admin'
 and (banned_until is null or banned_until<=now()) order by created_at limit 1),true);
create temp table before_users on commit drop as select id,to_jsonb(u) original from auth.users u;
create temp table before_profiles on commit drop as select id,to_jsonb(p) original from profiles p;
create temp table before_counts on commit drop as select
 (select count(*) from bookings) bookings,(select count(*) from payments) payments,
 (select count(*) from notifications) notifications,(select count(*) from user_activity_totals) measured_usage,
 (select count(*) from user_activity_simulations) simulated_usage;
create temp table demo_people(full_name text,email text primary key) on commit drop;
insert into demo_people values
 ('Nguyễn Quốc Bảo','quocbao.nguyen.2610b@example.com'),
 ('Trần Minh Đức','minhduc.tran.2610b@example.com'),
 ('Lê Anh Tuấn','anhtuan.le.2610b@example.com'),
 ('Phạm Đức Huy','duchuy.pham.2610b@example.com'),
 ('Hoàng Tuấn Minh','tuanminh.hoang.2610b@example.com'),
 ('Vũ Quang Hưng','quanghung.vu.2610b@example.com'),
 ('Đặng Tiến Phát','tienphat.dang.2610b@example.com'),
 ('Bùi Hoàng Sơn','hoangson.bui.2610b@example.com'),
 ('Đỗ Gia Bảo','giabao.do.2610b@example.com'),
 ('Hồ Nam Phong','namphong.ho.2610b@example.com'),
 ('Nguyễn Hà My','hamy.nguyen.2610b@example.com'),
 ('Trần Bảo Anh','baoanh.tran.2610b@example.com'),
 ('Lê Ngọc Hân','ngochan.le.2610b@example.com'),
 ('Phạm Khánh Ngọc','khanhngoc.pham.2610b@example.com'),
 ('Hoàng Thảo Vy','thaovy.hoang.2610b@example.com'),
 ('Vũ Minh Thư','minhthu.vu.2610b@example.com'),
 ('Đặng Hải Yến','haiyen.dang.2610b@example.com'),
 ('Bùi Nhã Uyên','nhauyen.bui.2610b@example.com'),
 ('Đỗ Thanh Mai','thanhmai.do.2610b@example.com'),
 ('Hồ Phương Linh','phuonglinh.ho.2610b@example.com');
do $$ declare person record; new_id uuid; report jsonb; begin
 if not is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 if exists(select 1 from auth.users where raw_app_meta_data->>'simulation_batch'='docs-20261026-extra-users-round2')
 then raise exception 'DEMO_BATCH_ALREADY_EXISTS';end if;
 if exists(select 1 from auth.users u join demo_people d on lower(u.email)=d.email)
 then raise exception 'EMAIL_COLLISION';end if;
 for person in select * from demo_people order by email loop
  new_id:=admin_save_user(null,person.full_name,'','player',person.email,encode(extensions.gen_random_bytes(32),'hex'));
  update auth.users set email_confirmed_at=null,
   raw_app_meta_data=raw_app_meta_data||jsonb_build_object('account_kind','simulation','simulation_batch','docs-20261026-extra-users-round2')
   where id=new_id;
  update auth.identities set identity_data=identity_data||jsonb_build_object('email_verified',false) where user_id=new_id;
 end loop;
 assert (select count(*) from auth.users)=(select count(*)+20 from before_users),'exactly twenty Auth accounts added';
 assert (select count(*) from profiles)=(select count(*)+20 from before_profiles),'exactly twenty profiles added';
 assert not exists(select 1 from before_users b left join auth.users u on u.id=b.id where to_jsonb(u) is distinct from b.original),'existing accounts unchanged';
 assert not exists(select 1 from before_profiles b left join profiles p on p.id=b.id where to_jsonb(p) is distinct from b.original),'existing profiles unchanged';
 assert (select count(*) from auth.users u join demo_people d on u.email=d.email where u.raw_app_meta_data->>'account_kind'='simulation' and u.email_confirmed_at is null)=20,'all twenty marked and unverified';
 assert not exists(select 1 from profiles p join auth.users u on u.id=p.id join demo_people d on d.email=u.email where p.phone is not null or p.role<>'player'),'no fake phone or privileged account';
 assert (select count(*) from bookings)=(select bookings from before_counts),'bookings unchanged';
 assert (select count(*) from payments)=(select payments from before_counts),'payments unchanged';
 assert (select count(*) from notifications)=(select notifications from before_counts),'no notifications';
 assert (select count(*) from user_activity_totals)=(select measured_usage from before_counts),'no measured usage invented';
 assert (select count(*) from user_activity_simulations)=(select simulated_usage from before_counts),'existing simulated usage unchanged';
 report:=admin_list_users('@example.com','all','all',1,'newest');
 assert (report->>'simulation_total')::int>=20,'admin explicitly counts demo accounts';
end $$;
select jsonb_build_object('all_accounts',(select count(*) from auth.users),'added_demo_accounts',20,
 'simulation_accounts',(select count(*) from auth.users where raw_app_meta_data->>'account_kind'='simulation')) result;
rollback;
