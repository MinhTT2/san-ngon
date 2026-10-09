begin;

-- Optional exact starting time and continuous duration, calculated in SQL.
create function public.search_venues_for_time(
  p_query text default '', p_sport public.sport_type default null,
  p_district text default '', p_date date default null,
  p_indoor boolean default null, p_available boolean default false,
  p_sort text default 'name', p_page int default 1,
  p_time time default null, p_duration int default null
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_date date := greatest(v_today, least(coalesce(p_date, v_today), v_today + 180));
  v_result jsonb;
begin
  if p_time is null and p_duration is null then
    return public.search_venues(p_query,p_sport,p_district,p_date,p_indoor,p_available,p_sort,p_page);
  end if;
  if p_duration is not null and p_duration not in (30,60,90,120,180) then raise exception 'INVALID_DURATION'; end if;
  with candidates as materialized (
    select v.*, c.court_count, c.sports, c.court_ids from public.venues v
    cross join lateral (select count(*)::int court_count, array_agg(distinct c.sport) sports, array_agg(c.id) court_ids
      from public.courts c where c.venue_id=v.id and c.is_active
        and (p_sport is null or c.sport=p_sport) and (p_indoor is null or c.is_indoor=p_indoor)) c
    where v.status='active' and c.court_count>0 and (coalesce(p_district,'')='' or v.district=p_district)
      and (coalesce(trim(p_query),'')='' or strpos(lower(v.name||' '||v.address||' '||v.district),lower(left(trim(p_query),100)))>0)
  ), summaries as materialized (
    select v.id,v.slug,v.name,v.address,v.district,v.images,v.amenities,v.deposit_pct,v.court_count,v.sports,a.*
    from candidates v cross join lateral (
      with slots as materialized (select s.* from public.get_venue_availability(v.id,v_date) s where s.court_id=any(v.court_ids)),
      choices as (
        select s.starts_at, picked.total, coalesce(p_duration,s.slot_minutes) as minutes
        from slots s cross join lateral (
          select sum(t.price)::int total, count(*)::int n, bool_and(t.is_available) available,
            sum(t.slot_minutes)::int minutes, max(t.ends_at) ends_at
          from slots t where t.court_id=s.court_id and t.starts_at>=s.starts_at
            and t.ends_at<=s.starts_at+make_interval(mins=>coalesce(p_duration,s.slot_minutes))
        ) picked
        where s.is_available and (p_time is null or (s.starts_at at time zone 'Asia/Ho_Chi_Minh')::time=p_time)
          and picked.n between 1 and 3 and picked.available and picked.minutes=coalesce(p_duration,s.slot_minutes)
          and picked.ends_at=s.starts_at+make_interval(mins=>coalesce(p_duration,s.slot_minutes))
      ) select count(*)::int available_slots, min(round(total*60.0/minutes))::int min_price, min(starts_at) next_slot from choices
    ) a
  ), filtered as materialized (
    -- Choosing a time/duration always requires a court continuously free for it.
    select * from summaries where available_slots>0
  ), totals as (select count(*)::int total,greatest(1,ceil(count(*)/9.0)::int) pages from filtered),
  paging as (select *,greatest(1,least(coalesce(p_page,1),pages)) page from totals),
  ordered as (select *,row_number() over(order by
    case when p_sort='price' then min_price end asc nulls last,
    case when p_sort='availability' then available_slots end desc,name,id) position from filtered)
  select jsonb_build_object('date',v_date,'today',v_today,'last_date',v_today+180,'total',p.total,'page',p.page,'pages',p.pages,'page_size',9,
    'venues',coalesce((select jsonb_agg(to_jsonb(o)-'position' order by o.position) from ordered o
      where position>(p.page-1)*9 and position<=p.page*9),'[]'::jsonb)) into v_result from paging p;
  return v_result;
end $$;

-- Preview saved rules even on a draft court. It does not change prices or bookings.
create function public.get_owner_price_preview(p_court_id uuid,p_date date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_date date := coalesce(p_date,(now() at time zone 'Asia/Ho_Chi_Minh')::date);
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.account_active() or not exists(select 1 from public.courts c join public.venues v on v.id=c.venue_id where c.id=p_court_id and v.owner_id=auth.uid()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  with court as (
    select c.id,c.slot_minutes,coalesce(c.open_time,v.open_time) opens,coalesce(c.close_time,v.close_time) closes
    from public.courts c join public.venues v on v.id=c.venue_id where c.id=p_court_id
  ), slots as (
    select c.*,s starts_at,s+make_interval(mins=>c.slot_minutes) ends_at from court c
    cross join lateral generate_series((v_date+c.opens) at time zone 'Asia/Ho_Chi_Minh',
      ((v_date+c.closes+case when c.closes<=c.opens then interval '1 day' else interval '0' end) at time zone 'Asia/Ho_Chi_Minh')-make_interval(mins=>c.slot_minutes),make_interval(mins=>c.slot_minutes)) s
  ), priced as (
    select s.starts_at,s.ends_at,s.slot_minutes,pr.label,pr.priority,pr.price_per_hour,
      round(pr.price_per_hour*s.slot_minutes/60.0)::int price from slots s left join lateral (
      select r.* from public.price_rules r where r.court_id=s.id
        and extract(dow from s.starts_at at time zone 'Asia/Ho_Chi_Minh')::int=any(r.days)
        and (s.starts_at at time zone 'Asia/Ho_Chi_Minh')::time>=r.start_time
        and (s.starts_at at time zone 'Asia/Ho_Chi_Minh')::time<r.end_time
      order by r.priority desc,r.price_per_hour desc,r.id limit 1
    ) pr on true
  ) select jsonb_build_object('date',v_date,'rows',coalesce(jsonb_agg(to_jsonb(p) order by p.starts_at),'[]'::jsonb)) into v_result from priced p;
  return v_result;
end $$;
revoke all on function public.search_venues_for_time(text,public.sport_type,text,date,boolean,boolean,text,int,time,int) from public;
grant execute on function public.search_venues_for_time(text,public.sport_type,text,date,boolean,boolean,text,int,time,int) to anon,authenticated;
revoke all on function public.get_owner_price_preview(uuid,date) from public,anon;
grant execute on function public.get_owner_price_preview(uuid,date) to authenticated;
notify pgrst,'reload schema';
commit;
