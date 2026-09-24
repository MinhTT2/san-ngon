-- Public discovery: one row per location, matching courts and prices for the chosen day.
create or replace function public.search_venues(
  p_query text default '', p_sport sport_type default null,
  p_district text default '', p_date date default null,
  p_indoor boolean default null, p_available boolean default false,
  p_sort text default 'name', p_page int default 1
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_date date;
  v_result jsonb;
begin
  v_date := greatest(v_today, least(coalesce(p_date, v_today), v_today + 180));
  -- ponytail: aggregate live slots after location filters; add a daily search index
  -- if the onboarded catalogue grows enough for this query to become slow.
  with candidates as materialized (
    select v.id, v.slug, v.name, v.address, v.district, v.images, v.amenities,
      v.deposit_pct, c.court_count, c.sports, c.court_ids
    from venues v
    cross join lateral (
      select count(*)::int court_count, array_agg(distinct c.sport) sports, array_agg(c.id) court_ids
      from courts c where c.venue_id = v.id and c.is_active
        and (p_sport is null or c.sport = p_sport)
        and (p_indoor is null or c.is_indoor = p_indoor)
    ) c
    where v.status = 'active' and c.court_count > 0
      and (coalesce(p_district, '') = '' or v.district = p_district)
      -- Literal substring: %, quotes and PostgREST syntax cannot broaden the query.
      and (coalesce(trim(p_query), '') = '' or strpos(
        lower(v.name || ' ' || v.address || ' ' || v.district), lower(left(trim(p_query), 100))) > 0)
  ), summaries as materialized (
    select v.id, v.slug, v.name, v.address, v.district, v.images, v.amenities,
      v.deposit_pct, v.court_count, v.sports, a.*
    from candidates v cross join lateral (
      select count(*) filter (where s.is_available)::int available_slots,
        min(round(s.price * 60.0 / s.slot_minutes)) filter (where s.is_available)::int min_price,
        min(s.starts_at) filter (where s.is_available) next_slot
      from get_venue_availability(v.id, v_date) s where s.court_id = any(v.court_ids)
    ) a
  ), filtered as materialized (
    select * from summaries where not coalesce(p_available, false) or available_slots > 0
  ), totals as (
    select count(*)::int total, greatest(1, ceil(count(*) / 9.0)::int) pages from filtered
  ), paging as (
    select *, greatest(1, least(coalesce(p_page, 1), pages)) page from totals
  ), ordered as (
    select *, row_number() over (order by
      case when p_sort = 'price' then min_price end asc nulls last,
      case when p_sort = 'availability' then available_slots end desc,
      name, id) position from filtered
  )
  select jsonb_build_object(
    'date', v_date, 'today', v_today, 'last_date', v_today + 180,
    'total', p.total, 'page', p.page, 'pages', p.pages, 'page_size', 9,
    'venues', coalesce((select jsonb_agg(to_jsonb(o) - 'position' order by o.position)
      from ordered o where position > (p.page - 1) * 9 and position <= p.page * 9), '[]'::jsonb)
  ) into v_result from paging p;
  return v_result;
end $$;

-- SQL owns the calendar bounds and timezone, including browsers outside Vietnam.
create or replace function public.get_venue_calendar(p_venue_id uuid, p_date date default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with bounds as (
    select (now() at time zone 'Asia/Ho_Chi_Minh')::date today,
      ((now() + make_interval(days => booking_horizon_days)) at time zone 'Asia/Ho_Chi_Minh')::date last_date
    from venues where id = p_venue_id and status = 'active'
  ), picked as (
    select *, greatest(today, least(coalesce(p_date, today), last_date)) date from bounds
  )
  select jsonb_build_object('today', today, 'last_date', last_date, 'date', date,
    'days', (select jsonb_agg(jsonb_build_object('date', d, 'weekday', extract(isodow from d)::int) order by d)
      from (select today + i d from generate_series(0, least(13, last_date - today)) i
        union select date) days)) from picked;
$$;

revoke all on function public.search_venues(text,sport_type,text,date,boolean,boolean,text,int),
  public.get_venue_calendar(uuid,date) from public;
grant execute on function public.search_venues(text,sport_type,text,date,boolean,boolean,text,int),
  public.get_venue_calendar(uuid,date) to anon, authenticated;
