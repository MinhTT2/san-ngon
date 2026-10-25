-- Show playing activity separately from receipts. Demo bookings without paid
-- payments remain visible here and never become revenue. All dates use SQL.
create or replace function public.website_booking_stats(p_venue_id uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare answer jsonb;
begin
  if not public.account_active() or
    (p_venue_id is null and not public.is_admin()) or
    (p_venue_id is not null and not exists(select 1 from venues where id=p_venue_id and (owner_id=auth.uid() or public.is_admin())))
  then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'INVALID_DATE_RANGE'; end if;

  with scoped_venues as materialized (
    -- Historical revenue survives deactivation of a venue or court.
    select * from venues where p_venue_id is null or id=p_venue_id
  ), operating as materialized (
    select b.*,c.venue_id from bookings b join courts c on c.id=b.court_id join scoped_venues v on v.id=c.venue_id
    where b.starts_at >= (p_from::timestamp at time zone 'Asia/Ho_Chi_Minh')
      and b.starts_at < ((p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh')
  ), receipts as materialized (
    select * from public.booking_revenue_entries(p_venue_id,p_from,p_to)
  ), capacity as (
    select coalesce(sum(extract(epoch from (coalesce(c.close_time,v.close_time)-coalesce(c.open_time,v.open_time)))/3600*(p_to-p_from+1)),0) hours
    from courts c join scoped_venues v on v.id=c.venue_id where c.is_active and v.status='active'
  ), booked as (
    select coalesce(sum(extract(epoch from (ends_at-starts_at))/3600) filter(where status in ('confirmed','completed')),0) hours from operating
  ), court_stats as (
    select c.id,c.name,
      (select count(*) from operating b where b.court_id=c.id and b.status in ('confirmed','completed')) bookings,
      (select coalesce(sum(r.amount),0) from receipts r where r.court_id=c.id) revenue,
      (select round(coalesce(sum(extract(epoch from (b.ends_at-b.starts_at))/3600),0),1) from operating b where b.court_id=c.id and b.status in ('confirmed','completed')) hours
    from courts c join scoped_venues v on v.id=c.venue_id
  ), venue_stats as (
    select v.id,v.name,v.district,
      (select count(*) from receipts r where r.venue_id=v.id) bookings,
      (select count(*) from operating b where b.venue_id=v.id and b.status in ('confirmed','completed')) playing_bookings,
      (select coalesce(sum(r.amount),0) from receipts r where r.venue_id=v.id) revenue
    from scoped_venues v
  )
  select jsonb_build_object('from',p_from,'to',p_to,
    'summary',jsonb_build_object(
      'bookings',(select count(*) from operating),
      'paid_bookings',(select count(*) from receipts),
      'revenue',(select coalesce(sum(amount),0) from receipts),
      'deposit',(select coalesce(sum(amount),0) from receipts),
      'cancelled',(select count(*) from operating where status in ('cancelled','no_show')),
      'pending',(select count(*) from bookings b join courts c on c.id=b.court_id join scoped_venues v on v.id=c.venue_id where b.status='pending' and b.expires_at>now()),
      'pending_bookings',(select count(*) from bookings b join courts c on c.id=b.court_id join scoped_venues v on v.id=c.venue_id where b.status='pending' and b.expires_at>now()),
      'capacity_hours',round(cap.hours,1),'booked_hours',round(bk.hours,1),
      'occupancy_pct',case when cap.hours=0 then 0 else round(bk.hours/cap.hours*100,1) end,
      'cancellation_pct',(select case when count(*) filter(where status<>'pending')=0 then 0 else round(count(*) filter(where status in ('cancelled','no_show'))::numeric/count(*) filter(where status<>'pending')*100,1) end from operating),
      'active_venues',(select count(*) from scoped_venues where status='active'),
      'active_courts',(select count(*) from courts c join scoped_venues v on v.id=c.venue_id where c.is_active and v.status='active'),
      'players',(select count(*) from profiles where role='player'),
      'owners',(select count(*) from profiles where role='owner'),
      'new_players',(select count(*) from profiles where role='player' and created_at >= (p_from::timestamp at time zone 'Asia/Ho_Chi_Minh') and created_at < ((p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh')),
      'pending_owners',(select count(*) from profiles where owner_application_status='pending'),
      'pending_venues',(select count(*) from scoped_venues where status='pending')
    ),
    'daily',(select jsonb_agg(jsonb_build_object('date',d.day::date,
      'bookings',(select count(*) from receipts r where r.paid_date=d.day::date),
      'playing_bookings',(select count(*) from operating b where (b.starts_at at time zone 'Asia/Ho_Chi_Minh')::date=d.day::date and b.status in ('confirmed','completed')),
      'revenue',(select coalesce(sum(r.amount),0) from receipts r where r.paid_date=d.day::date)) order by d.day)
      from generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d(day)),
    'courts',coalesce((select jsonb_agg(to_jsonb(c) order by c.hours desc,c.name,c.id) from court_stats c),'[]'::jsonb),
    'activity_venues',coalesce((select jsonb_agg(to_jsonb(v) order by v.playing_bookings desc,v.name,v.id) from (select * from venue_stats where playing_bookings>0 order by playing_bookings desc,name,id limit 8) v),'[]'::jsonb),
    'venues',coalesce((select jsonb_agg(to_jsonb(v) order by v.revenue desc,v.name,v.id) from (select * from venue_stats order by revenue desc,name,id limit 8) v),'[]'::jsonb)
  ) into answer from capacity cap cross join booked bk;
  -- Owners receive only the venue report, never platform-wide account counts.
  if p_venue_id is not null then
    answer := (answer-'venues'-'activity_venues') || jsonb_build_object('summary',(answer->'summary')-
      array['players','owners','new_players','pending_owners','pending_venues','active_venues','active_courts','pending_bookings']);
  end if;
  return answer;
end $$;

notify pgrst, 'reload schema';
