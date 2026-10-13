-- Disposable data; no fixtures or global settings survive this transaction.
begin;
insert into auth.users(id) values
 ('ef130000-0000-4000-8000-000000000001'),('ef130000-0000-4000-8000-000000000002'),
 ('ef130000-0000-4000-8000-000000000003'),('ef130000-0000-4000-8000-000000000004');
update profiles set role='owner',owner_application_status='active',payout_bank='TestBank',payout_account='123456789' where id='ef130000-0000-4000-8000-000000000001';
update profiles set role='admin' where id='ef130000-0000-4000-8000-000000000004';
insert into venues(id,owner_id,name,slug,address,district,open_time,close_time)
values('ef130000-0000-4000-8000-000000000010','ef130000-0000-4000-8000-000000000001','Test sửa giải','edit-tournament-rollback','Địa chỉ kiểm tra Hà Nội','Cầu Giấy','06:00','23:00');
update venues set status='active',images='{test1,test2,test3}' where id='ef130000-0000-4000-8000-000000000010';
insert into courts(id,venue_id,name,sport) values
 ('ef130000-0000-4000-8000-000000000011','ef130000-0000-4000-8000-000000000010','Sân một','badminton'),
 ('ef130000-0000-4000-8000-000000000012','ef130000-0000-4000-8000-000000000010','Sân hai','badminton');
update booking_operator set multi_owner_enabled=true;
insert into sepay_connections(id,owner_id,status,bank,account_number,account_name)
values('ef130000-0000-4000-8000-000000000020','ef130000-0000-4000-8000-000000000001','ready','TestBank','123456789','Test Owner');
insert into storage.objects(bucket_id,name,metadata) values
 ('tournament-photos','ef130000-0000-4000-8000-000000000001/ef130000-0000-4000-8000-000000000021.png','{"mimetype":"image/png","size":100}');

select set_config('request.jwt.claim.sub','ef130000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare tid uuid; data jsonb; begin
 assert not has_table_privilege('authenticated','public.tournaments','UPDATE');
 assert not has_function_privilege('anon','public.update_published_tournament(uuid,jsonb)','EXECUTE');
 data:=jsonb_build_object('title','Giải kiểm tra sửa','description','Thể lệ kiểm tra và liên hệ ban tổ chức.',
 'court_id','ef130000-0000-4000-8000-000000000011','sport','badminton','address','Địa chỉ kiểm tra Hà Nội',
 'starts_at',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '10 days','YYYY-MM-DD"T"10:00'),
 'ends_at',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '10 days','YYYY-MM-DD"T"12:00'),
 'registration_deadline',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '8 days','YYYY-MM-DD"T"10:00'),
 'payment_deadline',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '9 days','YYYY-MM-DD"T"10:00'),
 'payment_hold_hours',24,'capacity',4,'entry_fee',200000,'deposit_amount',100000,'cover_path','');
 tid:=submit_tournament(data);
 perform set_config('test.edit_id',tid::text,true);
 assert (get_tournament_proposal(tid)->>'can_change_structure')::boolean;
 data:=get_tournament_proposal(tid)||jsonb_build_object('title','Giải đổi sân và giờ','court_id','ef130000-0000-4000-8000-000000000012',
   'starts_at',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '11 days','YYYY-MM-DD"T"10:00'),
   'ends_at',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '11 days','YYYY-MM-DD"T"12:00'));
 assert update_published_tournament(tid,data)=tid;
 assert (select status='published' and court_id='ef130000-0000-4000-8000-000000000012' from tournaments where id=tid);
 assert (select count(*)=1 from court_closures where tournament_id=tid);
 assert (select x.court_id=t.court_id and x.starts_at=t.starts_at and x.ends_at=t.ends_at from court_closures x join tournaments t on t.id=x.tournament_id where t.id=tid);
 assert (select s.due_at=t.ends_at+interval '7 days' from tournament_settlements s join tournaments t on t.id=s.tournament_id where t.id=tid);
