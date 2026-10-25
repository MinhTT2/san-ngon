-- Requested report fixture: reach 40 total orders, without bank receipts.
begin;
select pg_advisory_xact_lock(20261025,40);
do $$
declare n int; needed int; actor record; slot record;
begin
  select greatest(0,40-count(*)) into needed from bookings;
  for n in 1..needed loop
    select p.* into strict actor from profiles p join auth.users u on u.id=p.id
      where u.raw_user_meta_data->>'demo_seed'='demo-players-20261020'
      order by p.full_name,p.id offset n-1 limit 1;
    select c.id as court_id, t.starts_at, t.starts_at+interval '1 hour' as ends_at, r.price_per_hour as price into strict slot
    from courts c join venues v on v.id=c.venue_id
    cross join generate_series(date '2026-10-20',date '2026-10-24',interval '1 day') d
    cross join generate_series(9,20) h
    cross join lateral (select (d::date+h*interval '1 hour') at time zone 'Asia/Ho_Chi_Minh' as starts_at) t
    cross join lateral (select pr.price_per_hour from price_rules pr where pr.court_id=c.id
      and extract(dow from d)::int=any(pr.days) and pr.start_time<=make_time(h,0,0)
      and pr.end_time>=make_time(h+1,0,0) order by pr.priority desc,pr.id limit 1) r
    where v.status='active' and c.is_active and r.price_per_hour>0
      and coalesce(c.open_time,v.open_time)<=make_time(h,0,0)
      and coalesce(c.close_time,v.close_time)>=make_time(h+1,0,0)
      and t.starts_at>actor.created_at and t.starts_at+interval '1 hour'<now()
      and not exists(select 1 from bookings b where b.court_id=c.id
        and b.status in ('pending','confirmed','completed')
        and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(t.starts_at,t.starts_at+interval '1 hour','[)'))
      and not exists(select 1 from court_closures cc where cc.court_id=c.id
        and tstzrange(cc.starts_at,cc.ends_at,'[)') && tstzrange(t.starts_at,t.starts_at+interval '1 hour','[)'))
    order by t.starts_at,c.id limit 1;
    insert into bookings(code,court_id,user_id,starts_at,ends_at,total_amount,deposit_amount,
      status,refund_status,customer_name,customer_phone,note,created_at,expires_at)
    values('SAN'||gen_booking_code(),slot.court_id,actor.id,slot.starts_at,slot.ends_at,slot.price,slot.price,
      'completed','none',actor.full_name,actor.phone,'[demo-report-20261025] Dữ liệu demo, không phải giao dịch ngân hàng',
      slot.starts_at-interval '1 hour',slot.starts_at-interval '45 minutes');
  end loop;
  assert (select count(*)>=40 from bookings), 'Expected at least 40 orders';
end $$;
commit;
select count(*) as total_bookings from bookings;
