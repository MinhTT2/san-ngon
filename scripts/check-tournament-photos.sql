-- npx supabase db query --linked --file scripts/check-tournament-photos.sql
-- All fixture data and storage metadata are rolled back.
begin;
insert into auth.users(id) values
 ('e5400000-0000-4000-8000-000000000001'),
 ('e5400000-0000-4000-8000-000000000002');
insert into storage.objects(bucket_id,name,metadata) values
 ('tournament-photos','e5400000-0000-4000-8000-000000000001/e5400000-0000-4000-8000-000000000011.png','{"mimetype":"image/png","size":100}'),
 ('tournament-photos','e5400000-0000-4000-8000-000000000002/e5400000-0000-4000-8000-000000000012.png','{"mimetype":"image/png","size":100}'),
 ('tournament-photos','e5400000-0000-4000-8000-000000000001/e5400000-0000-4000-8000-000000000013.png','{"mimetype":"image/png","size":5242881}'),
 ('tournament-photos','e5400000-0000-4000-8000-000000000001/e5400000-0000-4000-8000-000000000014.png','{"mimetype":"image/svg+xml","size":100}');
select set_config('request.jwt.claim.sub','e5400000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare
 data jsonb:=jsonb_build_object('title','Giải kiểm tra ảnh','description','Thể lệ thử nghiệm và liên hệ ban tổ chức.',
   'sport','badminton','court_id','','address','Cầu Giấy, Hà Nội',
   'starts_at',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '10 days','YYYY-MM-DD"T"10:00'),
   'ends_at',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '10 days','YYYY-MM-DD"T"12:00'),
   'registration_deadline',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '9 days','YYYY-MM-DD"T"10:00'),
   'payment_deadline',to_char((now() at time zone 'Asia/Ho_Chi_Minh')+interval '10 days','YYYY-MM-DD"T"09:00'),
   'payment_hold_hours',24,'capacity',8,'entry_fee',0,'deposit_amount',0);
 photo text:='e5400000-0000-4000-8000-000000000001/e5400000-0000-4000-8000-000000000011.png';
 invalid text; tid uuid; plain uuid;
begin
 assert not has_function_privilege('authenticated','public.create_tournament_proposal(jsonb)','EXECUTE'), 'internal writer stays private';
 assert not has_table_privilege('authenticated','public.tournaments','UPDATE'), 'no direct update';
 for invalid in select unnest(array[
   'e5400000-0000-4000-8000-000000000002/e5400000-0000-4000-8000-000000000012.png',
   'e5400000-0000-4000-8000-000000000001/e5400000-0000-4000-8000-000000000099.png',
   'e5400000-0000-4000-8000-000000000001/e5400000-0000-4000-8000-000000000013.png',
   'e5400000-0000-4000-8000-000000000001/e5400000-0000-4000-8000-000000000014.png',
   'https://example.invalid/image.png','../other/image.png']) loop
   begin
     perform submit_tournament(data||jsonb_build_object('cover_path',invalid));
     raise exception 'CHECK_FAILED: invalid cover accepted';
   exception when raise_exception then if sqlerrm<>'TOURNAMENT_IMAGE_INVALID' then raise; end if; end;
 end loop;
 tid:=submit_tournament(data||jsonb_build_object('cover_path',photo));
 assert (select cover_path=photo and status='pending' from tournaments where id=tid), 'cover saved atomically';
 assert get_tournament_proposal(tid)->>'cover_path'=photo, 'editable proposal includes image';
 assert (select count(*)=3 from storage.objects where bucket_id='tournament-photos' and name like 'e5400000-%'), 'only own objects visible';
 begin
   insert into storage.objects(bucket_id,name,metadata) values('tournament-photos',
     'e5400000-0000-4000-8000-000000000002/e5400000-0000-4000-8000-000000000015.png','{"mimetype":"image/png","size":100}');
   raise exception 'CHECK_FAILED: upload into other account accepted';
 exception when insufficient_privilege then null; end;
 perform resubmit_tournament(tid,data||jsonb_build_object('cover_path',photo));
 assert (select cover_path=photo from tournaments where id=tid), 'resubmit retains cover';
 perform resubmit_tournament(tid,data||jsonb_build_object('cover_path',''));
 assert (select cover_path is null from tournaments where id=tid), 'resubmit removes cover';
 plain:=submit_tournament(data);
 assert (select cover_path is null from tournaments where id=plain), 'old clients and no-photo submissions work';
end $$;
rollback;
