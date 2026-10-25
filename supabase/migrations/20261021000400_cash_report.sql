begin;
-- Recognized website receipts only. This is not a bank statement or revenue report.
create function public.get_cash_report(p_from date default null,p_to date default null,p_page int default 1,p_export boolean default false)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare f date:=coalesce(p_from,(now() at time zone 'Asia/Ho_Chi_Minh')::date-29);
 t date:=coalesce(p_to,(now() at time zone 'Asia/Ho_Chi_Minh')::date);answer jsonb;
begin
 if not public.account_active() or not (public.is_admin() or exists(select 1 from public.profiles where id=auth.uid() and role='owner')) then
  raise exception 'FORBIDDEN' using errcode='42501';end if;
 if t<f or t-f>92 or not isfinite(f) or not isfinite(t) then raise exception 'INVALID_DATE_RANGE' using errcode='22023';end if;
 with receipts as materialized (
  select 'in:'||i.id id,i.created_at occurred_at,i.source,array_to_string(i.ref_codes,' / ') code,
   i.bank_tx_id reference,i.amount::bigint received,0::bigint refunded,i.needs_review
  from public.incoming_transfers i where (i.receiver_owner_id=auth.uid() or public.is_admin())
   and i.expected_amount is not null and i.source in ('booking','tournament','subscription')
   and i.created_at >= (f::timestamp at time zone 'Asia/Ho_Chi_Minh')
   and i.created_at < ((t+1)::timestamp at time zone 'Asia/Ho_Chi_Minh')
 ), refunds as materialized (
  select 'out:'||r.id id,r.transferred_at occurred_at,'booking'::text source,b.code,r.reference,
   0::bigint received,r.amount refunded,false needs_review
  from public.booking_refunds r join public.bookings b on b.id=r.booking_id
  where (r.receiver_owner_id=auth.uid() or public.is_admin())
   and r.transferred_at >= (f::timestamp at time zone 'Asia/Ho_Chi_Minh')
   and r.transferred_at < ((t+1)::timestamp at time zone 'Asia/Ho_Chi_Minh')
 ), movements as materialized(select * from receipts union all select * from refunds),
 scoped_bookings as materialized (
  select b.id,b.refund_status,b.deposit_amount,exists(select 1 from public.booking_refund_legacy l where l.booking_id=b.id) legacy
  from public.bookings b join public.courts c on c.id=b.court_id join public.venues v on v.id=c.venue_id
  where (coalesce(b.payment_owner_id,v.owner_id)=auth.uid() or public.is_admin()) and b.refund_status in ('needed','done')
 ), balances as (
  select b.*,greatest(
   greatest(coalesce((select sum(e.amount::bigint) from public.sepay_events e where e.booking_id=b.id),0),
    coalesce((select max(least(p.amount,b.deposit_amount)) from public.payments p where p.booking_id=b.id and p.status='paid' and p.provider<>'simulation'),0))
   -coalesce((select sum(r.amount) from public.booking_refunds r where r.booking_id=b.id),0)
   -coalesce((select r.amount from public.booking_refund_retained r where r.booking_id=b.id),0),0) remaining
  from scoped_bookings b
 ), limits as(select count(*) total,greatest(1,ceil(count(*)/30.0)::int) pages,
  least(greatest(1,coalesce(p_page,1)),greatest(1,ceil(count(*)/30.0)::int)) page from movements),
 paged as(select * from movements order by occurred_at desc,id desc limit(case when p_export then 5000 else 30 end)
  offset(case when p_export then 0 else (select (page-1)*30 from limits) end))
 select jsonb_build_object('from',f,'to',t,'checked_at',now(),'total',l.total,'page',l.page,'pages',l.pages,
  'received',coalesce((select sum(received) from movements),0),'refunded',coalesce((select sum(refunded) from movements),0),
  'review_count',(select count(*) from receipts where needs_review),
  'booking_refund_due_now',coalesce((select sum(remaining) from balances where not legacy and refund_status='needed'),0),
  'legacy_refund_count',(select count(*) from balances where legacy),
  'sources',(select jsonb_agg(jsonb_build_object('source',s.source,'received',coalesce((select sum(r.received) from receipts r where r.source=s.source),0))) from (values('booking'),('tournament'),('subscription')) s(source)),
  'rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.occurred_at desc,p.id desc) from paged p),'[]'::jsonb))
 into answer from limits l;
 if p_export and (answer->>'total')::int>5000 then raise exception 'EXPORT_TOO_LARGE' using errcode='22023';end if;
 return answer;
end $$;
revoke all on function public.get_cash_report(date,date,int,boolean) from public,anon;
grant execute on function public.get_cash_report(date,date,int,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
