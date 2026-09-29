-- Run via: npx supabase db query --linked --file scripts/check-tournaments.sql
-- Disposable fixtures, always rolled back. No real bank transfer is made.
begin;
insert into auth.users(id) values
 ('e2900000-0000-4000-8000-000000000001'),('e2900000-0000-4000-8000-000000000002'),
 ('e2900000-0000-4000-8000-000000000003'),('e2900000-0000-4000-8000-000000000004');
update profiles set role='admin',owner_application_status='active' where id='e2900000-0000-4000-8000-000000000001';
update profiles set role='owner',owner_application_status='active',payout_bank='TestBank',payout_account='123456789' where id='e2900000-0000-4000-8000-000000000002';
insert into venues(id,owner_id,name,slug,address,district,status,open_time,close_time)
values('e2900000-0000-4000-8000-000000000010','e2900000-0000-4000-8000-000000000002','Test giải','test-giai-rollback','Địa chỉ kiểm tra','Cầu Giấy','draft','06:00','23:00');
update venues set status='active', images='{test1,test2,test3}' where id='e2900000-0000-4000-8000-000000000010';
insert into courts(id,venue_id,name,sport) values('e2900000-0000-4000-8000-000000000011','e2900000-0000-4000-8000-000000000010','Sân test','badminton');
update booking_operator set multi_owner_enabled=true;
insert into sepay_connections(id,owner_id,status,bank,account_number,account_name)
values('e2900000-0000-4000-8000-000000000020','e2900000-0000-4000-8000-000000000002','ready','TestBank','123456789','Test Owner');

select set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ declare id uuid; begin
 id:=submit_tournament(jsonb_build_object('title','Giải kiểm tra','description','Thể lệ kiểm tra đủ dài','sport','badminton','court_id','','address','Khu vực Cầu Giấy',
 'starts_at',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '10 days','YYYY-MM-DD"T"10:00'),
 'ends_at',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '10 days','YYYY-MM-DD"T"12:00'),
 'registration_deadline',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '9 days','YYYY-MM-DD"T"10:00'),
 'capacity',2,'entry_fee',200000,'deposit_amount',100000));
 perform set_config('test.tournament',id::text,true);
 assert (select status='pending' and manager_id=auth.uid() from tournaments where tournaments.id=current_setting('test.tournament')::uuid);
 begin
  perform submit_tournament((select to_jsonb(t)||'{"ends_at":"infinity","court_id":""}'::jsonb from tournaments t where t.id=current_setting('test.tournament')::uuid));
  raise exception 'TEST: infinite dates accepted';
 exception when check_violation then null; end;
 begin
  perform review_tournament(id,true,'e2900000-0000-4000-8000-000000000011','');
  raise exception 'TEST: player approved tournament';
 exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
 begin
  update tournaments set status='published' where tournaments.id=current_setting('test.tournament')::uuid;
  raise exception 'TEST: direct tournament update';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000001',true);
set local role authenticated;
select review_tournament(current_setting('test.tournament')::uuid,true,'e2900000-0000-4000-8000-000000000011','Đã xác nhận sân');
reset role;
do $$ begin
 assert exists(select 1 from court_closures where tournament_id=current_setting('test.tournament')::uuid),'reserved court';
 assert (select role='player' from profiles where id='e2900000-0000-4000-8000-000000000003'),'organizer was not promoted';
end $$;
select set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $$ declare id uuid; begin
 id:=register_tournament(current_setting('test.tournament')::uuid,'{"full_name":"Người chơi test","phone":"+84 900 000 004","address":"Hà Nội","team_name":"Đội test","note":""}');
 perform set_config('test.registration',id::text,true);
 assert (select phone='0900000004' and deposit_amount=100000 and bank is null from tournament_registrations where tournament_registrations.id=current_setting('test.registration')::uuid);
 begin
  perform review_tournament_registration(id,true,''); raise exception 'TEST: participant approved self';
 exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
 begin
  update tournament_registrations set paid_at=now() where tournament_registrations.id=current_setting('test.registration')::uuid; raise exception 'TEST: self payment';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000003',true);
set local role authenticated;
select review_tournament_registration(current_setting('test.registration')::uuid,true,'Chào mừng');
reset role;
do $$ declare r tournament_registrations; result jsonb; begin
 select * into r from tournament_registrations where id=current_setting('test.registration')::uuid;
 assert r.status='approved' and r.bank='TestBank' and r.connection_id='e2900000-0000-4000-8000-000000000020';
 assert not has_function_privilege('authenticated','confirm_tournament_payment(text,int,text,jsonb,uuid,text,text)','EXECUTE');
 result:=confirm_tournament_payment(r.code,100000,'29001','{}',r.connection_id,'WrongBank',r.account_number);
 assert result->>'reason'='WRONG_RECEIVER';
 result:=confirm_tournament_payment(r.code,1000,'29001','{}',r.connection_id,r.bank,r.account_number);
 assert result->>'reason'='UNDERPAID';
 assert (select paid_at is null from tournament_registrations where id=r.id);
 result:=confirm_tournament_payment(r.code,150000,'29002','{}',r.connection_id,r.bank,r.account_number);
 assert result->>'reason'='OVERPAID';
 assert (select paid_at is not null from tournament_registrations where id=r.id);
 result:=confirm_tournament_payment(r.code,150000,'29002','{}',r.connection_id,r.bank,r.account_number);
 assert result->>'reason'='ALREADY_PROCESSED';
 result:=confirm_tournament_payment(r.code,100000,'29003','{}',r.connection_id,r.bank,r.account_number);
 assert result->>'reason'='DUPLICATE_PAYMENT';
 assert (select refund_amount=50000 from tournament_payment_events where transaction_key='testbank:123456789:29002');
