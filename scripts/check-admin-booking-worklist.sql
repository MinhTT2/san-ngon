-- Read queues, authorization and pagination; all fixtures are rolled back.
begin;
set local statement_timeout='30s';
set local lock_timeout='5s';
insert into auth.users(id) values
 ('e1200000-0000-4000-8000-000000000001'),
 ('e1200000-0000-4000-8000-000000000002');
update public.profiles set role='admin' where id='e1200000-0000-4000-8000-000000000001';
update public.profiles set role='owner',owner_application_status='active',payout_bank='MB',payout_account='1234567890'
 where id='e1200000-0000-4000-8000-000000000002';
insert into public.booking_operator(owner_id,bank,account_number,account_name,accepts_new_bookings,multi_owner_enabled)
 values('e1200000-0000-4000-8000-000000000002','MBBank','1234567890','ROLLBACK CHECK',true,false)
 on conflict(singleton) do update set owner_id=excluded.owner_id,bank=excluded.bank,account_number=excluded.account_number,
 account_name=excluded.account_name,accepts_new_bookings=true,multi_owner_enabled=false;
insert into public.venues(id,owner_id,slug,name,address,district,status)
 values('e1200000-0000-4000-8000-000000000010','e1200000-0000-4000-8000-000000000002',
 'admin-worklist-rollback','QAADMIN Cụm sân','Rollback','Test','active');
insert into public.courts(id,venue_id,name,sport)
 values('e1200000-0000-4000-8000-000000000020','e1200000-0000-4000-8000-000000000010','Sân lúc đặt','badminton');
insert into public.bookings(code,court_id,user_id,starts_at,ends_at,status,expires_at,total_amount,deposit_amount,customer_name,customer_phone,refund_status,cancelled_at)
 select 'SAN'||public.gen_booking_code(),'e1200000-0000-4000-8000-000000000020','e1200000-0000-4000-8000-000000000002',
 now()+i*interval '1 day',now()+i*interval '1 day'+interval '1 hour',
 (case when i in (1,2,-1) then 'confirmed' when i in (3,4) then 'pending' else 'cancelled' end)::public.booking_status,
 now()+case when i=4 then interval '-1 minute' else interval '10 minutes' end,
 100000,100000,case when i=40 then 'QAADMIN Khách %_ cũ' else 'QAADMIN Khách' end,'0912345678',
 (case when i=40 then 'needed' else 'none' end)::public.refund_status,case when i=40 then now()-interval '40 days' end
 from generate_series(-1,40) i;
update public.courts set name='Sân đổi tên' where id='e1200000-0000-4000-8000-000000000020';
do $$ begin
 assert not has_function_privilege('anon','public.search_admin_bookings(text,text,date,date,int)','EXECUTE');
end $$;
select set_config('request.jwt.claim.sub','e1200000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare r jsonb; first_page jsonb; begin
 r:=public.search_admin_bookings(p_query=>'QAADMIN');
 assert (r->>'total')::int=42 and (r->>'upcoming')::int=2 and (r->>'pending')::int=1 and (r->>'refund')::int=1 and (r->>'history')::int=39;
 assert (r->>'matched')::int=2 and jsonb_array_length(r->'rows')=2,'default only paid active orders';
 assert (r->'rows'->0->>'starts_at')::timestamptz<(r->'rows'->1->>'starts_at')::timestamptz,'closest play first';
 assert r->'rows'->0->>'court_name'='Sân lúc đặt','booking snapshot survives renamed court';
 r:=public.search_admin_bookings('pending','QAADMIN');
 assert (r->>'matched')::int=1 and not (r->'rows'->0->>'hold_expired')::boolean,'expired pending excluded';
 r:=public.search_admin_bookings('refund','QAADMIN');
 assert (r->>'matched')::int=1 and r->'rows'->0->>'refund_status'='needed','refund visible even for cancelled order';
 r:=public.search_admin_bookings('all','QAADMIN');first_page:=r->'rows';
 assert (r->>'matched')::int=42 and (r->>'pages')::int=2 and jsonb_array_length(first_page)=30;
 r:=public.search_admin_bookings('all','QAADMIN',p_page=>2);
 assert jsonb_array_length(r->'rows')=12;
 assert not exists(select 1 from jsonb_array_elements(first_page) a join jsonb_array_elements(r->'rows') b on a->>'id'=b->>'id'),'no duplicates between pages';
 r:=public.search_admin_bookings('all','%_');
 assert (r->>'matched')::int=1,'literal wildcard search across history';
 r:=public.search_admin_bookings('all','QAADMIN cum san');
 assert (r->>'matched')::int=42,'accent insensitive venue search';
 r:=public.search_admin_bookings('all','+84 (912) 345-678');
 assert (r->>'matched')::int>=42,'formatted phone search';
 r:=public.search_admin_bookings('all','QAADMIN',p_from=>(now() at time zone 'Asia/Ho_Chi_Minh')::date+1,p_to=>(now() at time zone 'Asia/Ho_Chi_Minh')::date+1);
 assert (r->>'matched')::int=1,'Vietnam date bounds';
 r:=public.search_admin_bookings('all','NO-QAADMIN-RESULT',p_page=>9999);
 assert (r->>'matched')::int=0 and r->'rows'='[]'::jsonb and (r->>'page')::int=1;
 begin perform public.search_admin_bookings(p_from=>'2026-10-12',p_to=>'2026-10-11');raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'INVALID_DATE_RANGE' then raise;end if;end;
 begin perform public.search_admin_bookings('fake');raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'INVALID_FILTER' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','e1200000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 begin perform public.search_admin_bookings();raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end $$;
reset role;
update public.profiles set banned_until='infinity' where id='e1200000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','e1200000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 begin perform public.search_admin_bookings();raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end $$;
reset role;
rollback;