end $$;
reset role;
-- Test both competing closures and live customer bookings, with atomic rollback.
insert into court_closures(court_id,starts_at,ends_at,reason)
select 'ef130000-0000-4000-8000-000000000011',starts_at,ends_at,'Khóa thử' from tournaments where id=current_setting('test.edit_id')::uuid;
insert into bookings(code,court_id,user_id,starts_at,ends_at,total_amount,deposit_amount,status,customer_phone)
select 'SANEDTABC','ef130000-0000-4000-8000-000000000011','ef130000-0000-4000-8000-000000000002',starts_at+interval '1 day',ends_at+interval '1 day',100000,100000,'confirmed','0900000002'
from tournaments where id=current_setting('test.edit_id')::uuid;
set local role authenticated;
do $$ declare tid uuid:=current_setting('test.edit_id')::uuid; data jsonb; old_data jsonb; begin
 old_data:=get_tournament_proposal(tid);
 data:=old_data||'{"title":"Không được lưu khi trùng","court_id":"ef130000-0000-4000-8000-000000000011"}'::jsonb;
 begin perform update_published_tournament(tid,data); raise exception 'TEST: closure overlap accepted';
 exception when raise_exception then if sqlerrm<>'SLOT_TAKEN' then raise; end if; end;
 assert get_tournament_proposal(tid)=old_data,'overlap leaves all old fields intact';
 data:=data||jsonb_build_object('starts_at',to_char(((old_data->>'starts_at')::timestamp)+interval '1 day','YYYY-MM-DD"T"HH24:MI'),
 'ends_at',to_char(((old_data->>'ends_at')::timestamp)+interval '1 day','YYYY-MM-DD"T"HH24:MI'));
 begin perform update_published_tournament(tid,data); raise exception 'TEST: booking overlap accepted';
 exception when raise_exception then if sqlerrm<>'SLOT_TAKEN' then raise; end if; end;
 assert get_tournament_proposal(tid)=old_data;
