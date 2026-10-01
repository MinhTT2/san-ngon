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
select review_tournament(current_setting('test.tournament')::uuid,true,'e2900000-0000-4000-8000-000000000011','Đã xác nhận sân',50000,'Hai bên đồng ý: chủ sân thu phí, thuê sân 50.000đ và đối soát trong 7 ngày.',true);
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
 update tournament_registrations set payment_expires_at=now()-interval '1 second' where id=r.id;
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
-- Independent retry/expiry, policy and settlement checks using the same rolled-back fixture actors.
reset role;
select set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000003',true);
do $$ declare tid uuid; rid uuid; old_id uuid; result jsonb; old_code text; r tournament_registrations; balance jsonb; transfer uuid; begin
 tid:=submit_tournament(jsonb_build_object('title','Giải vận hành thử','description','Thể lệ vận hành thử đầy đủ','sport','badminton','court_id','','address','Hà Nội thử nghiệm',
 'starts_at',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '10 days','YYYY-MM-DD"T"10:00'),
 'ends_at',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '10 days','YYYY-MM-DD"T"12:00'),
 'registration_deadline',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '9 days','YYYY-MM-DD"T"10:00'),
 'payment_deadline',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '10 days','YYYY-MM-DD"T"09:00'),
 'payment_hold_hours',24,'capacity',2,'entry_fee',200000,'deposit_amount',100000));
 perform set_config('test.operations',tid::text,true);
 assert (select cancel_window_hours=24 from tournaments where id=tid);
 -- Refused proposals can be corrected without changing their identity or bypassing review.
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000001',true);
 perform review_tournament(tid,false,null,'Cần bổ sung thể lệ');
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000003',true);
 result:=get_tournament_proposal(tid);
 assert resubmit_tournament(tid,result||jsonb_build_object('title','Giải đã sửa','court_id',''))=tid;
 assert (select status='pending' from tournaments where id=tid);
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000001',true);
 begin perform review_tournament(tid,true,'e2900000-0000-4000-8000-000000000011',''); raise exception 'TEST: missing terms accepted';
 exception when raise_exception then if sqlerrm<>'TERMS_REQUIRED' then raise; end if; end;
 perform review_tournament(tid,true,'e2900000-0000-4000-8000-000000000011','',50000,'Đã thống nhất tiền thuê sân, cách thu và hoàn phí với cả hai bên.',true);
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000004',true);
 old_id:=register_tournament(tid,'{"full_name":"Người thử vận hành","phone":"0900000004","address":"Hà Nội"}');
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000003',true);
 perform review_tournament_registration(old_id,true,'');
 select * into r from tournament_registrations where id=old_id;
 assert r.payment_expires_at=now()+interval '24 hours';
 assert r.refund_deadline=(select starts_at-interval '24 hours' from tournaments where id=tid);
 old_code:=r.code;
 update tournament_registrations set payment_expires_at=now()-interval '1 second' where id=old_id;
 assert get_tournament_capacity(tid)=0,'expired QR must not reserve capacity before cron';
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000004',true);
 rid:=register_tournament(tid,'{"full_name":"Đăng ký lần hai","phone":"0900000004","address":"Hà Nội"}');
 assert rid<>old_id;
 assert (select status='expired' from tournament_registrations where id=old_id);
 assert (select code<>old_code from tournament_registrations where id=rid);
 result:=confirm_tournament_payment(old_code,100000,'ops-late','{}',r.connection_id,r.bank,r.account_number);
 assert result->>'reason'='LATE_OR_CANCELLED';
 assert (select paid_at is null from tournament_registrations where id=rid),'old code cannot pay new attempt';
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000003',true);
 perform review_tournament_registration(rid,true,'');
 select * into r from tournament_registrations where id=rid;
 perform confirm_tournament_payment(r.code,100000,'ops-paid','{}',r.connection_id,r.bank,r.account_number);
 -- An on-time self cancellation refunds; retry keeps the previous receipt.
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000004',true);
 perform cancel_tournament_registration(rid);
 assert (select refund_amount=100000 from tournament_payment_events where transaction_key='testbank:123456789:ops-paid');
 rid:=register_tournament(tid,'{"full_name":"Đăng ký lần ba","phone":"0900000004","address":"Hà Nội"}');
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000003',true);
 perform review_tournament_registration(rid,true,'');
 select * into r from tournament_registrations where id=rid;
 perform confirm_tournament_payment(r.code,100000,'ops-late-cancel','{}',r.connection_id,r.bank,r.account_number);
 update tournament_registrations set refund_deadline=now()-interval '1 second' where id=rid;
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000004',true);
 perform cancel_tournament_registration(rid);
 assert (select refund_amount=0 from tournament_payment_events where transaction_key='testbank:123456789:ops-late-cancel'),'late self cancel forfeits deposit';
 perform cancel_tournament_registration(rid);
 assert (select refund_amount=0 from tournament_payment_events where transaction_key='testbank:123456789:ops-late-cancel'),'retry must not turn self cancellation into organizer refund';
 -- Final active entrant pays; owner must record only the SQL-calculated remainder.
 rid:=register_tournament(tid,'{"full_name":"Người chơi cuối","phone":"0900000004","address":"Hà Nội"}');
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000003',true);
 perform review_tournament_registration(rid,true,'');
 select * into r from tournament_registrations where id=rid;
 perform confirm_tournament_payment(r.code,100000,'ops-final','{}',r.connection_id,r.bank,r.account_number);
 begin perform record_tournament_balance(rid,false,'Chưa có quyền thu'); raise exception 'TEST: organizer recorded owner cash';
 exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000002',true);
 begin perform record_tournament_balance(rid,false,'Chưa đến ngày'); raise exception 'TEST: early cash accepted';
 exception when raise_exception then if sqlerrm<>'BALANCE_NOT_COLLECTIBLE' then raise; end if; end;
 update tournaments set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour',registration_deadline=now()-interval '3 hours',payment_deadline=now()-interval '2 hours' where id=tid;
 perform process_tournament_deadlines();
 assert (select status='completed' from tournaments where id=tid);
 perform record_tournament_balance(rid,false,'Tiền mặt phiếu 123');
 begin perform record_tournament_balance(rid,false,'Ghi thu trùng'); raise exception 'TEST: duplicate cash accepted';
 exception when raise_exception then if sqlerrm<>'BALANCE_NOT_COLLECTIBLE' then raise; end if; end;
 balance:=get_tournament_settlement(tid);
 assert (balance->>'bank_received')::int=400000;
 assert (balance->>'balance_received')::int=100000;
 assert (balance->>'can_settle')::boolean=false,'unrefunded receipts block settlement';
 perform mark_tournament_refund('testbank:123456789:ops-late',100000);
 perform mark_tournament_refund('testbank:123456789:ops-paid',100000);
 balance:=get_tournament_settlement(tid);
 assert (balance->>'balance')::bigint=250000,'net bank + cash - refunds - rental';
 assert (balance->>'can_settle')::boolean;
 begin perform record_tournament_transfer(tid,250001,'Sai số dư'); raise exception 'TEST: arbitrary payout accepted';
 exception when raise_exception then if sqlerrm<>'SETTLEMENT_CHANGED' then raise; end if; end;
 transfer:=record_tournament_transfer(tid,250000,'BANK-QUYET-TOAN-123');
 begin perform confirm_tournament_transfer(transfer); raise exception 'TEST: payer self-acknowledged';
 exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000003',true);
 perform confirm_tournament_transfer(transfer);
 balance:=get_tournament_settlement(tid);
 assert (balance->>'balance')::bigint=0 and (balance->>'pending_transfer')::bigint=0;
 assert exists(select 1 from notifications where tournament_id=tid and title='Đã nhận cọc giải đấu');
 assert exists(select 1 from notifications where tournament_id=tid and title='Đã xác nhận nhận tiền quyết toán');
