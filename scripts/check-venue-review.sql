-- Chạy: npx supabase db query --linked --file scripts/check-venue-review.sql
-- Tất cả dữ liệu kiểm tra được rollback, không gửi email/thông báo.
begin;
insert into auth.users (id) values
  ('b83ebbe2-2c01-485a-b9fc-9a472985bbc1'),
  ('b83ebbe2-2c01-485a-b9fc-9a472985bbc2');
update profiles set role = 'admin' where id = 'b83ebbe2-2c01-485a-b9fc-9a472985bbc1';
update profiles set full_name = 'Kiểm tra chủ sân', phone = '0987654321',
  payout_bank = 'MB', payout_account = '1234567890'
  where id = 'b83ebbe2-2c01-485a-b9fc-9a472985bbc2';
insert into venues (id, owner_id, slug, name, address, district, status, business_license_path)
values ('b83ebbe2-2c01-485a-b9fc-9a472985bbc3', 'b83ebbe2-2c01-485a-b9fc-9a472985bbc2',
  'check-venue-review-rollback', 'Kiểm tra', 'Hà Nội', 'Cầu Giấy', 'pending',
  'b83ebbe2-2c01-485a-b9fc-9a472985bbc2/check.pdf');

select set_config('request.jwt.claim.sub', 'b83ebbe2-2c01-485a-b9fc-9a472985bbc2', true);
set local role authenticated;
do $$ begin
  begin
    update profiles set role = 'admin' where id = auth.uid();
    raise exception 'CHECK_FAILED: role escalation';
  exception when insufficient_privilege then null; end;
  begin
    update venues set status = 'active' where id = 'b83ebbe2-2c01-485a-b9fc-9a472985bbc3';
    raise exception 'CHECK_FAILED: direct approval';
  exception when insufficient_privilege then null; end;
  begin
    perform review_venue('b83ebbe2-2c01-485a-b9fc-9a472985bbc3', 'active');
    raise exception 'CHECK_FAILED: owner approval';
  exception when raise_exception then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', 'b83ebbe2-2c01-485a-b9fc-9a472985bbc1', true);
set local role authenticated;
do $$ begin
  begin
    perform review_venue('b83ebbe2-2c01-485a-b9fc-9a472985bbc3', 'active');
    raise exception 'CHECK_FAILED: missing document';
  exception when raise_exception then
    if sqlerrm <> 'BUSINESS_LICENSE_MISSING' then raise; end if;
  end;
end $$;
reset role;
insert into storage.objects (bucket_id, name)
values ('venue-documents', 'b83ebbe2-2c01-485a-b9fc-9a472985bbc2/check.pdf');

set local role authenticated;
do $$ begin
  if not exists (select 1 from storage.objects where name = 'b83ebbe2-2c01-485a-b9fc-9a472985bbc2/check.pdf') then
    raise exception 'CHECK_FAILED: admin cannot read document';
  end if;
  perform review_venue('b83ebbe2-2c01-485a-b9fc-9a472985bbc3', 'active');
  begin
    perform review_venue('b83ebbe2-2c01-485a-b9fc-9a472985bbc3', 'rejected');
    raise exception 'CHECK_FAILED: duplicate review';
  exception when raise_exception then
    if sqlerrm <> 'VENUE_ALREADY_REVIEWED' then raise; end if;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$ begin
  if exists (select 1 from storage.objects where name = 'b83ebbe2-2c01-485a-b9fc-9a472985bbc2/check.pdf') then
    raise exception 'CHECK_FAILED: public document';
  end if;
  if not exists (select 1 from venues where id = 'b83ebbe2-2c01-485a-b9fc-9a472985bbc3' and status = 'active') then
    raise exception 'CHECK_FAILED: approved venue hidden';
  end if;
end $$;
reset role;
rollback;
