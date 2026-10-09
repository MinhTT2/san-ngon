begin;
create function public.get_owner_reconciliation_export(p_venue_id uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_rows jsonb; v_count int;
begin
 if not public.account_active() or not exists(select 1 from public.venues where id=p_venue_id and owner_id=auth.uid()) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'INVALID_DATE_RANGE' using errcode='22023'; end if;
 select count(*) into v_count from public.bookings b join public.courts c on c.id=b.court_id
 where c.venue_id=p_venue_id and b.starts_at>=p_from::timestamp at time zone 'Asia/Ho_Chi_Minh'
 and b.starts_at<(p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh';
 if v_count>10000 then raise exception 'EXPORT_TOO_LARGE' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.starts_at,r.code),'[]'::jsonb) into v_rows from (
 select b.code,c.name as court_name,b.customer_name,b.customer_phone,b.starts_at,b.ends_at,b.status,b.total_amount,b.deposit_amount,b.paid_at,b.refund_status
 from public.bookings b join public.courts c on c.id=b.court_id
 where c.venue_id=p_venue_id and b.starts_at>=p_from::timestamp at time zone 'Asia/Ho_Chi_Minh'
 and b.starts_at<(p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh') r;
 return jsonb_build_object('rows',v_rows,'total',v_count);
end $$;
revoke all on function public.get_owner_reconciliation_export(uuid,date,date) from public,anon;
grant execute on function public.get_owner_reconciliation_export(uuid,date,date) to authenticated;
notify pgrst,'reload schema';
commit;
