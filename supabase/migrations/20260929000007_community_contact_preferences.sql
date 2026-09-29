alter table public.community_profiles
 add column show_phone boolean not null default true,
 add column show_zalo boolean not null default true,
 add column show_facebook boolean not null default true,
 add column usual_play_times text not null default '' check(length(usual_play_times)<=300);
-- Existing public contacts keep the choices users already consented to; new profiles opt in per channel.
alter table public.community_profiles alter column show_phone set default false;
alter table public.community_profiles alter column show_zalo set default false;
alter table public.community_profiles alter column show_facebook set default false;
create or replace function public.get_community_profile(p_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select to_jsonb(c)||jsonb_build_object('avatar_url',p.avatar_url,
   'phone',case when c.user_id=auth.uid() or c.show_phone then c.phone else '' end,
   'zalo_phone',case when c.user_id=auth.uid() or c.show_zalo then c.zalo_phone else '' end,
   'facebook_url',case when c.user_id=auth.uid() or c.show_facebook then c.facebook_url else '' end)
 from community_profiles c join profiles p on p.id=c.user_id
 where c.user_id=p_id and (c.user_id=auth.uid() or (c.is_public and (p.banned_until is null or p.banned_until<=now())));
$$;
create or replace function public.set_community_profile(p_data jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not account_active() then raise exception 'ACCOUNT_BANNED'; end if;
  insert into community_profiles(user_id,display_name,phone,location,sport,skill_level,bio,facebook_url,zalo_phone,is_public,show_phone,show_zalo,show_facebook,usual_play_times)
  values(auth.uid(),trim(p_data->>'display_name'),regexp_replace(regexp_replace(p_data->>'phone','[[:space:]().-]','','g'),'^\+84','0'),trim(p_data->>'location'),
    (p_data->>'sport')::sport_type,p_data->>'skill_level',trim(coalesce(p_data->>'bio','')),trim(coalesce(p_data->>'facebook_url','')),
    regexp_replace(regexp_replace(coalesce(p_data->>'zalo_phone',''),'[[:space:]().-]','','g'),'^\+84','0'),coalesce((p_data->>'is_public')::boolean,false),
    coalesce((p_data->>'show_phone')::boolean,(select show_phone from community_profiles where user_id=auth.uid()),false),
    coalesce((p_data->>'show_zalo')::boolean,(select show_zalo from community_profiles where user_id=auth.uid()),false),
    coalesce((p_data->>'show_facebook')::boolean,(select show_facebook from community_profiles where user_id=auth.uid()),false),trim(coalesce(p_data->>'usual_play_times','')))
  on conflict(user_id) do update set display_name=excluded.display_name,phone=excluded.phone,location=excluded.location,sport=excluded.sport,
    skill_level=excluded.skill_level,bio=excluded.bio,facebook_url=excluded.facebook_url,zalo_phone=excluded.zalo_phone,is_public=excluded.is_public,show_phone=excluded.show_phone,show_zalo=excluded.show_zalo,show_facebook=excluded.show_facebook,usual_play_times=excluded.usual_play_times,updated_at=now();
end $$;
notify pgrst,'reload schema';
