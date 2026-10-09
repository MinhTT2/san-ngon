begin;
-- A bounded private history query; expired holds do not depend on cron cleanup.
create function public.search_my_bookings(
 p_query text default null, p_filter text default 'active', p_page int default 1,
 p_from date default null, p_to date default null
) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
 v_query text := lower(public.unaccent_vi(trim(coalesce(p_query,''))));
 v_result jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.account_active() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if char_length(v_query)>100 then raise exception 'QUERY_TOO_LONG'; end if;
 if p_filter is null or p_filter not in ('active','pending','confirmed','history','all') then raise exception 'INVALID_STATUS'; end if;
 if p_from is not null and p_to is not null and p_from>p_to then raise exception 'INVALID_DATE_RANGE'; end if;
 with matching as materialized (
  select b.id,b.code,b.starts_at,b.ends_at,b.status,b.total_amount,b.deposit_amount,
   b.expires_at,b.paid_at,b.refund_status,
   (b.status='pending' and b.expires_at>now()) as pending,
   (b.status='confirmed' and b.ends_at>now()) as confirmed,
   jsonb_build_object('name',c.name,'sport',c.sport,'venues',jsonb_build_object(
    'name',v.name,'district',v.district,'slug',v.slug,'status',v.status)) as courts
  from public.bookings b join public.courts c on c.id=b.court_id join public.venues v on v.id=c.venue_id
  where b.user_id=auth.uid()
   and (p_from is null or b.starts_at>=(p_from::timestamp at time zone 'Asia/Ho_Chi_Minh'))
   and (p_to is null or b.starts_at<((p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh'))
   and not exists (
    select 1 from regexp_split_to_table(v_query,'[[:space:]]+') word
    where word<>'' and strpos(lower(public.unaccent_vi(concat_ws(' ',b.code,c.name,v.name,v.district,
     case c.sport when 'badminton' then 'Cầu lông' when 'pickleball' then 'Pickleball' else 'Bóng đá' end))),word)=0
   )
 ), counts as (
  select count(*) as total,count(*) filter(where pending) as pending,count(*) filter(where confirmed) as confirmed,
   count(*) filter(where not pending and not confirmed) as history from matching
 ), filtered as materialized (
  select * from matching where p_filter='all' or (p_filter='active' and (pending or confirmed))
   or (p_filter='pending' and pending) or (p_filter='confirmed' and confirmed)
   or (p_filter='history' and not pending and not confirmed)
 ), limits as (
  select count(*) as matched,greatest(1,ceil(count(*)/30.0)::int) as pages,
   least(greatest(1,coalesce(p_page,1)),greatest(1,ceil(count(*)/30.0)::int)) as page from filtered
 ), paged as (
  select * from filtered order by (pending or confirmed) desc,pending desc,
   case when pending or confirmed then starts_at end asc,
   case when not pending and not confirmed then starts_at end desc,id desc
  limit 30 offset (select (page-1)*30 from limits)
 )
 select jsonb_build_object('total',c.total,'pending',c.pending,'confirmed',c.confirmed,'history',c.history,
  'matched',l.matched,'page',l.page,'pages',l.pages,'page_size',30,'now_ms',floor(extract(epoch from now())*1000),
  'rows',coalesce((select jsonb_agg(to_jsonb(p)-'pending'-'confirmed' order by (p.pending or p.confirmed) desc,p.pending desc,
   case when p.pending or p.confirmed then p.starts_at end asc,
   case when not p.pending and not p.confirmed then p.starts_at end desc,p.id desc) from paged p),'[]'::jsonb))
 into v_result from counts c cross join limits l;
 return v_result;
end $$;
revoke all on function public.search_my_bookings(text,text,int,date,date) from public,anon;
grant execute on function public.search_my_bookings(text,text,int,date,date) to authenticated;
notify pgrst,'reload schema';
commit;
