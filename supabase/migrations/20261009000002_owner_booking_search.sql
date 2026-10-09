begin;
create function public.search_owner_bookings(
  p_venue_id uuid, p_query text default null, p_status text default 'all',
  p_from date default null, p_to date default null, p_page int default 1,
  p_show_history boolean default false, p_refund_needed boolean default false
) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_query text := lower(trim(coalesce(p_query,'')));
  v_phone text;
  v_from date := p_from; v_to date := p_to; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.account_active() or not exists(select 1 from public.venues where id=p_venue_id and (owner_id=auth.uid() or public.is_admin())) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if char_length(v_query)>100 then raise exception 'QUERY_TOO_LONG'; end if;
  if p_status is null or p_status not in ('all','pending','confirmed','completed','cancelled','no_show') then raise exception 'INVALID_STATUS'; end if;
  if v_from is not null and v_to is not null and v_from>v_to then raise exception 'INVALID_DATE_RANGE'; end if;
  -- A code/contact search includes old orders unless the user chose date bounds.
  if not coalesce(p_show_history,false) and not coalesce(p_refund_needed,false) and v_query='' and v_from is null and v_to is null then
    v_from := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
    v_to := v_from+30;
  end if;
  v_phone := regexp_replace(v_query,'[[:space:]()-]','','g');
  if v_phone ~ '^\+84[0-9]+$' then v_phone := '0'||substr(v_phone,4); end if;

  with filtered as materialized (
    select b.id,b.code,b.starts_at,b.ends_at,b.status,b.total_amount,b.deposit_amount,
      b.refund_status,b.customer_name,b.customer_phone,c.name as "courtName"
    from public.bookings b join public.courts c on c.id=b.court_id
    where c.venue_id=p_venue_id and (not coalesce(p_refund_needed,false) or b.refund_status='needed') and (p_status='all' or b.status::text=p_status)
      and (v_from is null or b.starts_at >= (v_from::timestamp at time zone 'Asia/Ho_Chi_Minh'))
      and (v_to is null or b.starts_at < ((v_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh'))
      and (v_query='' or strpos(lower(b.code),v_query)>0 or strpos(lower(coalesce(b.customer_name,'')),v_query)>0
        or (v_phone ~ '^[0-9]+$' and strpos(b.customer_phone,v_phone)>0))
  ), counts as (
    select count(*) as total,count(*) filter(where status in ('confirmed','completed')) as confirmed,
      count(*) filter(where status='pending') as pending from filtered
  ), limits as (
    select *,greatest(1,ceil(total/30.0)::int) as pages,
      least(greatest(1,coalesce(p_page,1)),greatest(1,ceil(total/30.0)::int)) as page from counts
  ), paged as (
    select * from filtered order by starts_at desc,id desc limit 30 offset (select (page-1)*30 from limits)
  )
  select jsonb_build_object('from',v_from,'to',v_to,'total',l.total,'confirmed',l.confirmed,'pending',l.pending,
    'page',l.page,'pages',l.pages,'page_size',30,'rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.starts_at desc,p.id desc) from paged p),'[]'::jsonb))
    into v_result from limits l;
  return v_result;
end $$;
revoke all on function public.search_owner_bookings(uuid,text,text,date,date,int,boolean,boolean) from public,anon;
grant execute on function public.search_owner_bookings(uuid,text,text,date,date,int,boolean,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
