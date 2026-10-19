begin;

-- Admin's work queues are calculated over all matches, before pagination.
create function public.search_admin_bookings(
  p_filter text default 'upcoming', p_query text default null,
  p_from date default null, p_to date default null, p_page int default 1
) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_query text := lower(public.unaccent_vi(trim(coalesce(p_query,''))));
  v_phone text;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.account_active() or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if p_filter is null or p_filter not in ('upcoming','pending','refund','history','all') then raise exception 'INVALID_FILTER'; end if;
  if char_length(coalesce(p_query,''))>100 then raise exception 'QUERY_TOO_LONG'; end if;
  if p_from is not null and p_to is not null and p_from>p_to then raise exception 'INVALID_DATE_RANGE'; end if;
  v_phone := regexp_replace(v_query,'[[:space:]()-]','','g');
  if v_phone ~ '^\+84[0-9]+$' then v_phone := '0'||substr(v_phone,4); end if;

  with matches as materialized (
    select b.id,b.code,b.starts_at,b.ends_at,b.created_at,b.expires_at,b.cancelled_at,b.paid_at,
      b.status,b.total_amount,b.deposit_amount,b.refund_status,b.customer_name,b.customer_phone,b.note,
      coalesce(b.court_name_snapshot,c.name) as court_name,
      coalesce(b.venue_name_snapshot,v.name) as venue_name,
      coalesce(b.payment_owner_id,v.owner_id) as owner_id,
      owner.full_name as owner_name,owner.phone as owner_phone,
      (b.status='pending' and b.expires_at>now()) as is_pending,
      (b.status='confirmed' and b.ends_at>now()) as is_upcoming,
      (b.status='pending' and b.expires_at<=now()) as hold_expired,
      (b.status='confirmed' and b.starts_at<=now() and b.ends_at>now()) as is_playing
    from public.bookings b join public.courts c on c.id=b.court_id
      join public.venues v on v.id=c.venue_id
      left join public.profiles owner on owner.id=coalesce(b.payment_owner_id,v.owner_id)
    where (p_from is null or b.starts_at >= (p_from::timestamp at time zone 'Asia/Ho_Chi_Minh'))
      and (p_to is null or b.starts_at < ((p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh'))
      and (v_query='' or strpos(lower(public.unaccent_vi(concat_ws(' ',b.code,b.customer_name,
        coalesce(b.court_name_snapshot,c.name),coalesce(b.venue_name_snapshot,v.name)))),v_query)>0
        or (v_phone ~ '^[0-9]+$' and strpos(b.customer_phone,v_phone)>0))
  ), filtered as materialized (
    select * from matches where p_filter='all'
      or (p_filter='upcoming' and is_upcoming)
      or (p_filter='pending' and is_pending)
      or (p_filter='refund' and refund_status='needed')
      or (p_filter='history' and not is_pending and not is_upcoming)
  ), counts as (
    select count(*) as total,count(*) filter(where is_upcoming) as upcoming,
      count(*) filter(where is_pending) as pending,
      count(*) filter(where refund_status='needed') as refund,
      count(*) filter(where not is_pending and not is_upcoming) as history from matches
  ), limits as (
    select count(*) as matched,greatest(1,ceil(count(*)/30.0)::int) as pages,
      least(greatest(1,coalesce(p_page,1)),greatest(1,ceil(count(*)/30.0)::int)) as page from filtered
  ), paged as (
    select * from filtered order by
      case when p_filter='pending' then expires_at end asc,
      case when p_filter='upcoming' then starts_at end asc,
      case when p_filter='refund' then cancelled_at end asc nulls last,
      case when p_filter='all' then (is_upcoming or is_pending or refund_status='needed') end desc nulls last,
      created_at desc,id desc limit 30 offset (select (page-1)*30 from limits)
  )
  select jsonb_build_object('total',c.total,'upcoming',c.upcoming,'pending',c.pending,'refund',c.refund,'history',c.history,
    'matched',l.matched,'page',l.page,'pages',l.pages,'page_size',30,
    'rows',coalesce((select jsonb_agg(to_jsonb(p)) from paged p),'[]'::jsonb)) into v_result from counts c cross join limits l;
  return v_result;
end $$;
revoke all on function public.search_admin_bookings(text,text,date,date,int) from public,anon;
grant execute on function public.search_admin_bookings(text,text,date,date,int) to authenticated;
notify pgrst,'reload schema';
commit;
