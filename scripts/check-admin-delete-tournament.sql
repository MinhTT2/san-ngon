-- Disposable fixtures, all changes rolled back; no payment/provider calls.
begin;
set local statement_timeout='30s';
set local lock_timeout='5s';
insert into auth.users(id) values
 ('ed090000-0000-4000-8000-000000000001'),('ed090000-0000-4000-8000-000000000002');
update profiles set role='admin' where id='ed090000-0000-4000-8000-000000000001';
insert into venues(id,owner_id,name,slug,address,district,status,open_time,close_time)
values('ed090000-0000-4000-8000-000000000010','ed090000-0000-4000-8000-000000000002','Test xóa giải','test-delete-tournament-rollback','Địa chỉ kiểm tra','Cầu Giấy','draft','06:00','23:00');
insert into courts(id,venue_id,name,sport)
values('ed090000-0000-4000-8000-000000000011','ed090000-0000-4000-8000-000000000010','Sân test','badminton');
insert into tournaments(id,manager_id,court_id,title,description,sport,address,starts_at,ends_at,registration_deadline,payment_deadline,capacity,entry_fee,deposit_amount,status)
select ('ed090000-0000-4000-8000-0000000000'||n)::uuid,'ed090000-0000-4000-8000-000000000002','ed090000-0000-4000-8000-000000000011',
 'Giải kiểm tra xóa','Thể lệ kiểm tra đủ dài','badminton','Địa chỉ kiểm tra',now()+interval '10 days',now()+interval '11 days',now()+interval '9 days',now()+interval '10 days',4,0,0,
 case when n=20 then 'published' else 'pending' end from generate_series(20,23) n;
insert into court_closures(court_id,starts_at,ends_at,reason,tournament_id)
values('ed090000-0000-4000-8000-000000000011',now()+interval '10 days',now()+interval '11 days','Giải kiểm tra','ed090000-0000-4000-8000-000000000020');
insert into tournament_settlements(tournament_id,owner_id,venue_fee,agreed_at,due_at)
values('ed090000-0000-4000-8000-000000000020','ed090000-0000-4000-8000-000000000002',0,now(),now()+interval '18 days'),
 ('ed090000-0000-4000-8000-000000000022','ed090000-0000-4000-8000-000000000002',100000,now(),now()+interval '18 days');
insert into tournament_registrations(tournament_id,user_id,full_name,phone,address,code,entry_fee,deposit_amount)
values('ed090000-0000-4000-8000-000000000021','ed090000-0000-4000-8000-000000000002','Người kiểm tra','0900000002','Địa chỉ kiểm tra','GIAIED0900000021',0,0);
select set_config('request.jwt.claim.sub','ed090000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 begin perform delete_tournament('ed090000-0000-4000-8000-000000000020');raise exception 'CHECK_FAILED';
 exception when others then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','ed090000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 begin perform delete_tournament('ed090000-0000-4000-8000-000000000021');raise exception 'CHECK_FAILED';
 exception when others then if sqlerrm<>'TOURNAMENT_HAS_REGISTRATIONS' then raise;end if;end;
 begin perform delete_tournament('ed090000-0000-4000-8000-000000000022');raise exception 'CHECK_FAILED';
 exception when others then if sqlerrm<>'TOURNAMENT_HAS_SETTLEMENT' then raise;end if;end;
 perform delete_tournament('ed090000-0000-4000-8000-000000000020');
 perform delete_tournament('ed090000-0000-4000-8000-000000000023');
 begin perform delete_tournament('ed090000-0000-4000-8000-000000000023');raise exception 'CHECK_FAILED';
 exception when others then if sqlerrm<>'TOURNAMENT_NOT_FOUND' then raise;end if;end;
end $$;
reset role;
do $$ begin
 assert not exists(select 1 from tournaments where id in ('ed090000-0000-4000-8000-000000000020','ed090000-0000-4000-8000-000000000023'));
 assert not exists(select 1 from court_closures where tournament_id='ed090000-0000-4000-8000-000000000020');
 assert not exists(select 1 from notifications where tournament_id='ed090000-0000-4000-8000-000000000020');
 assert not exists(select 1 from tournament_settlements where tournament_id='ed090000-0000-4000-8000-000000000020');
 assert (select count(*)=2 from tournaments where id in ('ed090000-0000-4000-8000-000000000021','ed090000-0000-4000-8000-000000000022'));
 assert not has_function_privilege('anon','public.delete_tournament(uuid)','EXECUTE');
 assert not has_table_privilege('authenticated','public.tournaments','DELETE');
end $$;
rollback;
