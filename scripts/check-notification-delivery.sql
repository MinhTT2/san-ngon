-- Run against the linked schema; every fixture/config change is rolled back.
-- For pre-deploy checks, wrap the candidate migration and this script in one transaction.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

insert into auth.users(id) values
  ('e0220000-0000-4000-8000-000000000001'),
  ('e0220000-0000-4000-8000-000000000002'),
  ('e0220000-0000-4000-8000-000000000003');
update public.profiles set role = 'owner', owner_application_status = 'active',
  payout_bank = 'MB', payout_account = '1234567890'
where id = 'e0220000-0000-4000-8000-000000000001';
update public.profiles set phone = '0900000999'
where id = 'e0220000-0000-4000-8000-000000000002';

-- The singleton is changed only inside this short rollback transaction.
insert into public.booking_operator(owner_id, bank, account_number, account_name, accepts_new_bookings, multi_owner_enabled)
values ('e0220000-0000-4000-8000-000000000001', 'MBBank', '1234567890', 'ROLLBACK CHECK', true, false)
on conflict(singleton) do update set owner_id = excluded.owner_id, bank = excluded.bank,
  account_number = excluded.account_number, account_name = excluded.account_name,
  accepts_new_bookings = true, multi_owner_enabled = false;
insert into public.venues(id, owner_id, slug, name, address, district, status)
values ('e0220000-0000-4000-8000-000000000010', 'e0220000-0000-4000-8000-000000000001',
  'notification-delivery-rollback', 'Booking input rollback', 'Rollback fixture', 'Test', 'active');
insert into public.courts(id, venue_id, name, sport, slot_minutes, open_time, close_time) values
  ('e0220000-0000-4000-8000-000000000030', 'e0220000-0000-4000-8000-000000000010', '30 minutes', 'badminton', 30, null, null),
  ('e0220000-0000-4000-8000-000000000060', 'e0220000-0000-4000-8000-000000000010', '60 minutes', 'badminton', 60, '06:00', '22:00'),
  ('e0220000-0000-4000-8000-000000000090', 'e0220000-0000-4000-8000-000000000010', '90 minutes', 'badminton', 90, null, null),
  ('e0220000-0000-4000-8000-000000000120', 'e0220000-0000-4000-8000-000000000010', '120 minutes', 'badminton', 120, null, null);
insert into public.price_rules(court_id, days, start_time, end_time, price_per_hour)
select id, '{0,1,2,3,4,5,6}'::int[], '05:00'::time, '23:00'::time, 100500
from public.courts where venue_id = 'e0220000-0000-4000-8000-000000000010';




update auth.users set email='owner-outbox@example.invalid' where id='e0220000-0000-4000-8000-000000000001';
update public.profiles set telegram_chat_id='123456789' where id='e0220000-0000-4000-8000-000000000001';
insert into public.bookings(code,court_id,user_id,starts_at,ends_at,status,total_amount,deposit_amount,customer_phone,paid_at)
values('SANQUE234','e0220000-0000-4000-8000-000000000060','e0220000-0000-4000-8000-000000000003',
 now()+interval '2 days',now()+interval '2 days 1 hour','confirmed',100000,100000,'0901234567',now());
insert into public.notifications(user_id,booking_id,kind,channel,title,body)
 select payment_owner_id,id,'new_booking','app','Đơn mới '||code,'Fixture only' from public.bookings where code='SANQUE234';
insert into public.notifications(user_id,booking_id,kind,channel,title,body)
 select payment_owner_id,id,'new_booking','app','Đơn mới '||code,'Fixture duplicate' from public.bookings where code='SANQUE234';
do $$ begin
 assert (select count(*)=2 from public.notification_deliveries where booking_id=(select id from public.bookings where code='SANQUE234')),'one task per channel';
 assert not has_table_privilege('authenticated','public.notification_deliveries','select');
 assert not has_table_privilege('authenticated','public.notification_deliveries','update');
 assert not has_function_privilege('authenticated','public.claim_notification_deliveries(int)','execute');
 assert has_function_privilege('service_role','public.claim_notification_deliveries(int)','execute');
