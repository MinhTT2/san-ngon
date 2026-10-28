-- Reporting fixtures only; no lasting accounts, receipts or usage changes.
begin;
insert into auth.users(id) values
 ('e2810000-0000-4000-8000-000000000001'),
 ('e2810000-0000-4000-8000-000000000002'),
 ('e2810000-0000-4000-8000-000000000003');
update profiles set role='admin',full_name='VIP report fixture admin' where id='e2810000-0000-4000-8000-000000000001';
update profiles set full_name='VIP precision fixture A' where id='e2810000-0000-4000-8000-000000000002';
update profiles set full_name='VIP precision fixture B' where id='e2810000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub','e2810000-0000-4000-8000-000000000001',true);
do $$
declare before_report jsonb;after_report jsonb;rows jsonb;item jsonb;
begin
 before_report:=get_admin_stats('2026-10-26','2026-10-26');
 insert into vip_purchases(user_id,bank,account_number,account_name,status,reviewed_at) values
 ('e2810000-0000-4000-8000-000000000002','MBBank','1234567890','FIXTURE','approved','2026-10-26 23:59:59.999+07'),
 ('e2810000-0000-4000-8000-000000000002','MBBank','1234567890','FIXTURE','approved','2026-10-27 00:00:00+07'),
 ('e2810000-0000-4000-8000-000000000002','MBBank','1234567890','FIXTURE','approved','2026-10-25 23:59:59.999+07'),
 ('e2810000-0000-4000-8000-000000000002','MBBank','1234567890','FIXTURE','pending',null),
 ('e2810000-0000-4000-8000-000000000003','MBBank','1234567890','FIXTURE','rejected','2026-10-26 10:00+07');
 insert into user_vip_memberships(user_id,enabled,paid_until) values
 ('e2810000-0000-4000-8000-000000000002',true,now()+interval '1 day'),
 ('e2810000-0000-4000-8000-000000000003',true,now()-interval '1 day');
 insert into user_activity_totals(user_id,total_seconds) values
 ('e2810000-0000-4000-8000-000000000002',300.001),
 ('e2810000-0000-4000-8000-000000000003',300.999);
 after_report:=get_admin_stats('2026-10-26','2026-10-26');
 assert (after_report#>>'{vip,revenue}')::bigint=(before_report#>>'{vip,revenue}')::bigint+49000,'Vietnamese date boundaries, pending/rejected excluded';
 assert (after_report#>>'{vip,purchases}')::int=(before_report#>>'{vip,purchases}')::int+1,'only approved in selected day';
 assert (after_report#>>'{vip,total_revenue}')::bigint=(before_report#>>'{vip,total_revenue}')::bigint+147000,'renewals each counted once';
 assert (after_report#>>'{vip,total_purchases}')::int=(before_report#>>'{vip,total_purchases}')::int+3,'all-time count independent of period';
 assert (after_report#>>'{vip,active_users}')::int=(before_report#>>'{vip,active_users}')::int+1,'expired membership excluded from active count';
 assert after_report->'summary'=before_report->'summary','VIP payments never become booking revenue/activity';
 update user_vip_memberships set enabled=false where user_id='e2810000-0000-4000-8000-000000000002';
 assert get_admin_stats('2026-10-26','2026-10-26')#>>'{vip,total_revenue}'=after_report#>>'{vip,total_revenue}','disabled VIP retains purchase receipts';
 update user_vip_memberships set enabled=true where user_id='e2810000-0000-4000-8000-000000000002';
 rows:=admin_list_users('VIP precision fixture','all','all',1,'usage_desc');
 assert rows#>>'{users,0,id}'='e2810000-0000-4000-8000-000000000003','sort uses milliseconds, not truncated seconds';
 assert (rows#>>'{users,0,usage_milliseconds}')::bigint=300999,'usage preserves stored milliseconds';
 assert (rows->>'measured_over_five')::int=2,'300.001 seconds exceeds five minutes';
 item:=rows#>'{users,1}';
 assert (item->>'vip_purchase_total')::bigint=147000 and (item->>'vip_purchase_count')::int=3,'per-user approved purchase totals';
 assert (item->>'booking_count')::int=0 and (item->>'booked_milliseconds')::bigint=0,'renewals do not multiply booking activity';
 rows:=admin_list_users('VIP precision fixture','vip','all',1,'newest');
 assert (rows->>'total')::int=1 and rows#>>'{users,0,id}'='e2810000-0000-4000-8000-000000000002','VIP filter uses current membership';
 assert not has_function_privilege('anon','public.get_admin_stats(date,date)','EXECUTE'),'no anonymous reporting';
 perform set_config('request.jwt.claim.sub','e2810000-0000-4000-8000-000000000002',true);
 begin perform get_admin_stats('2026-10-26','2026-10-26');raise exception 'CHECK_FAILED';
 exception when insufficient_privilege then assert sqlerrm='FORBIDDEN';end;
 begin perform admin_list_users('','vip','all',1,'newest');raise exception 'CHECK_FAILED';
 exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end $$;
rollback;
