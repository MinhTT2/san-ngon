-- Private product feedback; only RPCs may create or process requests.
create table public.feedback (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check(category in ('bug','idea','support')),
  title text not null check(char_length(title) between 5 and 120),
  message text not null check(char_length(message) between 20 and 3000),
  page_path text check(page_path is null or (char_length(page_path)<=300 and page_path ~ '^/' and page_path !~ '^//' and page_path !~ '[\\?#[:cntrl:]]')),
  status text not null default 'new' check(status in ('new','reviewing','resolved','closed')),
  reply text not null default '' check(char_length(reply)<=2000),
  handled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feedback_user_created on public.feedback(user_id,created_at desc);
create index feedback_status_created on public.feedback(status,created_at desc);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon,authenticated;
grant select on public.feedback to authenticated;
create policy feedback_read on public.feedback for select to authenticated
  using(public.account_active() and (user_id=auth.uid() or public.is_admin()));

create function public.submit_feedback(p_id uuid,p_category text,p_title text,p_message text,p_page_path text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare existing public.feedback; v_title text:=btrim(p_title); v_message text:=btrim(p_message); v_path text:=nullif(p_page_path,'');
begin
  perform 1 from public.profiles where id=auth.uid() for update;
  if not public.account_active() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_id is null or p_category is null or p_category not in ('bug','idea','support')
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
  if (select count(*) from public.feedback where user_id=auth.uid() and created_at>now()-interval '24 hours')>=5
    or (select count(*) from public.feedback where user_id=auth.uid() and status in ('new','reviewing'))>=10
  then raise exception 'FEEDBACK_LIMIT' using errcode='22023'; end if;
  insert into public.feedback(id,user_id,category,title,message,page_path)
    values(p_id,auth.uid(),p_category,v_title,v_message,v_path);
  return p_id;
end $$;

create function public.review_feedback(p_id uuid,p_status text,p_reply text,p_updated_at timestamptz)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.feedback; v_reply text:=btrim(coalesce(p_reply,''));
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_status is null or p_status not in ('new','reviewing','resolved','closed') or char_length(v_reply)>2000
    or (p_status in ('resolved','closed') and char_length(v_reply)<5)
  then raise exception 'INVALID_FEEDBACK' using errcode='22023'; end if;
  select * into f from public.feedback where id=p_id for update;
  if not found then raise exception 'FEEDBACK_NOT_FOUND' using errcode='22023'; end if;
  if f.updated_at is distinct from p_updated_at then raise exception 'FEEDBACK_STALE' using errcode='22023'; end if;
  update public.feedback set status=p_status,reply=v_reply,handled_by=auth.uid(),updated_at=clock_timestamp() where id=p_id;
end $$;
revoke all on function public.submit_feedback(uuid,text,text,text,text),public.review_feedback(uuid,text,text,timestamptz) from public,anon;
grant execute on function public.submit_feedback(uuid,text,text,text,text),public.review_feedback(uuid,text,text,timestamptz) to authenticated;