end $$;
reset role;
select set_config('request.jwt.claim.sub','ef130000-0000-4000-8000-000000000002',true);
set local role authenticated;
select register_tournament(current_setting('test.edit_id')::uuid,'{"full_name":"Người tham gia thử","phone":"0900000002","address":"Hà Nội"}');
reset role;
select set_config('request.jwt.claim.sub','ef130000-0000-4000-8000-000000000001',true);
set local role authenticated;
select review_tournament_registration((select id from tournament_registrations where tournament_id=current_setting('test.edit_id')::uuid),true);
reset role;
select set_config('request.jwt.claim.sub','ef130000-0000-4000-8000-000000000003',true);
set local role authenticated;
select register_tournament(current_setting('test.edit_id')::uuid,'{"full_name":"Người chờ thử","phone":"0900000003","address":"Hà Nội"}');
reset role;
select set_config('request.jwt.claim.sub','ef130000-0000-4000-8000-000000000004',true);
set local role authenticated;
select register_tournament(current_setting('test.edit_id')::uuid,'{"full_name":"Người chờ khác","phone":"0900000004","address":"Hà Nội"}');
reset role;
select set_config('request.jwt.claim.sub','ef130000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare tid uuid:=current_setting('test.edit_id')::uuid; data jsonb; snapshot jsonb; field text; begin
 data:=get_tournament_proposal(tid);
 assert not (data->>'can_change_structure')::boolean;
 select to_jsonb(r) into snapshot from tournament_registrations r where tournament_id=tid and status='approved';
 for field in select unnest(array['entry_fee','deposit_amount','payment_hold_hours']) loop
   begin perform update_published_tournament(tid,data||jsonb_build_object(field,(data->>field)::int+1)); raise exception 'TEST: frozen price changed';
   exception when raise_exception then if sqlerrm<>'TOURNAMENT_DETAILS_LOCKED' then raise; end if; end;
 end loop;
 begin perform update_published_tournament(tid,data||'{"court_id":"ef130000-0000-4000-8000-000000000011"}'::jsonb); raise exception 'TEST: frozen court changed';
 exception when raise_exception then if sqlerrm<>'TOURNAMENT_DETAILS_LOCKED' then raise; end if; end;
 begin perform update_published_tournament(tid,data||jsonb_build_object('starts_at',to_char((data->>'starts_at')::timestamp+interval '1 hour','YYYY-MM-DD"T"HH24:MI'))); raise exception 'TEST: frozen schedule changed';
 exception when raise_exception then if sqlerrm<>'TOURNAMENT_DETAILS_LOCKED' then raise; end if; end;
 begin perform update_published_tournament(tid,data||'{"capacity":2}'::jsonb); raise exception 'TEST: capacity below pending + approved accepted';
 exception when raise_exception then if sqlerrm<>'TOURNAMENT_CAPACITY_TOO_SMALL' then raise; end if; end;
 begin perform update_published_tournament(tid,data||jsonb_build_object('registration_deadline',to_char((data->>'registration_deadline')::timestamp-interval '1 hour','YYYY-MM-DD"T"HH24:MI'))); raise exception 'TEST: deadline shortened';
 exception when raise_exception then if sqlerrm<>'TOURNAMENT_DEADLINES_LOCKED' then raise; end if; end;
 data:=data||jsonb_build_object('title','Giải đã sửa sau đăng ký','description','Thông tin liên hệ mới và thể lệ thử nghiệm.',
 'capacity',6,'registration_deadline',to_char((data->>'registration_deadline')::timestamp+interval '1 hour','YYYY-MM-DD"T"HH24:MI'),
 'cover_path','ef130000-0000-4000-8000-000000000001/ef130000-0000-4000-8000-000000000021.png');
 perform update_published_tournament(tid,data);
 assert (select status='published' and capacity=6 and cover_path is not null from tournaments where id=tid);
 assert (select to_jsonb(r)=snapshot from tournament_registrations r where r.id=(snapshot->>'id')::uuid),'all approved snapshots retained';
 assert (select count(*)=2 from notifications where tournament_id=tid and title='Thông tin giải đấu đã cập nhật' and user_id=auth.uid());
 perform update_published_tournament(tid,get_tournament_proposal(tid));
 assert (select count(*)=2 from notifications where tournament_id=tid and title='Thông tin giải đấu đã cập nhật' and user_id=auth.uid()),'no-op does not repeat notices';
end $$;
reset role;
do $$ begin
 assert (select count(*)=3 from notifications where tournament_id=current_setting('test.edit_id')::uuid and title='Thông tin giải đấu đã cập nhật' and user_id<>'ef130000-0000-4000-8000-000000000001'),'all three active participants notified';
end $$;
-- Outsiders cannot load or write the form; banned managers cannot write either.
select set_config('request.jwt.claim.sub','ef130000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
 begin perform get_tournament_proposal(current_setting('test.edit_id')::uuid); raise exception 'TEST: outsider read editor';
 exception when raise_exception then if sqlerrm<>'TOURNAMENT_NOT_EDITABLE' then raise; end if; end;
 begin perform update_published_tournament(current_setting('test.edit_id')::uuid,'{}'); raise exception 'TEST: outsider edited';
 exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
end $$;
reset role;
update profiles set banned_until='infinity' where id='ef130000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','ef130000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 begin perform update_published_tournament(current_setting('test.edit_id')::uuid,'{}'); raise exception 'TEST: banned edited';
 exception when raise_exception then if sqlerrm<>'ACCOUNT_BANNED' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
update profiles set banned_until=null where id='ef130000-0000-4000-8000-000000000001';
-- Player-managed published tournaments keep the court and rental agreement fixed.
update tournaments set cancel_window_hours=0 where id=current_setting('test.edit_id')::uuid;
update tournaments set manager_id='ef130000-0000-4000-8000-000000000003',cover_path=null where id=current_setting('test.edit_id')::uuid;
select set_config('request.jwt.claim.sub','ef130000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ declare tid uuid:=current_setting('test.edit_id')::uuid; data jsonb; begin
 data:=get_tournament_proposal(tid);
 assert not (data->>'can_change_structure')::boolean;
 perform update_published_tournament(tid,data||'{"title":"Người đề xuất sửa thông tin"}'::jsonb);
 assert (select status='published' and cancel_window_hours=0 from tournaments where id=tid),'legacy policy retained';
end $$;
reset role;
update tournaments set starts_at=now()-interval '1 hour',registration_deadline=now()-interval '2 hours',payment_deadline=now()-interval '1 hour' where id=current_setting('test.edit_id')::uuid;
set local role authenticated;
do $$ begin
 begin perform update_published_tournament(current_setting('test.edit_id')::uuid,'{}'); raise exception 'TEST: started edited';
 exception when raise_exception then if sqlerrm<>'TOURNAMENT_NOT_EDITABLE' then raise; end if; end;
end $$;
rollback;