end $$;

reset role;
do $$ declare tid uuid; rid uuid; first_rid uuid; r tournament_registrations; s jsonb; begin
 insert into tournaments(manager_id,court_id,title,description,sport,address,starts_at,ends_at,registration_deadline,payment_deadline,capacity,entry_fee,deposit_amount,status)
 values('e2900000-0000-4000-8000-000000000003','e2900000-0000-4000-8000-000000000011','Giải hoàn tiền thử','Thể lệ kiểm tra hoàn tiền','badminton','Hà Nội thử nghiệm',now()+interval '2 hours',now()+interval '4 hours',now()+interval '1 hour',now()+interval '2 hours',2,200000,100000,'published') returning id into tid;
 insert into tournament_settlements(tournament_id,owner_id,venue_fee,terms_note,agreed_by,agreed_at,due_at) values(tid,'e2900000-0000-4000-8000-000000000002',50000,'Thỏa thuận thử nghiệm','e2900000-0000-4000-8000-000000000001',now(),now()+interval '7 days');
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000004',true);
 rid:=register_tournament(tid,'{"full_name":"Người thử hoàn tiền","phone":"0900000004","address":"Hà Nội"}');first_rid:=rid;
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000003',true);
 perform review_tournament_registration(rid,true,'');select * into r from tournament_registrations where id=rid;
 perform confirm_tournament_payment(r.code,100000,'cancel-original','{}',r.connection_id,r.bank,r.account_number);
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000004',true);
 perform cancel_tournament_registration(rid);
 assert (select refund_amount=0 from tournament_payment_events where registration_id=rid),'within 24h forfeits cọc';
 rid:=register_tournament(tid,'{"full_name":"Người thử hoàn lần hai","phone":"0900000004","address":"Hà Nội"}');
 assert (get_my_tournament_registrations(1)->>'total')::int=3,'one row per tournament, not attempt';
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000003',true);
 perform review_tournament_registration(rid,true,'');select * into r from tournament_registrations where id=rid;
 perform confirm_tournament_payment(r.code,100000,'cancel-second','{}',r.connection_id,r.bank,r.account_number);
 update tournaments set starts_at=now()-interval '1 hour',registration_deadline=now()-interval '2 hours',payment_deadline=now()-interval '1 hour' where id=tid;
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000002',true);
 perform record_tournament_balance(rid,false,'Phiếu thu trước hủy');
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000003',true);
 perform cancel_tournament_registration(rid);
 assert (select refund_amount=100000 from tournament_payment_events where registration_id=rid),'organizer cancellation refunds deposit even after start';
 assert (select balance_refund_due=100000 from tournament_registrations where id=rid),'refund remainder too';
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000002',true);
 perform record_tournament_balance(rid,true,'BANK-HOAN-LE-PHI');
 assert (select balance_refund_receipt='BANK-HOAN-LE-PHI' and balance_refunded_at is not null from tournament_registrations where id=rid);
 perform mark_tournament_refund('testbank:123456789:cancel-second',100000);
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000003',true);
 update tournament_settlements set cancellation_venue_fee=25000 where tournament_id=tid;
 perform cancel_tournament(tid);
 assert (select refund_amount=100000 from tournament_payment_events where registration_id=first_rid),'whole cancellation restores previously forfeited deposit';
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000002',true);
 perform mark_tournament_refund('testbank:123456789:cancel-original',100000);
 s:=get_tournament_settlement(tid);
 assert (s->>'effective_venue_fee')::int=25000 and (s->>'balance')::int=-25000 and (s->>'can_settle')::boolean,'organizer still owes agreed cancellation rental after all player refunds';
 -- Venue-initiated cancellation waives rental, separately from organizer cancellation.
 update tournaments set status='published',cancelled_by=null where id=tid;
 perform cancel_tournament(tid);
 s:=get_tournament_settlement(tid);
 assert (s->>'effective_venue_fee')::int=0 and (s->>'balance')::int=0,'venue cancellation does not charge organizer rental';
 -- Public contacts and private operational ledgers stay separate.
 assert not has_function_privilege('anon','get_tournament_settlement(uuid)','EXECUTE');
 assert not has_function_privilege('authenticated','process_tournament_deadlines()','EXECUTE');
 assert not has_table_privilege('authenticated','tournament_transfers','INSERT');
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000004',true);
 begin perform get_tournament_settlement(tid); raise exception 'TEST: participant saw private settlement';
 exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