end $$;
-- Capacity is enforced at approval, and an assigned court cannot be reopened.
select set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare r uuid; begin
 r:=register_tournament(current_setting('test.tournament')::uuid,'{"full_name":"Second entrant","phone":"0900000002","address":"Hà Nội","team_name":"","note":""}');
 perform set_config('test.second_registration',r::text,true);
 begin
  perform reopen_court('e2900000-0000-4000-8000-000000000011',(select id from court_closures where tournament_id=current_setting('test.tournament')::uuid));
  raise exception 'TEST: tournament court reopened';
 exception when raise_exception then if sqlerrm<>'TOURNAMENT_COURT_RESERVED' then raise; end if; end;
 assert jsonb_array_length(get_owner_period_stats('e2900000-0000-4000-8000-000000000010',7)->'daily')=7;
 assert jsonb_array_length(get_owner_period_stats('e2900000-0000-4000-8000-000000000010',30)->'daily')=30;
end $$;
reset role;
select set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ declare r uuid; begin
 r:=register_tournament(current_setting('test.tournament')::uuid,'{"full_name":"Third entrant","phone":"0900000003","address":"Hà Nội","team_name":"","note":""}');
 perform review_tournament_registration(current_setting('test.second_registration')::uuid,true,'');
 begin perform review_tournament_registration(r,true,''); raise exception 'TEST: exceeded capacity';
 exception when raise_exception then if sqlerrm<>'TOURNAMENT_FULL' then raise; end if; end;
end $$;
reset role;
do $$ declare r tournament_registrations; result jsonb; inv uuid; begin
 select * into r from tournament_registrations where id=current_setting('test.second_registration')::uuid;
 update sepay_connections set operation_token='e2900000-0000-4000-8000-000000000021',operation_expires_at=now()+interval '1 minute' where id=r.connection_id;
 begin perform disconnect_sepay_connection(r.payment_owner_id,'e2900000-0000-4000-8000-000000000021'); raise exception 'TEST: disconnected live QR';
 exception when raise_exception then if sqlerrm<>'PENDING_PAYMENTS' then raise; end if; end;
 -- Existing fee flow cannot reuse a tournament receipt, and vice versa.
 insert into subscription_invoices(owner_id,code,bank,account_number,account_name) values(r.payment_owner_id,'PHI291ABCDE','TestBank','123456789','Test Owner') returning id into inv;
 insert into subscription_payment_events(transaction_key,invoice_id,amount,raw) values('testbank:123456789:29002',inv,299000,'{}');
 assert not found,'tournament receipt cannot pay fee';
 insert into subscription_payment_events(transaction_key,invoice_id,amount,raw) values('testbank:123456789:29009',inv,299000,'{}');
 result:=confirm_tournament_payment(r.code,100000,'29009','{}',r.connection_id,r.bank,r.account_number);
 assert result->>'reason'='ALREADY_PROCESSED';
 update tournaments set registration_deadline=now()-interval '1 second' where id=r.tournament_id;
 result:=confirm_tournament_payment(r.code,100000,'29010','{}',r.connection_id,r.bank,r.account_number);
 assert result->>'reason'='LATE_OR_CANCELLED';
 assert (select paid_at is null from tournament_registrations where id=r.id);
 assert (select refund_amount=100000 and refund_status='needed' from tournament_payment_events where transaction_key='testbank:123456789:29010');
end $$;
-- Only the owner receiving funds / admin can record a refund.
select set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
 begin
  perform mark_tournament_refund('testbank:123456789:29002',50000); raise exception 'TEST: manager faked owner refund';
 exception when raise_exception then if sqlerrm<>'REFUND_CHANGED_OR_FORBIDDEN' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000002',true);
set local role authenticated;
select mark_tournament_refund('testbank:123456789:29002',50000);
reset role;
select set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000003',true);
set local role authenticated;
select cancel_tournament(current_setting('test.tournament')::uuid);
reset role;
do $$ declare r tournament_registrations; result jsonb; begin
 assert not exists(select 1 from court_closures where tournament_id=current_setting('test.tournament')::uuid);
 assert (select refund_amount-refunded_amount=100000 and refund_status='needed' from tournament_payment_events where transaction_key='testbank:123456789:29002'),'refund remaining deposit after excess was refunded';
 select * into r from tournament_registrations where id=current_setting('test.registration')::uuid;
 result:=confirm_tournament_payment(r.code,100000,'29004','{}',r.connection_id,r.bank,r.account_number);
 assert result->>'reason'='DUPLICATE_PAYMENT';
end $$;
select set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 begin perform mark_tournament_refund('testbank:123456789:29002',50000); raise exception 'TEST: stale refund accepted';
 exception when raise_exception then if sqlerrm<>'REFUND_CHANGED_OR_FORBIDDEN' then raise; end if; end;
end $$;
reset role;
-- Registration owner can still see the cancelled tournament; unrelated player cannot see contacts.
select set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $$ begin assert exists(select 1 from tournaments where id=current_setting('test.tournament')::uuid); end $$;
reset role;
set local role anon;
do $$ begin
 assert not exists(select 1 from tournaments where id=current_setting('test.tournament')::uuid);
 begin perform count(*) from tournament_registrations; raise exception 'TEST: anon sees contacts'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
