-- Opt-in public contact card; private profiles and verification documents stay private.
create table public.community_profiles (
  user_id uuid primary key references public.profiles(id),
  display_name text not null check(length(display_name) between 2 and 100),
  phone text not null check(phone ~ '^0[0-9]{9}$'),
  location text not null check(length(location) between 2 and 200),
  sport sport_type not null,
  skill_level text not null check(skill_level in ('beginner','intermediate','advanced')),
  bio text not null default '' check(length(bio)<=1000),
  facebook_url text not null default '' check(facebook_url='' or facebook_url ~ '^https://(www\.)?facebook\.com/[^[:space:]]+$'),
  zalo_phone text not null default '' check(zalo_phone='' or zalo_phone ~ '^0[0-9]{9}$'),
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.community_profiles enable row level security;
revoke all on public.community_profiles from public,anon,authenticated;
grant select on public.community_profiles to anon,authenticated;
grant all on public.community_profiles to service_role;
create policy community_read on public.community_profiles for select to authenticated using(user_id=auth.uid());
-- Use a definer read with a fixed projection: profiles RLS never becomes public.
create function public.search_community(p_sport text default '',p_location text default '',p_page int default 1)
returns jsonb language sql stable security definer set search_path=public as $$
  with visible as (
    select c.*,p.avatar_url from community_profiles c join profiles p on p.id=c.user_id
    where c.is_public and (p.banned_until is null or p.banned_until<=now())
      and (p_sport='' or c.sport::text=p_sport) and (p_location='' or position(lower(left(p_location,200)) in lower(c.location))>0)
  ) select jsonb_build_object('total',(select count(*) from visible),'rows',coalesce((select jsonb_agg(to_jsonb(x)) from (
    select user_id,display_name,location,sport,skill_level,avatar_url from visible order by updated_at desc,user_id limit 24 offset (greatest(1,least(coalesce(p_page,1),10000))-1)*24
  ) x),'[]'::jsonb));
$$;
create function public.get_community_profile(p_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select to_jsonb(c)||jsonb_build_object('avatar_url',p.avatar_url) from community_profiles c join profiles p on p.id=c.user_id
    where c.user_id=p_id and (c.user_id=auth.uid() or (c.is_public and (p.banned_until is null or p.banned_until<=now())));
$$;
create function public.set_community_profile(p_data jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not account_active() then raise exception 'ACCOUNT_BANNED'; end if;
  insert into community_profiles(user_id,display_name,phone,location,sport,skill_level,bio,facebook_url,zalo_phone,is_public)
  values(auth.uid(),trim(p_data->>'display_name'),regexp_replace(regexp_replace(p_data->>'phone','[[:space:]().-]','','g'),'^\+84','0'),trim(p_data->>'location'),
    (p_data->>'sport')::sport_type,p_data->>'skill_level',trim(coalesce(p_data->>'bio','')),trim(coalesce(p_data->>'facebook_url','')),
    regexp_replace(regexp_replace(coalesce(p_data->>'zalo_phone',''),'[[:space:]().-]','','g'),'^\+84','0'),coalesce((p_data->>'is_public')::boolean,false))
  on conflict(user_id) do update set display_name=excluded.display_name,phone=excluded.phone,location=excluded.location,sport=excluded.sport,
    skill_level=excluded.skill_level,bio=excluded.bio,facebook_url=excluded.facebook_url,zalo_phone=excluded.zalo_phone,is_public=excluded.is_public,updated_at=now();
end $$;
revoke all on function public.search_community(text,text,int),public.get_community_profile(uuid),public.set_community_profile(jsonb) from public,anon,authenticated;
grant execute on function public.search_community(text,text,int),public.get_community_profile(uuid) to anon,authenticated;
grant execute on function public.set_community_profile(jsonb) to authenticated;

-- Calculate the statistics period in Vietnam in SQL, not in server/browser local time.
create function public.get_owner_period_stats(p_venue_id uuid,p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if p_days is null or p_days not in (7,30,90) then raise exception 'INVALID_PERIOD'; end if;
  return get_owner_stats(p_venue_id,today-p_days+1,today);
end $$;
revoke all on function public.get_owner_period_stats(uuid,int) from public,anon;
grant execute on function public.get_owner_period_stats(uuid,int) to authenticated;
notify pgrst,'reload schema';