end $$;

-- Owners publish their own courts atomically; neither players nor unrelated owners can bypass review.
reset role;
select set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare data jsonb; tid uuid; rid uuid; begin
 data:=jsonb_build_object('title','Giải chủ sân tự tổ chức','description','Thể lệ kiểm tra công khai trực tiếp','sport','badminton',
 'court_id','e2900000-0000-4000-8000-000000000011','address','Địa chỉ từ trình duyệt',
 'starts_at',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '20 days','YYYY-MM-DD"T"10:00'),
 'ends_at',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '20 days','YYYY-MM-DD"T"12:00'),
 'registration_deadline',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '19 days','YYYY-MM-DD"T"10:00'),
 'capacity',2,'entry_fee',200000,'deposit_amount',100000);
 perform set_config('test.owner_data',data::text,true);
 assert not has_function_privilege('authenticated','create_tournament_proposal(jsonb)','EXECUTE');
 assert not has_function_privilege('anon','create_tournament_proposal(jsonb)','EXECUTE');
 begin perform submit_tournament(data||'{"court_id":""}'::jsonb); raise exception 'TEST: owner omitted court';
 exception when raise_exception then if sqlerrm<>'COURT_REQUIRED' then raise; end if; end;
 begin perform submit_tournament(data||'{"sport":"pickleball"}'::jsonb); raise exception 'TEST: wrong sport accepted';
 exception when raise_exception then if sqlerrm<>'COURT_INVALID' then raise; end if; end;
 tid:=submit_tournament(data);
 perform set_config('test.owner_tournament',tid::text,true);
 assert (select status='published' and manager_id=auth.uid() and address='Địa chỉ kiểm tra' from tournaments where id=tid);
 assert exists(select 1 from court_closures where tournament_id=tid);
 assert (get_tournament_settlement(tid)->>'venue_fee')::int=0;
 assert (get_tournament_settlement(tid)->>'balance')::int=0;
 begin perform submit_tournament(data); raise exception 'TEST: conflicting tournament published';
 exception when raise_exception then if sqlerrm<>'SLOT_TAKEN' then raise; end if; end;
 begin perform resubmit_tournament(tid,data); raise exception 'TEST: published tournament editable';
 exception when raise_exception then if sqlerrm<>'TOURNAMENT_NOT_EDITABLE' then raise; end if; end;
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000003',true);
 begin perform submit_tournament(data); raise exception 'TEST: player published another owner court';
 exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
 rid:=register_tournament(tid,'{"full_name":"Tham gia giải chủ sân","phone":"0900000003","address":"Hà Nội"}');
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000002',true);
 perform review_tournament_registration(rid,true);
 assert (select payment_owner_id=auth.uid() and bank='TestBank' and deposit_amount=100000 from tournament_registrations where id=rid);
 perform cancel_tournament(tid);
 assert not exists(select 1 from court_closures where tournament_id=tid);