end $$;
-- Only our rollback fixture is made runnable; existing application jobs are untouched.
update public.notification_deliveries set available_at='infinity' where user_id<>'e0220000-0000-4000-8000-000000000001' and status='pending';
do $$ declare jobs jsonb; job jsonb; again jsonb; begin
 jobs:=public.claim_notification_deliveries(3);assert jsonb_array_length(jobs)=2;
 again:=public.claim_notification_deliveries(3);assert again='[]'::jsonb,'active lease prevents a second claim';
 job:=jobs->0;
 assert not public.finish_notification_delivery((job->>'id')::uuid,gen_random_uuid(),true,null),'wrong lease cannot acknowledge';
 assert public.finish_notification_delivery((job->>'id')::uuid,(job->>'lease_id')::uuid,false,'HTTP_429');
 assert (select status='pending' and available_at>now() from public.notification_deliveries where id=(job->>'id')::uuid),'backoff on rate limit';
 assert not public.finish_notification_delivery((job->>'id')::uuid,(job->>'lease_id')::uuid,true,null),'stale ack is rejected';
 job:=jobs->1;
 assert public.finish_notification_delivery((job->>'id')::uuid,(job->>'lease_id')::uuid,true,null);
 assert (select status='sent' and sent_at is not null from public.notification_deliveries where id=(job->>'id')::uuid);
end $$;
update public.notification_deliveries set available_at=now()-interval '1 minute',attempts=5 where status='pending' and user_id='e0220000-0000-4000-8000-000000000001';
do $$ declare job jsonb; begin
 job:=public.claim_notification_deliveries(1)->0;
 assert public.finish_notification_delivery((job->>'id')::uuid,(job->>'lease_id')::uuid,false,'NETWORK');
 assert (select status='failed' and attempts=6 from public.notification_deliveries where id=(job->>'id')::uuid),'six attempts are terminal';
 begin update public.notification_deliveries set payload='{}' where id=(job->>'id')::uuid;raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'DELIVERY_IMMUTABLE' then raise;end if;end;
end $$;
insert into public.owner_application_reviews(owner_id,reviewer_id,status,reason)
 values('e0220000-0000-4000-8000-000000000001','e0220000-0000-4000-8000-000000000002','rejected','Bổ sung giấy tờ rõ nét');
do $$ begin
 assert exists(select 1 from public.notification_deliveries where kind='owner_review' and payload->>'reason'='Bổ sung giấy tờ rõ nét'),'review and email share the same stored reason';
end $$;
update public.profiles set role='admin' where id='e0220000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','e0220000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare d record; r jsonb; begin
 r:=public.get_notification_delivery_page(1);
 assert not (r->'rows'->0 ? 'payload') and not (r->'rows'->0 ? 'destination'),'admin projection excludes raw payload and email/chat';
 -- Use the public projection to retrieve the optimistic concurrency timestamp.
 select * into d from jsonb_to_recordset(r->'rows') as x(id uuid,status text,updated_at timestamptz) where status='failed' limit 1;
 perform public.retry_notification_delivery(d.id,d.updated_at);
 begin perform public.retry_notification_delivery(d.id,d.updated_at);raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'DELIVERY_CHANGED' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
update auth.users set email='changed-outbox@example.invalid' where id='e0220000-0000-4000-8000-000000000001';
update public.profiles set telegram_chat_id=null where id='e0220000-0000-4000-8000-000000000001';
do $$ declare jobs jsonb;begin
 jobs:=public.claim_notification_deliveries(3);
 assert jobs='[]'::jsonb,'changed contacts are not disclosed to sender';
 assert exists(select 1 from public.notification_deliveries where status='skipped' and last_reason='RECIPIENT_CHANGED');
end $$;
select set_config('request.jwt.claim.sub','e0220000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
 begin perform public.get_notification_delivery_page();raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end $$;
reset role;
rollback;
