-- Operational statistics for the owner and admin dashboards.
-- Keep aggregation here so the web layer only formats trusted numbers.

create or replace function public.get_owner_stats(p_venue_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_from timestamptz := (p_from::timestamp at time zone 'Asia/Ho_Chi_Minh');
  v_to timestamptz := ((p_to + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh');
  v_days int := greatest(1, p_to - p_from + 1);
  v_capacity numeric := 0;
  v_booked numeric := 0;
begin
  if not exists (
    select 1 from venues
    where id = p_venue_id and (owner_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'FORBIDDEN';
  end if;

  select coalesce(sum(extract(epoch from (coalesce(c.close_time, v.close_time) - coalesce(c.open_time, v.open_time))) / 3600 * v_days), 0)
    into v_capacity
  from courts c join venues v on v.id = c.venue_id
  where c.venue_id = p_venue_id and c.is_active;

  select coalesce(sum(extract(epoch from (b.ends_at - b.starts_at)) / 3600), 0)
    into v_booked
  from bookings b join courts c on c.id = b.court_id
  where c.venue_id = p_venue_id
    and b.starts_at >= v_from and b.starts_at < v_to
    and b.status in ('confirmed', 'completed');

  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'summary', jsonb_build_object(
      'bookings', (select count(*) from bookings b join courts c on c.id = b.court_id where c.venue_id = p_venue_id and b.starts_at >= v_from and b.starts_at < v_to),
      'paid_bookings', (select count(*) from bookings b join courts c on c.id = b.court_id where c.venue_id = p_venue_id and b.starts_at >= v_from and b.starts_at < v_to and b.status in ('confirmed', 'completed')),
      'revenue', (select coalesce(sum(b.total_amount), 0) from bookings b join courts c on c.id = b.court_id where c.venue_id = p_venue_id and b.starts_at >= v_from and b.starts_at < v_to and b.status in ('confirmed', 'completed')),
      'deposit', (select coalesce(sum(b.deposit_amount), 0) from bookings b join courts c on c.id = b.court_id where c.venue_id = p_venue_id and b.starts_at >= v_from and b.starts_at < v_to and b.status in ('confirmed', 'completed')),
      'cancelled', (select count(*) from bookings b join courts c on c.id = b.court_id where c.venue_id = p_venue_id and b.starts_at >= v_from and b.starts_at < v_to and b.status in ('cancelled', 'no_show')),
      'pending', (select count(*) from bookings b join courts c on c.id = b.court_id where c.venue_id = p_venue_id and b.status = 'pending'),
      'capacity_hours', round(v_capacity, 1),
      'booked_hours', round(v_booked, 1),
      'occupancy_pct', case when v_capacity = 0 then 0 else round(v_booked / v_capacity * 100, 1) end,
      'cancellation_pct', (select case when count(*) filter (where b.status <> 'pending') = 0 then 0 else round(count(*) filter (where b.status in ('cancelled', 'no_show'))::numeric / count(*) filter (where b.status <> 'pending') * 100, 1) end from bookings b join courts c on c.id = b.court_id where c.venue_id = p_venue_id and b.starts_at >= v_from and b.starts_at < v_to)
    ),
    'daily', coalesce((select jsonb_agg(jsonb_build_object(
      'date', d.day::date, 'bookings', (select count(*) from bookings b join courts c on c.id = b.court_id where c.venue_id = p_venue_id and (b.starts_at at time zone 'Asia/Ho_Chi_Minh')::date = d.day::date and b.starts_at >= v_from and b.starts_at < v_to),
      'revenue', (select coalesce(sum(b.total_amount), 0) from bookings b join courts c on c.id = b.court_id where c.venue_id = p_venue_id and (b.starts_at at time zone 'Asia/Ho_Chi_Minh')::date = d.day and b.starts_at >= v_from and b.starts_at < v_to and b.status in ('confirmed', 'completed'))
    ) order by d.day) from generate_series(p_from, p_to, interval '1 day') d(day)), '[]'::jsonb),
    'courts', coalesce((select jsonb_agg(jsonb_build_object('name', x.name, 'bookings', x.bookings, 'revenue', x.revenue, 'hours', round(x.hours, 1)) order by x.hours desc, x.name)
      from (select c.name, count(b.id) filter (where b.status in ('confirmed', 'completed')) as bookings,
        coalesce(sum(b.total_amount) filter (where b.status in ('confirmed', 'completed')), 0) as revenue,
        coalesce(sum(extract(epoch from (b.ends_at - b.starts_at)) / 3600) filter (where b.status in ('confirmed', 'completed')), 0) as hours
        from courts c left join bookings b on b.court_id = c.id and b.starts_at >= v_from and b.starts_at < v_to
        where c.venue_id = p_venue_id and c.is_active group by c.id, c.name) x), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_owner_stats(uuid, date, date) from public;
grant execute on function public.get_owner_stats(uuid, date, date) to authenticated;

create or replace function public.get_admin_stats(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_from timestamptz := (p_from::timestamp at time zone 'Asia/Ho_Chi_Minh');
  v_to timestamptz := ((p_to + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh');
  v_capacity numeric := 0;
  v_booked numeric := 0;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;

  select coalesce(sum(extract(epoch from (coalesce(c.close_time, v.close_time) - coalesce(c.open_time, v.open_time))) / 3600 * greatest(1, p_to - p_from + 1)), 0)
    into v_capacity
  from courts c join venues v on v.id = c.venue_id
  where v.status = 'active' and c.is_active;
  select coalesce(sum(extract(epoch from (b.ends_at - b.starts_at)) / 3600), 0)
    into v_booked
  from bookings b join courts c on c.id = b.court_id join venues v on v.id = c.venue_id
  where v.status = 'active' and b.starts_at >= v_from and b.starts_at < v_to and b.status in ('confirmed', 'completed');

  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'summary', jsonb_build_object(
      'active_venues', (select count(*) from venues where status = 'active'),
      'active_courts', (select count(*) from courts c join venues v on v.id = c.venue_id where v.status = 'active' and c.is_active),
      'players', (select count(*) from profiles where role = 'player'),
      'owners', (select count(*) from profiles where role = 'owner'),
      'new_players', (select count(*) from profiles where role = 'player' and created_at >= v_from and created_at < v_to),
      'bookings', (select count(*) from bookings b join courts c on c.id = b.court_id join venues v on v.id = c.venue_id where v.status = 'active' and b.starts_at >= v_from and b.starts_at < v_to),
      'paid_bookings', (select count(*) from bookings b join courts c on c.id = b.court_id join venues v on v.id = c.venue_id where v.status = 'active' and b.starts_at >= v_from and b.starts_at < v_to and b.status in ('confirmed', 'completed')),
      'revenue', (select coalesce(sum(b.total_amount), 0) from bookings b join courts c on c.id = b.court_id join venues v on v.id = c.venue_id where v.status = 'active' and b.starts_at >= v_from and b.starts_at < v_to and b.status in ('confirmed', 'completed')),
      'deposit', (select coalesce(sum(b.deposit_amount), 0) from bookings b join courts c on c.id = b.court_id join venues v on v.id = c.venue_id where v.status = 'active' and b.starts_at >= v_from and b.starts_at < v_to and b.status in ('confirmed', 'completed')),
      'cancelled', (select count(*) from bookings b join courts c on c.id = b.court_id join venues v on v.id = c.venue_id where v.status = 'active' and b.starts_at >= v_from and b.starts_at < v_to and b.status in ('cancelled', 'no_show')),
      'pending_bookings', (select count(*) from bookings b join courts c on c.id = b.court_id join venues v on v.id = c.venue_id where v.status = 'active' and b.status = 'pending'),
      'pending_owners', (select count(*) from profiles where owner_application_status = 'pending'),
      'pending_venues', (select count(*) from venues where status = 'pending'),
      'capacity_hours', round(v_capacity, 1), 'booked_hours', round(v_booked, 1),
      'occupancy_pct', case when v_capacity = 0 then 0 else round(v_booked / v_capacity * 100, 1) end
    ),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('date', d.day::date,
      'bookings', (select count(*) from bookings b join courts c on c.id = b.court_id join venues v on v.id = c.venue_id where v.status = 'active' and (b.starts_at at time zone 'Asia/Ho_Chi_Minh')::date = d.day and b.starts_at >= v_from and b.starts_at < v_to),
      'revenue', (select coalesce(sum(b.total_amount), 0) from bookings b join courts c on c.id = b.court_id join venues v on v.id = c.venue_id where v.status = 'active' and (b.starts_at at time zone 'Asia/Ho_Chi_Minh')::date = d.day and b.starts_at >= v_from and b.starts_at < v_to and b.status in ('confirmed', 'completed'))
    ) order by d.day) from generate_series(p_from, p_to, interval '1 day') d(day)), '[]'::jsonb),
    'venues', coalesce((select jsonb_agg(jsonb_build_object('name', x.name, 'district', x.district, 'bookings', x.bookings, 'revenue', x.revenue) order by x.revenue desc, x.name)
      from (select v.name, v.district, count(b.id) filter (where b.status in ('confirmed', 'completed')) as bookings,
        coalesce(sum(b.total_amount) filter (where b.status in ('confirmed', 'completed')), 0) as revenue
        from venues v left join courts c on c.venue_id = v.id left join bookings b on b.court_id = c.id and b.starts_at >= v_from and b.starts_at < v_to
        where v.status = 'active' group by v.id, v.name, v.district order by revenue desc limit 8) x), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_admin_stats(date, date) from public;
grant execute on function public.get_admin_stats(date, date) to authenticated;
