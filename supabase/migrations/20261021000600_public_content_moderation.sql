begin;
alter table public.feedback drop constraint feedback_category_check;
alter table public.feedback add constraint feedback_category_check check(category in ('bug','idea','support','report'));
alter table public.community_profiles add column moderation_hidden boolean not null default false;
alter table public.tournaments add column moderation_hidden boolean not null default false;
create table public.content_moderation (
 kind text not null check(kind in ('community','tournament')),content_id uuid not null,
 hidden boolean not null,reason text not null check(length(reason) between 10 and 1000),
 actor_id uuid not null references public.profiles(id),updated_at timestamptz not null default clock_timestamp(),
 primary key(kind,content_id)
);
alter table public.content_moderation enable row level security;
revoke all on public.content_moderation from public,anon,authenticated;
create or replace function public.submit_feedback(p_id uuid,p_category text,p_title text,p_message text,p_page_path text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare existing public.feedback; v_title text:=btrim(p_title); v_message text:=btrim(p_message); v_path text:=nullif(p_page_path,'');
begin
  perform 1 from public.profiles where id=auth.uid() for update;
  if not public.account_active() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_id is null or p_category is null or p_category not in ('bug','idea','support','report')
    or v_title is null or char_length(v_title) not between 5 and 120
    or v_message is null or char_length(v_message) not between 20 and 3000
    or (v_path is not null and (char_length(v_path)>300 or v_path !~ '^/' or v_path ~ '^//' or v_path ~ '[\\?#[:cntrl:]]'))
  then raise exception 'INVALID_FEEDBACK' using errcode='22023'; end if;
  select * into existing from public.feedback where id=p_id;
  if found then
    if existing.user_id=auth.uid() and existing.category=p_category and existing.title=v_title and existing.message=v_message and existing.page_path is not distinct from v_path then
      return existing.id;
    end if;
    raise exception 'FEEDBACK_CONFLICT' using errcode='22023';
  end if;
  if p_category='report' and (v_path is null or v_path !~ '^/(ket-noi|giai-dau)/[a-fA-F0-9-]{36}$') then raise exception 'INVALID_FEEDBACK' using errcode='22023';end if;
  if (select count(*) from public.feedback where user_id=auth.uid() and created_at>now()-interval '24 hours')>=5
    or (select count(*) from public.feedback where user_id=auth.uid() and status in ('new','reviewing'))>=10
  then raise exception 'FEEDBACK_LIMIT' using errcode='22023'; end if;
  insert into public.feedback(id,user_id,category,title,message,page_path)
    values(p_id,auth.uid(),p_category,v_title,v_message,v_path);
  return p_id;
end $$;

create or replace function public.search_community(p_sport text default '',p_location text default '',p_page int default 1)
returns jsonb language sql stable security definer set search_path=public as $$
  with visible as (
    select c.*,p.avatar_url from community_profiles c join profiles p on p.id=c.user_id
    where c.is_public and not c.moderation_hidden and (p.banned_until is null or p.banned_until<=now())
      and (p_sport='' or c.sport::text=p_sport) and (p_location='' or position(lower(left(p_location,200)) in lower(c.location))>0)
  ) select jsonb_build_object('total',(select count(*) from visible),'rows',coalesce((select jsonb_agg(to_jsonb(x)) from (
    select user_id,display_name,location,sport,skill_level,avatar_url from visible order by updated_at desc,user_id limit 24 offset (greatest(1,least(coalesce(p_page,1),10000))-1)*24
  ) x),'[]'::jsonb));
$$;
create or replace function public.get_community_profile(p_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select to_jsonb(c)||jsonb_build_object('avatar_url',p.avatar_url,
   'phone',case when c.user_id=auth.uid() or c.show_phone then c.phone else '' end,
   'zalo_phone',case when c.user_id=auth.uid() or c.show_zalo then c.zalo_phone else '' end,
   'facebook_url',case when c.user_id=auth.uid() or c.show_facebook then c.facebook_url else '' end)
 from community_profiles c join profiles p on p.id=c.user_id
 where c.user_id=p_id and (c.user_id=auth.uid() or (c.is_public and not c.moderation_hidden and (p.banned_until is null or p.banned_until<=now())));
$$;

create or replace function public.get_tournament_capacity(p_id uuid)
returns int language sql stable security definer set search_path=public as $$
 select count(*)::int from tournament_registrations r join tournaments t on t.id=r.tournament_id
 where t.id=p_id and r.status='approved' and (r.paid_at is not null or r.deposit_amount=0 or r.payment_expires_at>now())
 and ((t.status in ('published','completed') and not t.moderation_hidden) or manages_tournament(p_id));
$$;

drop policy tournament_read on public.tournaments;
create policy tournament_read on public.tournaments for select using(
 (status in ('published','completed') and not moderation_hidden) or manager_id=auth.uid() or manages_tournament(id) or is_admin());
-- Keep existing participants and all financial processing reachable; block new commitments.
create function public.guard_moderated_registration() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' or (tg_op='UPDATE' and new.status='approved' and old.status is distinct from new.status) then
  perform 1 from public.tournaments where id=new.tournament_id and moderation_hidden for update;
  if found then raise exception 'CONTENT_HIDDEN' using errcode='22023';end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_moderated_registration() from public,anon,authenticated;
create trigger guard_moderated_registration before insert or update on public.tournament_registrations for each row execute function public.guard_moderated_registration();
create function public.get_content_moderation(p_kind text,p_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare title text;hidden boolean;state public.content_moderation;
begin
 if not public.account_active() or not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_kind='community' then select display_name,moderation_hidden into title,hidden from public.community_profiles where user_id=p_id;
 elsif p_kind='tournament' then select t.title,t.moderation_hidden into title,hidden from public.tournaments t where id=p_id;
 else raise exception 'INVALID_CONTENT' using errcode='22023';end if;
 if title is null then return null;end if;
 select * into state from public.content_moderation where kind=p_kind and content_id=p_id;
 return jsonb_build_object('kind',p_kind,'id',p_id,'title',title,'hidden',hidden,'reason',state.reason,'updated_at',state.updated_at);
end $$;
create function public.set_content_moderation(p_kind text,p_id uuid,p_hidden boolean,p_reason text,p_updated_at timestamptz default null)
returns void language plpgsql security definer set search_path=public as $$
declare subject uuid;hidden boolean;state public.content_moderation;why text:=btrim(p_reason);
begin
 if not public.account_active() or not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_hidden is null or why is null or length(why) not between 10 and 1000 then raise exception 'INVALID_CONTENT' using errcode='22023';end if;
 if p_kind='community' then select user_id,moderation_hidden into subject,hidden from public.community_profiles where user_id=p_id for update;
 elsif p_kind='tournament' then select manager_id,moderation_hidden into subject,hidden from public.tournaments where id=p_id for update;
 else raise exception 'INVALID_CONTENT' using errcode='22023';end if;
 if subject is null then raise exception 'CONTENT_NOT_FOUND' using errcode='22023';end if;
 select * into state from public.content_moderation where kind=p_kind and content_id=p_id;
 if state.updated_at is distinct from p_updated_at then raise exception 'CONTENT_CHANGED' using errcode='22023';end if;
 if hidden=p_hidden then return;end if;
 insert into public.content_moderation(kind,content_id,hidden,reason,actor_id) values(p_kind,p_id,p_hidden,why,auth.uid())
  on conflict(kind,content_id) do update set hidden=excluded.hidden,reason=excluded.reason,actor_id=excluded.actor_id,updated_at=clock_timestamp();
 if p_kind='community' then update public.community_profiles set moderation_hidden=p_hidden where user_id=p_id;
 else update public.tournaments set moderation_hidden=p_hidden where id=p_id;end if;
 insert into public.operations_audit(actor_id,action,entity_id,details) values(auth.uid(),case when p_hidden then 'content.hidden' else 'content.restored' end,p_id,jsonb_build_object('kind',p_kind));
 insert into public.notifications(user_id,kind,channel,title,body) values(subject,'new_booking','app',
  case when p_hidden then 'Nội dung của bạn tạm ẩn công khai' else 'Đã khôi phục nội dung công khai' end,
  why||'. Xem hồ sơ/giải của bạn và liên hệ hỗ trợ nếu cần. Ẩn nội dung không hủy đăng ký hoặc nghĩa vụ thanh toán/hoàn tiền.');
end $$;
revoke all on function public.get_content_moderation(text,uuid),public.set_content_moderation(text,uuid,boolean,text,timestamptz) from public,anon;
grant execute on function public.get_content_moderation(text,uuid),public.set_content_moderation(text,uuid,boolean,text,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
