-- Disposable fixtures, all rolled back. Run with supabase db query --linked --file.
begin;
insert into auth.users(id) values('e5100000-0000-4000-8000-000000000001'),('e5100000-0000-4000-8000-000000000002'),('e5100000-0000-4000-8000-000000000003');
update public.profiles set role='admin',payout_bank='MB',payout_account='1234567890',owner_application_status='active' where id='e5100000-0000-4000-8000-000000000003';
insert into public.booking_operator(owner_id,bank,account_number,account_name,accepts_new_bookings)
values('e5100000-0000-4000-8000-000000000003','MBBank','1234567890','UTILITY CHECK',true)
on conflict(singleton) do update set owner_id=excluded.owner_id,bank=excluded.bank,account_number=excluded.account_number,account_name=excluded.account_name,accepts_new_bookings=true;
insert into public.venues(id,owner_id,slug,name,address,district,status) values
('e5100000-0000-4000-8000-000000000004','e5100000-0000-4000-8000-000000000003','utility-check-active','Sân thử nghiệm tiện ích','Địa chỉ thử','Hà Nội','active'),
('e5100000-0000-4000-8000-000000000005','e5100000-0000-4000-8000-000000000003','utility-check-draft','Tên nháp riêng tư','Địa chỉ riêng tư','Hà Nội','draft');
insert into public.courts(id,venue_id,name,sport) values('e5100000-0000-4000-8000-000000000006','e5100000-0000-4000-8000-000000000004','Sân 1','badminton');
insert into public.bookings(code,court_id,user_id,starts_at,ends_at,total_amount,deposit_amount,customer_phone,status) values
('SANUT2345','e5100000-0000-4000-8000-000000000006','e5100000-0000-4000-8000-000000000001','2027-01-01T11:00:00Z','2027-01-01T12:00:00Z',100000,100000,'0900000000','confirmed'),
('SANUT2346','e5100000-0000-4000-8000-000000000006','e5100000-0000-4000-8000-000000000001','2027-01-02T11:00:00Z','2027-01-02T12:00:00Z',100000,100000,'0900000000','pending');
select set_config('request.jwt.claim.sub','e5100000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare id uuid:='e5100000-0000-4000-8000-000000000007'; i int; begin
  assert submit_feedback(id,'bug','Báo lỗi kiểm thử','Nội dung kiểm thử dài hơn hai mươi ký tự.','/tim-san')=id;
  assert submit_feedback(id,'bug','Báo lỗi kiểm thử','Nội dung kiểm thử dài hơn hai mươi ký tự.','/tim-san')=id;
  assert (select count(*) from public.feedback where user_id=auth.uid())=1,'retry must not duplicate';
  begin
    perform submit_feedback(gen_random_uuid(),'bug','Kiểm tra đường dẫn','Nội dung kiểm thử dài hơn hai mươi ký tự.','//evil.example');
    raise exception 'TEST: unsafe path accepted';
  exception when invalid_parameter_value then assert sqlerrm='INVALID_FEEDBACK'; end;
  begin
    perform submit_feedback(gen_random_uuid(),'bug','Kiểm tra đường dẫn','Nội dung kiểm thử dài hơn hai mươi ký tự.','/tai-khoan?token=secret');
    raise exception 'TEST: query persisted';
  exception when invalid_parameter_value then assert sqlerrm='INVALID_FEEDBACK'; end;
  begin
    perform review_feedback(id,'resolved','Trả lời không đúng quyền.',now());
    raise exception 'TEST: player can process feedback';
  exception when insufficient_privilege then null; end;
  assert not has_table_privilege('authenticated','public.feedback','UPDATE');
  assert not has_table_privilege('authenticated','public.feedback','INSERT');
  for i in 1..4 loop perform submit_feedback(gen_random_uuid(),'idea','Góp ý kiểm thử '||i,'Nội dung kiểm thử dài hơn hai mươi ký tự.',null); end loop;
  begin
    perform submit_feedback(gen_random_uuid(),'idea','Vượt giới hạn','Nội dung kiểm thử dài hơn hai mươi ký tự.',null);
    raise exception 'TEST: feedback limit bypassed';
  exception when invalid_parameter_value then assert sqlerrm='FEEDBACK_LIMIT'; end;
  assert set_venue_favorite('e5100000-0000-4000-8000-000000000004',true);
  assert set_venue_favorite('e5100000-0000-4000-8000-000000000004',true);
  assert jsonb_array_length(get_my_favorites())=1,'favorite retry must not duplicate';
  assert not has_table_privilege('authenticated','public.venue_favorites','INSERT');
  begin
    perform set_venue_favorite('e5100000-0000-4000-8000-000000000005',true);
    raise exception 'TEST: draft favorite allowed';
  exception when invalid_parameter_value then assert sqlerrm='VENUE_UNAVAILABLE'; end;
  assert get_booking_calendar('SANUT2345')->>'starts_at'='20270101T110000Z';
  assert get_booking_calendar('SANUT2345')->>'ends_at'='20270101T120000Z';
  assert get_booking_calendar('SANUT2346') is null,'pending calendar unavailable';
end $$;
reset role;
select set_config('request.jwt.claim.sub','e5100000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
  assert not exists(select 1 from public.feedback),'feedback must be private';
  assert not exists(select 1 from public.venue_favorites),'favorites must be private';
  assert get_my_favorites()='[]'::jsonb;
  assert get_booking_calendar('SANUT2345') is null,'other user calendar denied';
end $$;
reset role;
select set_config('request.jwt.claim.sub','e5100000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ declare t timestamptz; begin
  select updated_at into t from public.feedback where id='e5100000-0000-4000-8000-000000000007';
  assert t is not null,'admin can read feedback';
  begin
    perform review_feedback('e5100000-0000-4000-8000-000000000007','resolved','',t);
    raise exception 'TEST: empty final reply allowed';
  exception when invalid_parameter_value then assert sqlerrm='INVALID_FEEDBACK'; end;
  perform review_feedback('e5100000-0000-4000-8000-000000000007','resolved','Đã xử lý báo lỗi.',t);
  begin
    perform review_feedback('e5100000-0000-4000-8000-000000000007','closed','Ghi đè màn hình cũ.',t);
    raise exception 'TEST: stale response overwrote';
  exception when invalid_parameter_value then assert sqlerrm='FEEDBACK_STALE'; end;
end $$;
reset role;
update public.venues set status='draft' where id='e5100000-0000-4000-8000-000000000004';
select set_config('request.jwt.claim.sub','e5100000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
  assert get_my_favorites()->0->>'name'='Sân hiện không công khai','hidden venue name must not leak';
  assert get_my_favorites()->0->>'slug' is null;
  assert (select reply from public.feedback where id='e5100000-0000-4000-8000-000000000007')='Đã xử lý báo lỗi.';
  assert not set_venue_favorite('e5100000-0000-4000-8000-000000000004',false);
  assert jsonb_array_length(get_my_favorites())=0;
end $$;
reset role;
insert into public.venues(owner_id,slug,name,address,district,status)
select 'e5100000-0000-4000-8000-000000000003','utility-limit-'||i,'Sân kiểm thử giới hạn','Địa chỉ thử','Hà Nội','active' from generate_series(1,101) i;
update public.feedback set created_at=now()-interval '2 days' where user_id='e5100000-0000-4000-8000-000000000001';
insert into public.feedback(id,user_id,category,title,message,created_at)
select gen_random_uuid(),'e5100000-0000-4000-8000-000000000001','idea','Góp ý kiểm thử giới hạn','Nội dung kiểm thử dài hơn hai mươi ký tự.',now()-interval '2 days' from generate_series(1,6);
set local role authenticated;
do $$ declare v uuid; begin
  for v in select id from public.venues where slug like 'utility-limit-%' and owner_id='e5100000-0000-4000-8000-000000000003' order by id limit 100 loop
    perform set_venue_favorite(v,true);
  end loop;
  assert jsonb_array_length(get_my_favorites())=100;
  select id into v from public.venues where slug like 'utility-limit-%' and owner_id='e5100000-0000-4000-8000-000000000003'
    and id not in (select venue_id from public.venue_favorites) limit 1;
  begin perform set_venue_favorite(v,true); raise exception 'TEST: favorite limit bypassed'; exception when invalid_parameter_value then assert sqlerrm='FAVORITES_LIMIT'; end;
  begin perform submit_feedback(gen_random_uuid(),'idea','Vượt giới hạn mở','Nội dung kiểm thử dài hơn hai mươi ký tự.',null); raise exception 'TEST: open request limit bypassed'; exception when invalid_parameter_value then assert sqlerrm='FEEDBACK_LIMIT'; end;
end $$;
reset role;
update public.profiles set banned_until='infinity' where id='e5100000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
  assert not exists(select 1 from public.feedback),'banned session read denied';
  begin perform get_my_favorites(); raise exception 'TEST: banned read allowed'; exception when insufficient_privilege then null; end;
  begin perform get_booking_calendar('SANUT2345'); raise exception 'TEST: banned calendar allowed'; exception when insufficient_privilege then null; end;
  begin perform submit_feedback(gen_random_uuid(),'idea','Góp ý bị khóa','Nội dung kiểm thử dài hơn hai mươi ký tự.',null); raise exception 'TEST: banned write allowed'; exception when insufficient_privilege then null; end;
  begin perform set_venue_favorite('e5100000-0000-4000-8000-000000000004',true); raise exception 'TEST: banned favorite allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  assert not has_function_privilege('anon','public.submit_feedback(uuid,text,text,text,text)','EXECUTE');
  assert not has_function_privilege('anon','public.review_feedback(uuid,text,text,timestamptz)','EXECUTE');
  assert not has_function_privilege('anon','public.get_my_favorites()','EXECUTE');
  assert not has_function_privilege('anon','public.get_booking_calendar(text)','EXECUTE');
  assert not has_table_privilege('anon','public.feedback','SELECT');
end $$;
reset role;
rollback;
