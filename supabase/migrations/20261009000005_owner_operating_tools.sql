begin;
create function public.get_owner_operating_calendar(p_venue_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_day date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if not public.account_active() or not exists(select 1 from public.venues where id=p_venue_id and owner_id=auth.uid()) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return jsonb_build_object('today',v_day,'from',v_day::timestamp at time zone 'Asia/Ho_Chi_Minh','until',(v_day+7)::timestamp at time zone 'Asia/Ho_Chi_Minh',
    'days',(select jsonb_agg(v_day+i order by i) from generate_series(0,6) i));
end $$;

create function public.get_owner_refund_page(p_venue_id uuid,p_status text default 'needed',p_query text default '',p_page int default 1)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_query text := lower(trim(coalesce(p_query,''))); v_result jsonb;
begin
  if not public.account_active() or not exists(select 1 from public.venues where id=p_venue_id and owner_id=auth.uid()) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_status is null or p_status not in ('all','needed','done') or length(v_query)>100 then raise exception 'INVALID_FILTER'; end if;
  with source as materialized (
    select b.id,b.code,b.starts_at,b.ends_at,b.deposit_amount,b.customer_name,b.customer_phone,b.refund_status,c.name as court_name
    from public.bookings b join public.courts c on c.id=b.court_id where c.venue_id=p_venue_id
      and b.refund_status in ('needed','done')
      and (v_query='' or strpos(lower(b.code||' '||coalesce(b.customer_name,'')||' '||b.customer_phone),v_query)>0)
  ), filtered as materialized (select * from source where p_status='all' or refund_status::text=p_status),
  totals as (select count(*)::int total,greatest(1,ceil(count(*)/30.0)::int) pages from filtered),
  paging as (select *,greatest(1,least(coalesce(p_page,1),pages)) page from totals),
  rows as (select f.* from filtered f order by starts_at desc,id desc limit 30 offset (select (page-1)*30 from paging))
  select jsonb_build_object('total',p.total,'page',p.page,'pages',p.pages,'needed',(select count(*) from source where refund_status='needed'),
    'done',(select count(*) from source where refund_status='done'),'rows',coalesce((select jsonb_agg(to_jsonb(r) order by starts_at desc,id desc) from rows r),'[]'::jsonb)) into v_result from paging p;
  return v_result;
end $$;
revoke all on function public.get_owner_operating_calendar(uuid),public.get_owner_refund_page(uuid,text,text,int) from public,anon;
grant execute on function public.get_owner_operating_calendar(uuid),public.get_owner_refund_page(uuid,text,text,int) to authenticated;
notify pgrst,'reload schema';
commit;
