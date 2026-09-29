begin;
insert into auth.users(id) values('e2910000-0000-4000-8000-000000000001'),('e2910000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','e2910000-0000-4000-8000-000000000001',true);
set local role authenticated;
select set_community_profile('{"display_name":"Người chơi test","phone":"+84 900 000 001","location":"Khu vực thử nghiệm 291","sport":"badminton","skill_level":"beginner","bio":"","facebook_url":"https://facebook.com/test","zalo_phone":"0900000001","is_public":false,"show_phone":true,"show_zalo":false,"show_facebook":false,"usual_play_times":"Tối thứ 3 sau 19h"}');
do $$ begin
 assert get_community_profile(auth.uid())->>'phone'='0900000001';
 begin
  perform set_community_profile('{"display_name":"Tên kiểm tra","phone":"0900000001","location":"Hà Nội","sport":"badminton","skill_level":"beginner","facebook_url":"javascript:alert(1)","is_public":true}');
  raise exception 'TEST: unsafe social URL';
 exception when check_violation then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','e2910000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 assert get_community_profile('e2910000-0000-4000-8000-000000000001') is null;
 assert (search_community('','Khu vực thử nghiệm 291',1)->>'total')::int=0;
 assert not exists(select 1 from community_profiles where user_id='e2910000-0000-4000-8000-000000000001');
end $$;
reset role;
update community_profiles set is_public=true where user_id='e2910000-0000-4000-8000-000000000001';
set local role anon;
do $$ declare result jsonb; begin
 result:=search_community('badminton','Khu vực thử nghiệm 291',1);
 assert (result->>'total')::int=1;
 assert not ((result->'rows'->0) ? 'phone'),'list shows summary only';
 assert get_community_profile('e2910000-0000-4000-8000-000000000001')->>'phone'='0900000001';
 assert get_community_profile('e2910000-0000-4000-8000-000000000001')->>'zalo_phone'='';
 assert get_community_profile('e2910000-0000-4000-8000-000000000001')->>'facebook_url'='';
 assert get_community_profile('e2910000-0000-4000-8000-000000000001')->>'usual_play_times'='Tối thứ 3 sau 19h';
 assert not has_function_privilege('anon','set_community_profile(jsonb)','EXECUTE');
end $$;
reset role;
update profiles set banned_until='infinity' where id='e2910000-0000-4000-8000-000000000001';
set local role anon;
do $$ begin
 assert get_community_profile('e2910000-0000-4000-8000-000000000001') is null;
 assert (search_community('','Khu vực thử nghiệm 291',1)->>'total')::int=0;
end $$;
reset role;
rollback;
