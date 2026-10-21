begin;
set local statement_timeout='30s';
set local lock_timeout='5s';
insert into auth.users(id) values('e0240000-0000-4000-8000-000000000001');
update public.profiles set role='admin' where id='e0240000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','e0240000-0000-4000-8000-000000000001',true);
do $$ declare h jsonb;begin
 assert not has_table_privilege('authenticated','public.operational_alerts','select');
 assert not has_function_privilege('authenticated','public.refresh_operational_alerts()','execute');
 assert not has_function_privilege('authenticated','public.operational_health_snapshot()','execute');
 assert not has_function_privilege('anon','public.get_operational_health()','execute');
 h:=public.get_operational_health();
 assert jsonb_array_length(h->'checks')=9;
 assert h::text not like '%api_key%' and h::text not like '%return_message%' and h::text not like '%account_number%';
end $$;
-- Private/unrecognized deposits cannot enter the health reconciliation count.
do $$ declare before_count int;after_count int;begin
 select (v->>'count')::int into before_count from jsonb_array_elements(public.operational_health_snapshot()->'checks') v where v->>'key'='transfers:review';
 insert into public.incoming_transfers(transaction_key,bank,account_number,bank_tx_id,amount,ref_codes,raw,source,needs_review,created_at)
 values('health-private-rollback','MB','private','health-private',123,'{}','{}','unknown',true,now()-interval '2 days');
 select (v->>'count')::int into after_count from jsonb_array_elements(public.operational_health_snapshot()->'checks') v where v->>'key'='transfers:review';
 assert before_count=after_count;
end $$;
-- Deterministic transitions use a transaction-local health source; all DDL is rolled back.
create temp table health_fixture(content jsonb);
insert into health_fixture values('{"checks":[{"key":"fixture:health","title":"Kiểm tra rollback","ok":true,"detail":"Đã phục hồi"}]}');
create or replace function public.operational_health_snapshot() returns jsonb language sql stable security definer set search_path=public as
 'select content from pg_temp.health_fixture';
select public.refresh_operational_alerts();
update health_fixture set content=jsonb_set(content,'{checks,0,ok}','false');
select public.refresh_operational_alerts();
do $$ declare n int;begin
 assert (select is_open from public.operational_alerts where check_key='fixture:health');
 select count(*) into n from public.notifications where user_id=auth.uid() and title='Vận hành cần kiểm tra: Kiểm tra rollback';
 assert n=1;
 perform public.refresh_operational_alerts();
 assert (select count(*)=n from public.notifications where user_id=auth.uid() and title='Vận hành cần kiểm tra: Kiểm tra rollback');
 assert not exists(select 1 from public.notification_deliveries where user_id=auth.uid());
end $$;
update health_fixture set content=jsonb_set(content,'{checks,0,ok}','true');
select public.refresh_operational_alerts();
do $$ begin
 assert not (select is_open from public.operational_alerts where check_key='fixture:health');
 assert (select count(*)=1 from public.notifications where user_id=auth.uid() and title='Vận hành đã phục hồi: Kiểm tra rollback');
 perform public.refresh_operational_alerts();
 assert (select count(*)=1 from public.notifications where user_id=auth.uid() and title='Vận hành đã phục hồi: Kiểm tra rollback');
end $$;
update health_fixture set content=jsonb_set(content,'{checks,0,ok}','false');
select public.refresh_operational_alerts();
do $$ begin
 assert (select resolved_at is null from public.operational_alerts where check_key='fixture:health');
end $$;
set local role authenticated;
select public.get_operational_health();
reset role;
update public.profiles set role='player' where id=auth.uid();
set local role authenticated;
do $$ begin
 begin perform public.get_operational_health();raise exception 'CHECK_FAILED';exception when insufficient_privilege then null;end;
end $$;
rollback;