end $$;
reset role;
do $$ declare data jsonb:=current_setting('test.owner_data')::jsonb; tid uuid; before_count int; begin
 assert not exists(select 1 from notifications where tournament_id=current_setting('test.owner_tournament')::uuid and title='Có đề xuất giải cần duyệt');
 assert (select count(*)=1 from tournaments where title=data->>'title'),'failed publishes leave no draft';
 -- Old rejected owner proposals keep their ID and acquire one closure/settlement on resubmission.
 insert into tournaments(manager_id,title,description,sport,address,starts_at,ends_at,registration_deadline,payment_deadline,capacity,entry_fee,deposit_amount,status)
 select manager_id,title,description,sport,address,starts_at,ends_at,registration_deadline,payment_deadline,capacity,entry_fee,deposit_amount,'rejected'
 from tournaments where id=current_setting('test.owner_tournament')::uuid returning id into tid;
 perform set_config('test.owner_resubmit',tid::text,true);
 select count(*) into before_count from tournaments;
 assert resubmit_tournament(tid,data)=tid;
 assert (select status='published' from tournaments where id=tid);
 assert (select count(*)=before_count from tournaments),'resubmit must remove intermediate draft';
 assert (select count(*)=1 from court_closures where tournament_id=tid);
 assert (select count(*)=1 from tournament_settlements where tournament_id=tid);
 assert not exists(select 1 from notifications where tournament_id=tid and title='Có đề xuất giải cần duyệt');
 perform cancel_tournament(tid);
 -- Reject live customer bookings, unready receivers, unverified/banned owners and inactive courts.
 insert into bookings(code,user_id,court_id,starts_at,ends_at,status,total_amount,deposit_amount,customer_phone)
 select 'SANZZZZZZ',manager_id,court_id,starts_at,ends_at,'confirmed',200000,200000,'0900000002'
 from tournaments where id=tid;
 begin perform submit_tournament(data); raise exception 'TEST: booking overlap accepted';
 exception when raise_exception then if sqlerrm<>'SLOT_TAKEN' then raise; end if; end;
 delete from bookings where code='SANZZZZZZ';
 update sepay_connections set status='disconnected' where id='e2900000-0000-4000-8000-000000000020';
 begin perform submit_tournament(data); raise exception 'TEST: receiver guard bypassed';
 exception when raise_exception then if sqlerrm<>'RECEIVER_NOT_READY' then raise; end if; end;
 update sepay_connections set status='ready' where id='e2900000-0000-4000-8000-000000000020';
 update courts set is_active=false where id='e2900000-0000-4000-8000-000000000011';
 begin perform submit_tournament(data); raise exception 'TEST: inactive court accepted';
 exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
 update courts set is_active=true where id='e2900000-0000-4000-8000-000000000011';
 update profiles set owner_application_status='pending' where id=auth.uid();
 begin perform submit_tournament(data); raise exception 'TEST: unverified owner accepted';
 exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
 update profiles set owner_application_status='active',banned_at=now(),banned_until=now()+interval '1 day' where id=auth.uid();
 begin perform submit_tournament(data); raise exception 'TEST: banned owner accepted';
 exception when raise_exception then if sqlerrm<>'ACCOUNT_BANNED' then raise; end if; end;
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000001',true);
 update profiles set banned_at=null,banned_until=null where id='e2900000-0000-4000-8000-000000000002';
 -- Owning the venue does not let its owner approve a player's proposal.
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000003',true);
 tid:=submit_tournament(data||'{"court_id":""}'::jsonb);
 assert (select status='pending' from tournaments where id=tid);
 assert exists(select 1 from notifications where tournament_id=tid and title='Có đề xuất giải cần duyệt');
 perform set_config('request.jwt.claim.sub','e2900000-0000-4000-8000-000000000002',true);
 begin perform review_tournament(tid,true,'e2900000-0000-4000-8000-000000000011'); raise exception 'TEST: owner approved player proposal';
 exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
 begin perform resubmit_tournament(tid,data); raise exception 'TEST: owner hijacked player proposal';
 exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
end $$;

rollback;
