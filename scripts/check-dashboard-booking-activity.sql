-- Roll back all fixtures; completed unpaid bookings must never become revenue.
begin;
insert into auth.users(id, created_at) values
 ('da190000-0000-4000-8000-000000000001','2026-09-01'),
 ('da190000-0000-4000-8000-000000000002','2026-09-02'),
 ('da190000-0000-4000-8000-000000000003','2026-09-03');
update profiles set full_name='Dashboard SQL check admin',role='admin' where id='da190000-0000-4000-8000-000000000001';
update profiles set full_name='Dashboard SQL check owner',role='owner',payout_bank='MBBank',payout_account='1234567890',owner_application_status='pending' where id='da190000-0000-4000-8000-000000000002';
update profiles set full_name='Dashboard SQL check player' where id='da190000-0000-4000-8000-000000000003';
insert into venues(id,owner_id,slug,name,address,district,status) values
 ('da190000-0000-4000-8000-000000000004','da190000-0000-4000-8000-000000000002','dashboard-sql-check','Dashboard SQL check venue','Fixture','Fixture','active');
insert into courts(id,venue_id,name,sport) values
 ('da190000-0000-4000-8000-000000000005','da190000-0000-4000-8000-000000000004','Fixture court','badminton');
-- Only this short rollback transaction changes the singleton.
update profiles set owner_application_status='active' where id='da190000-0000-4000-8000-000000000002';
insert into public.booking_operator(owner_id,bank,account_number,account_name,accepts_new_bookings,multi_owner_enabled)
values ('da190000-0000-4000-8000-000000000002','MBBank','1234567890','ROLLBACK FIXTURE',true,false)
on conflict(singleton) do update set owner_id=excluded.owner_id,bank=excluded.bank,account_number=excluded.account_number,account_name=excluded.account_name,accepts_new_bookings=true,multi_owner_enabled=false;
insert into bookings(id,code,court_id,user_id,starts_at,ends_at,total_amount,deposit_amount,status,refund_status,customer_phone,paid_at) values
 ('da190000-0000-4000-8000-000000000006','SANZZZ2AA','da190000-0000-4000-8000-000000000005','da190000-0000-4000-8000-000000000003','2026-10-14 18:00+07','2026-10-14 19:00+07',100000,100000,'completed','none','0900000000',null),
 ('da190000-0000-4000-8000-000000000007','SANZZZ2AB','da190000-0000-4000-8000-000000000005','da190000-0000-4000-8000-000000000003','2026-10-15 18:00+07','2026-10-15 19:00+07',100000,100000,'completed','none','0900000000','2026-10-16 00:30+07');
insert into payments(booking_id,ref_code,amount,status,paid_at) values
 ('da190000-0000-4000-8000-000000000007','SANZZZ2AB',75000,'paid','2026-10-16 00:30+07');
update profiles set admin_sort_at='2026-08-01' where id='da190000-0000-4000-8000-000000000003';
do $$ begin
 assert not has_column_privilege('authenticated','public.profiles','admin_sort_at','UPDATE'), 'browser must not change sorting';
 assert not has_column_privilege('authenticated','public.profiles','owner_application_submitted_at','UPDATE'), 'browser must not change submission time';
 assert (select owner_application_submitted_at=now() from profiles where id='da190000-0000-4000-8000-000000000002'), 'submission trigger records actual submit time';
end $$;
select set_config('request.jwt.claim.sub','da190000-0000-4000-8000-000000000002',true);
do $$ declare report jsonb; begin
 report:=get_owner_stats('da190000-0000-4000-8000-000000000004','2026-10-12','2026-10-18');
 assert (report#>>'{summary,bookings}')::int=2, 'two operational bookings';
 assert (report#>>'{summary,revenue}')::int=75000, 'only actual confirmed money counts';
 assert (report#>>'{summary,paid_bookings}')::int=1, 'unpaid demo excluded from receipts';
 assert (report#>>'{daily,2,playing_bookings}')::int=1, 'Wednesday playing activity';
 assert (report#>>'{daily,3,playing_bookings}')::int=1, 'Thursday playing activity';
 assert (report#>>'{daily,4,revenue}')::int=75000, 'receipt uses Vietnamese date, separately from playing day';
 assert (report#>>'{daily,4,playing_bookings}')::int=0, 'no playing activity on receipt date';
 assert not (report ? 'activity_venues') and not (report ? 'venues'), 'owner never gets other venues';
 begin perform admin_list_users(); raise exception 'CHECK_FAILED'; exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','da190000-0000-4000-8000-000000000001',true);
do $$ declare page jsonb; report jsonb; begin
 page:=admin_list_users('Dashboard SQL check','all','all',1);
 assert page#>>'{users,2,id}'='da190000-0000-4000-8000-000000000003', 'custom ordering before pagination';
 assert not (page#>'{users,0}' ? 'sort_at'), 'private sort metadata stays internal';
 report:=get_admin_stats('2026-10-12','2026-10-18');
 assert exists(select 1 from jsonb_array_elements(report->'activity_venues') v where v->>'id'='da190000-0000-4000-8000-000000000004' and (v->>'playing_bookings')::int=2), 'venue activity includes unpaid completed bookings';
end $$;
rollback;
