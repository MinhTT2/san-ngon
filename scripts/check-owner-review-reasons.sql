-- Synthetic actors/documents in one rollback transaction; no provider calls.
begin;
set local statement_timeout='30s';
set local lock_timeout='5s';
insert into auth.users(id) values
 ('e0940000-0000-4000-8000-000000000001'),
 ('e0940000-0000-4000-8000-000000000002'),
 ('e0940000-0000-4000-8000-000000000003');
update public.profiles set role='admin' where id='e0940000-0000-4000-8000-000000000001';
update public.profiles set full_name='Hồ sơ thử',phone='0900000002',owner_application_status='pending',
 business_license_path='e0940000-0000-4000-8000-000000000002/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf',business_license_name='Giấy tờ thử'
where id='e0940000-0000-4000-8000-000000000002';
insert into storage.objects(bucket_id,name) values('venue-documents','e0940000-0000-4000-8000-000000000002/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf');
select set_config('request.jwt.claim.sub','e0940000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
 begin perform public.review_owner('e0940000-0000-4000-8000-000000000002','rejected','Bổ sung giấy tờ rõ nét');raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 assert (select count(*)=0 from public.owner_application_reviews);
end $$;
reset role;
select set_config('request.jwt.claim.sub','e0940000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 begin perform public.review_owner('e0940000-0000-4000-8000-000000000002','rejected');raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'REJECTION_REASON_REQUIRED' then raise;end if;end;
 begin perform public.review_owner('e0940000-0000-4000-8000-000000000002','rejected',repeat('đ',1001));raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'REJECTION_REASON_REQUIRED' then raise;end if;end;
 perform public.review_owner('e0940000-0000-4000-8000-000000000002','rejected','  Bổ sung giấy tờ rõ nét  ');
 assert (select owner_rejection_reason='Bổ sung giấy tờ rõ nét' and owner_reviewed_by=auth.uid() and owner_reviewed_at is not null and role='player' from public.profiles where id='e0940000-0000-4000-8000-000000000002');
 assert (select count(*)=1 from public.owner_application_reviews where owner_id='e0940000-0000-4000-8000-000000000002' and reason='Bổ sung giấy tờ rõ nét');
 begin perform public.review_owner('e0940000-0000-4000-8000-000000000002','rejected','Bổ sung giấy tờ khác');raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'OWNER_ALREADY_REVIEWED' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','e0940000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 assert (select count(*)=1 from public.notifications where user_id='e0940000-0000-4000-8000-000000000002' and title='Hồ sơ chủ sân cần bổ sung' and body like '%Bổ sung giấy tờ rõ nét%');
 assert (select count(*)=1 from public.owner_application_reviews);
 assert not has_table_privilege('authenticated','public.owner_application_reviews','UPDATE');
 assert not has_table_privilege('authenticated','public.owner_application_reviews','INSERT');
 assert not has_column_privilege('authenticated','public.profiles','owner_rejection_reason','UPDATE');
 assert not has_function_privilege('anon','public.review_owner(uuid,text,text)','EXECUTE');
 assert not has_function_privilege('authenticated','public.notify_owner_application_rejected()','EXECUTE');
 perform public.register_owner('Hồ sơ đã sửa','0900000002','e0940000-0000-4000-8000-000000000002/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf','Giấy tờ thử',null,null);
 assert (select owner_application_status='pending' and owner_rejection_reason is null and owner_reviewed_at is null and owner_reviewed_by is null and business_license_name='Giấy tờ thử' from public.profiles where id=auth.uid());
 assert (select count(*)=1 from public.owner_application_reviews), 'history survives resubmission';
end $$;
reset role;
update public.profiles set payout_bank='MB',payout_account='1234567890' where id='e0940000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','e0940000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.review_owner('e0940000-0000-4000-8000-000000000002','active');
do $$ begin
 assert (select role='owner' and owner_application_status='active' and owner_rejection_reason is null from public.profiles where id='e0940000-0000-4000-8000-000000000002');
 assert (select count(*)=2 from public.owner_application_reviews where owner_id='e0940000-0000-4000-8000-000000000002');
end $$;
reset role;
select set_config('request.jwt.claim.sub','e0940000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin assert (select count(*)=0 from public.owner_application_reviews);end $$;
reset role;
update public.profiles set banned_until='infinity' where id='e0940000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','e0940000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 assert (select count(*)=0 from public.owner_application_reviews), 'banned admin cannot read reviews';
 begin perform public.review_owner('e0940000-0000-4000-8000-000000000003','rejected','Bổ sung giấy tờ rõ nét');raise exception 'CHECK_FAILED';exception when others then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end $$;
reset role;
select 'OK: reason guards, private immutable review history, inbox, reuse/resubmit, approval and active-account permissions';
rollback;
