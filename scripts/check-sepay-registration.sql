-- Run with Supabase CLI; all application, storage metadata and connection fixtures roll back.
begin;
insert into auth.users(id) values ('b0000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);
insert into storage.objects(bucket_id,name) values('venue-documents','b0000000-0000-4000-8000-000000000001/b0000000-0000-4000-8000-000000000002.pdf');
do $$
declare p profiles; c sepay_connections; op uuid:=gen_random_uuid();
begin
  begin
    perform claim_sepay_connection(auth.uid(),op);
    raise exception 'CHECK_FAILED: no application can connect';
  exception when raise_exception then if sqlerrm<>'OWNER_NOT_APPROVED' then raise; end if; end;
  p:=register_owner('Registration check','0900000000','b0000000-0000-4000-8000-000000000001/b0000000-0000-4000-8000-000000000002.pdf','fixture.pdf',null,null);
  assert p.owner_application_status='pending' and p.payout_bank is null, 'application saved before redirect without manual bank';
  c:=claim_sepay_connection(auth.uid(),op);
  update sepay_connections set bank_account_id='registration-fixture',bank='MBBank',account_number='3333333333',account_name='TEST OWNER',webhook_id='registration-fixture',webhook_key_hash='registration-fixture' where id=c.id;
  perform activate_sepay_connection(auth.uid(),op);
  select * into p from profiles where id=auth.uid();
  assert p.owner_application_status='pending' and p.role='player', 'bank setup must not approve the owner';
  assert p.payout_bank='MBBank' and p.payout_account='3333333333', 'verified bank saved for admin review';
  assert get_my_sepay_connection()->>'status'='ready', 'applicant sees safe summary';
  insert into sepay_oauth_states(owner_id,state_hash,return_to) values(auth.uid(),'test-state','/dang-ky-san');
  begin
    update sepay_oauth_states set return_to='https://attacker.example' where owner_id=auth.uid();
    raise exception 'CHECK_FAILED: arbitrary OAuth redirect';
  exception when check_violation then null; end;
  update profiles set owner_application_status='rejected' where id=auth.uid();
  begin
    perform activate_sepay_connection(auth.uid(),op);
    raise exception 'CHECK_FAILED: rejection during setup ignored';
  exception when raise_exception then if sqlerrm<>'OWNER_NOT_APPROVED' then raise; end if; end;
  update sepay_connections set operation_token=null,operation_expires_at=null where id=c.id;
  begin
    perform claim_sepay_connection(auth.uid(),op);
    raise exception 'CHECK_FAILED: rejected applicant can reconnect';
  exception when raise_exception then if sqlerrm<>'OWNER_NOT_APPROVED' then raise; end if; end;
  p:=register_owner('Registration check','0900000000','b0000000-0000-4000-8000-000000000001/b0000000-0000-4000-8000-000000000002.pdf','fixture.pdf',null,null);
  assert p.payout_account='3333333333', 'resubmit preserves verified connection';
end $$;
-- Even with rollout enabled and a pre-existing active venue, an unapproved applicant cannot take bookings.
update booking_operator set multi_owner_enabled=true;
insert into venues(id,owner_id,slug,name,address,district,status) values('b0000000-0000-4000-8000-000000000003',auth.uid(),'check-registration-rollback','Test','Test','Test','active');
insert into courts(id,venue_id,name,sport) values('b0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000003','Test','badminton');
insert into price_rules(court_id,days,start_time,end_time,price_per_hour) values('b0000000-0000-4000-8000-000000000004','{0,1,2,3,4,5,6}','05:00','23:00',100000);
do $$
declare t timestamptz:=(((now() at time zone 'Asia/Ho_Chi_Minh')::date+1)+time '10:00') at time zone 'Asia/Ho_Chi_Minh';
begin
  assert not venue_accepts_bookings('b0000000-0000-4000-8000-000000000003'), 'pending owner is not bookable';
  begin
    perform create_booking('b0000000-0000-4000-8000-000000000004',t,t+interval '1 hour','Test','0900000000');
    raise exception 'CHECK_FAILED: pending owner received booking';
  exception when raise_exception then if sqlerrm<>'VENUE_NOT_ACCEPTING_BOOKINGS' then raise; end if; end;
  update profiles set owner_application_status='active',role='owner' where id=auth.uid();
  assert venue_accepts_bookings('b0000000-0000-4000-8000-000000000003'), 'approved owner with connection may accept after rollout';
end $$;
set local role authenticated;
do $$ begin
  assert get_my_sepay_connection()->>'status'='ready';
  assert not has_table_privilege('authenticated','sepay_connections','SELECT');
  assert not has_function_privilege('authenticated','activate_sepay_connection(uuid,uuid)','EXECUTE');
end $$;
reset role;
rollback;
