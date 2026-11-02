begin;

create function public.export_admin_bookings(
  p_filter text default 'upcoming', p_query text default null,
  p_from date default null, p_to date default null
) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_query text := lower(public.unaccent_vi(trim(coalesce(p_query,''))));
  v_phone text;
  v_count int;
  v_rows jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.account_active() or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if p_filter is null or p_filter not in ('upcoming','pending','refund','history','all') then raise exception 'INVALID_FILTER'; end if;
  if char_length(coalesce(p_query,'')) > 100 then raise exception 'QUERY_TOO_LONG'; end if;
  if p_from is not null and p_to is not null and p_from > p_to then raise exception 'INVALID_DATE_RANGE' using errcode='22023'; end if;
  v_phone := regexp_replace(v_query,'[[:space:]()-]','','g');

  with matches as materialized (
    select b.id,b.code,b.starts_at,b.ends_at,b.created_at,b.paid_at,b.status,b.total_amount,b.deposit_amount,b.refund_status,
      b.customer_name,b.customer_phone,b.note,coalesce(b.court_name_snapshot,c.name) as court_name,
      coalesce(b.venue_name_snapshot,v.name) as venue_name,owner.full_name as owner_name,owner.phone as owner_phone,
      (b.status='pending' and b.expires_at>now()) as is_pending,
      (b.status='confirmed' and b.ends_at>now()) as is_upcoming
    from public.bookings b join public.courts c on c.id=b.court_id join public.venues v on v.id=c.venue_id
      left join public.profiles owner on owner.id=coalesce(b.payment_owner_id,v.owner_id)
    where (p_from is null or b.starts_at >= (p_from::timestamp at time zone 'Asia/Ho_Chi_Minh'))
      and (p_to is null or b.starts_at < ((p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh'))
      and (v_query='' or strpos(lower(public.unaccent_vi(concat_ws(' ',b.code,b.customer_name,
        coalesce(b.court_name_snapshot,c.name),coalesce(b.venue_name_snapshot,v.name)))),v_query)>0
        or (v_phone ~ '^[0-9]+$' and strpos(b.customer_phone,v_phone)>0))
  ), filtered as materialized (
    select * from matches where p_filter='all' or (p_filter='upcoming' and is_upcoming)
      or (p_filter='pending' and is_pending) or (p_filter='refund' and refund_status='needed')
      or (p_filter='history' and not is_pending and not is_upcoming)
  )
  select count(*) into v_count from filtered;
  if v_count > 10000 then raise exception 'EXPORT_TOO_LARGE' using errcode='22023'; end if;
  with matches as materialized (
    select b.id,b.code,b.starts_at,b.ends_at,b.created_at,b.paid_at,b.status,b.total_amount,b.deposit_amount,b.refund_status,
      b.customer_name,b.customer_phone,b.note,coalesce(b.court_name_snapshot,c.name) as court_name,
      coalesce(b.venue_name_snapshot,v.name) as venue_name,owner.full_name as owner_name,owner.phone as owner_phone,
      (b.status='pending' and b.expires_at>now()) as is_pending,
      (b.status='confirmed' and b.ends_at>now()) as is_upcoming
    from public.bookings b join public.courts c on c.id=b.court_id join public.venues v on v.id=c.venue_id
      left join public.profiles owner on owner.id=coalesce(b.payment_owner_id,v.owner_id)
    where (p_from is null or b.starts_at >= (p_from::timestamp at time zone 'Asia/Ho_Chi_Minh'))
      and (p_to is null or b.starts_at < ((p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh'))
      and (v_query='' or strpos(lower(public.unaccent_vi(concat_ws(' ',b.code,b.customer_name,
        coalesce(b.court_name_snapshot,c.name),coalesce(b.venue_name_snapshot,v.name)))),v_query)>0
        or (v_phone ~ '^[0-9]+$' and strpos(b.customer_phone,v_phone)>0))
  ), filtered as materialized (
    select * from matches where p_filter='all' or (p_filter='upcoming' and is_upcoming)
      or (p_filter='pending' and is_pending) or (p_filter='refund' and refund_status='needed')
      or (p_filter='history' and not is_pending and not is_upcoming)
  )
  select coalesce(jsonb_agg(to_jsonb(r) order by r.starts_at,r.code),'[]'::jsonb) into v_rows from filtered r;
  return jsonb_build_object('rows',v_rows,'total',v_count);
end $$;

revoke all on function public.export_admin_bookings(text,text,date,date) from public,anon;
grant execute on function public.export_admin_bookings(text,text,date,date) to authenticated;
notify pgrst,'reload schema';
commit;
