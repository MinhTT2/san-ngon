-- Disposable fixtures; no external notifications, all changes roll back.
begin;
insert into auth.users(id) values('d0000000-0000-4000-8000-000000000001');
update profiles set role='owner',owner_application_status='active'
  where id='d0000000-0000-4000-8000-000000000001';
insert into venues(id,owner_id,slug,name,address,district,status)
  values('d0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','check-ban-rollback','Test','Test','Test','draft');
insert into courts(id,venue_id,name,sport)
  values('d0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000002','Test','badminton');
insert into court_closures(id,court_id,starts_at,ends_at)
  values('d0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000003',now()+interval '3 days',now()+interval '4 days');
insert into owner_subscriptions(owner_id,fee_required) values('d0000000-0000-4000-8000-000000000001',true);
update subscription_receiver set connection_id=null,bank='MBBank',account_number='1234567890',account_name='TEST ONLY';
update profiles set banned_until='infinity' where id='d0000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
  begin
    perform close_court('d0000000-0000-4000-8000-000000000003',(now() at time zone 'Asia/Ho_Chi_Minh')::date+1);
    raise exception 'CHECK_FAILED: banned owner can close courts';
  exception when insufficient_privilege then null; end;
  begin
    perform reopen_court('d0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000004');
    raise exception 'CHECK_FAILED: banned owner can reopen courts';
  exception when insufficient_privilege then null; end;
  begin
    perform create_subscription_invoice();
    raise exception 'CHECK_FAILED: banned owner can create fee invoices';
  exception when insufficient_privilege then null; end;
  assert not exists(select 1 from court_closures), 'banned account cannot read closures';
  assert not exists(select 1 from owner_subscriptions), 'banned account cannot read subscriptions';
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
update profiles set banned_until=null where id='d0000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
  perform close_court('d0000000-0000-4000-8000-000000000003',(now() at time zone 'Asia/Ho_Chi_Minh')::date+1);
  perform reopen_court('d0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000004');
  perform create_subscription_invoice();
  assert exists(select 1 from subscription_invoices), 'unban restores normal operations';
end $$;
rollback;
