create table public.venue_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,venue_id)
);
alter table public.venue_favorites enable row level security;
revoke all on public.venue_favorites from anon,authenticated;
grant select on public.venue_favorites to authenticated;
create policy favorites_read on public.venue_favorites for select to authenticated
  using(user_id=auth.uid() and public.account_active());

create function public.set_venue_favorite(p_venue_id uuid,p_saved boolean)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from public.profiles where id=auth.uid() for update;
  if not public.account_active() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_saved is null or p_venue_id is null then raise exception 'INVALID_FAVORITE' using errcode='22023'; end if;
  if not p_saved then
    delete from public.venue_favorites where user_id=auth.uid() and venue_id=p_venue_id;
    return false;
  end if;
  perform 1 from public.venues where id=p_venue_id and status='active' for share;
  if not found then raise exception 'VENUE_UNAVAILABLE' using errcode='22023'; end if;
  if exists(select 1 from public.venue_favorites where user_id=auth.uid() and venue_id=p_venue_id) then return true; end if;
  if (select count(*) from public.venue_favorites where user_id=auth.uid())>=100 then raise exception 'FAVORITES_LIMIT' using errcode='22023'; end if;
  insert into public.venue_favorites(user_id,venue_id) values(auth.uid(),p_venue_id) on conflict do nothing;
  return true;
end $$;

create function public.get_my_favorites()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not public.account_active() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',v.id,'name',case when v.status='active' then v.name else 'Sân hiện không công khai' end,
    'slug',case when v.status='active' then v.slug end,
    'address',case when v.status='active' then v.address end,
    'district',case when v.status='active' then v.district end,
    'image',case when v.status='active' then v.images[1] end,
    'saved_at',f.created_at
  ) order by f.created_at desc,v.id)
  from public.venue_favorites f join public.venues v on v.id=f.venue_id where f.user_id=auth.uid()),'[]'::jsonb);
end $$;

-- Calendar dates are formatted in SQL, with UTC values for interoperable ICS.
create function public.get_booking_calendar(p_code text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not public.account_active() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return (select jsonb_build_object(
    'id',b.id,'code',b.code,'title',v.name || ' · ' || c.name,
    'location',v.address || ', ' || v.district || ', ' || v.city,
    'starts_at',to_char(b.starts_at at time zone 'UTC','YYYYMMDD"T"HH24MISS"Z"'),
    'ends_at',to_char(b.ends_at at time zone 'UTC','YYYYMMDD"T"HH24MISS"Z"'),
    'stamp',to_char(now() at time zone 'UTC','YYYYMMDD"T"HH24MISS"Z"')
  ) from public.bookings b join public.courts c on c.id=b.court_id join public.venues v on v.id=c.venue_id
  where b.code=p_code and b.user_id=auth.uid() and b.status in ('confirmed','completed'));
end $$;
revoke all on function public.set_venue_favorite(uuid,boolean),public.get_my_favorites(),public.get_booking_calendar(text) from public,anon;
grant execute on function public.set_venue_favorite(uuid,boolean),public.get_my_favorites(),public.get_booking_calendar(text) to authenticated;
