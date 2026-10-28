-- Disposable fixtures and hostile caller namespace; every change rolls back.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

do $$ declare fn text; p record; begin
  assert not has_schema_privilege('anon', 'public', 'CREATE');
  assert not has_schema_privilege('authenticated', 'public', 'CREATE');
  for p in select p.* from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and not exists (select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
  loop
    assert exists(select 1 from unnest(p.proconfig) setting where setting like 'search_path=%'),
      format('Unpinned function: %s', p.oid::regprocedure);
    if p.prorettype = 'trigger'::regtype then
      assert not has_function_privilege('anon', p.oid, 'EXECUTE'), format('Anonymous trigger: %s', p.oid::regprocedure);
      assert not has_function_privilege('authenticated', p.oid, 'EXECUTE'), format('Browser trigger: %s', p.oid::regprocedure);
    end if;
  end loop;
  foreach fn in array array[
    'public.register_owner(text,text,text,text,text,text)',
    'public.create_venue(text,text,text,text,text,time,time,jsonb)',
    'public.update_venue(uuid,text,text,text,text,text,time,time,int,int)',
    'public.delete_venue(uuid)',
    'public.create_court(uuid,text,public.sport_type,text,boolean,int,time,time,int)',
    'public.update_court(uuid,text,public.sport_type,text,boolean,int,time,time,boolean,int)',
    'public.delete_court(uuid)', 'public.get_owner_stats(uuid,date,date)',
    'public.create_booking(uuid,timestamptz,timestamptz,text,text,text)',
    'public.cancel_booking(text,boolean)', 'public.review_owner(uuid,text,text)'
  ] loop
    assert not has_function_privilege('anon', fn, 'EXECUTE'), 'Anonymous owner/player write: ' || fn;
    assert has_function_privilege('authenticated', fn, 'EXECUTE'), 'Signed-in access lost: ' || fn;
  end loop;
  foreach fn in array array[
    'public.search_venues(text,public.sport_type,text,date,boolean,boolean,text,int)',
    'public.get_venue_calendar(uuid,date)', 'public.get_venue_availability(uuid,date)',
    'public.search_community(text,text,int)', 'public.get_community_profile(uuid)',
    'public.account_active()', 'public.is_admin()', 'public.venue_accepts_bookings(uuid)'
  ] loop
    assert has_function_privilege('anon', fn, 'EXECUTE'), 'Public/RLS helper lost: ' || fn;
    assert has_function_privilege('authenticated', fn, 'EXECUTE'), 'Signed-in read lost: ' || fn;
  end loop;
  assert has_function_privilege('anon', 'public.connect_telegram(text,text)', 'EXECUTE'), 'Telegram bot linking remains public';
  foreach fn in array array[
    'public.confirm_payment(text,int,text,jsonb)',
    'public.confirm_payment(text,int,text,jsonb,uuid,text,text)',
    'public.confirm_subscription_payment(text,int,text,jsonb,uuid,text,text)',
    'public.confirm_tournament_payment(text,int,text,jsonb,uuid,text,text)',
    'public.process_incoming_transfer(text[],int,text,jsonb,uuid,text,text)',
    'public.claim_notification_deliveries(int)'
  ] loop
    assert not has_function_privilege('anon', fn, 'EXECUTE');
    assert not has_function_privilege('authenticated', fn, 'EXECUTE');
    assert has_function_privilege('service_role', fn, 'EXECUTE'), 'Worker/webhook lost: ' || fn;
  end loop;
  assert not has_function_privilege('anon', 'public.gen_booking_code()', 'EXECUTE');
  assert not has_function_privilege('authenticated', 'public.gen_booking_code()', 'EXECUTE');
end $$;

create schema rpc_security_shadow;
create function rpc_security_shadow.unaccent_vi(text) returns text language sql immutable as $$ select 'HIJACKED'::text $$;
create function rpc_security_shadow.translate(text,text,text) returns text language sql immutable as $$ select 'HIJACKED'::text $$;
create function rpc_security_shadow.substr(text,int,int) returns text language sql immutable as $$ select '!'::text $$;
set local search_path = rpc_security_shadow, public, pg_catalog;
do $$ begin
  assert public.unaccent_vi('Sân Đẹp Hà Nội') = 'San Dep Ha Noi', 'Unaccent ignores caller functions';
  assert public.unaccent_vi(null) is null;
  assert public.slugify('  Sân Đẹp — Hà Nội!  ') = 'san-dep-ha-noi', 'Slug uses trusted helper';
  assert public.slugify('---') = '' and public.slugify(null) is null;
  for i in 1..100 loop
    assert public.gen_booking_code() ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$', 'Booking code ignores shadow built-ins';
  end loop;
end $$;
set local search_path = public;

-- Auth's profile trigger still runs even though browser EXECUTE is revoked.
insert into auth.users(id) values ('e2810000-0000-4000-8000-000000000001');
do $$ begin
  assert exists(select 1 from public.profiles where id = 'e2810000-0000-4000-8000-000000000001'), 'Signup still creates profile';
end $$;
update public.profiles set role = 'owner', owner_application_status = 'active',
  payout_bank = 'MBBank', payout_account = '1234567890'
where id = 'e2810000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub', 'e2810000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$ declare v public.venues; c public.courts; begin
  v := public.create_venue('Sân quyền RPC rollback', 'Địa chỉ rollback', 'Ba Đình', '0900000001', null,
    '05:00', '23:00', '[{"sport":"badminton","court_count":1,"price_per_hour":100000}]');
  assert v.status = 'draft' and v.slug = 'san-quyen-rpc-rollback', 'Owner can create draft with trusted slug';
  c := public.create_court(v.id, 'Sân bổ sung', 'badminton', null, false, 60, null, null, 100000);
  perform public.delete_court(c.id);
  assert public.get_owner_stats(v.id, current_date, current_date) is not null, 'Owner stats accessible';
  perform public.delete_venue(v.id);
end $$;
reset role;

-- Restricting direct EXECUTE must not disable the ban trigger on real writes.
update public.profiles set banned_until = 'infinity' where id = 'e2810000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
  begin
    update public.profiles set full_name = 'Bypass' where id = auth.uid();
    raise exception 'CHECK_FAILED: revoked trigger no longer enforces ban';
  exception when insufficient_privilege then
    assert sqlerrm = 'ACCOUNT_BANNED', 'Ban trigger actually ran';
  end;
end $$;
reset role;
rollback;
