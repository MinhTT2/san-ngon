begin;
create function public.get_booking_conversion(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare first_day date;last_day date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;answer jsonb;
begin
 if not public.account_active() or not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_days is null or p_days not in (7,30,90) then raise exception 'INVALID_DATE_RANGE' using errcode='22023';end if;
 first_day:=last_day-p_days+1;
 with cohort as materialized (
  select b.id,(b.created_at at time zone 'Asia/Ho_Chi_Minh')::date created_day,
   b.paid_at is not null and exists(select 1 from public.payments p where p.booking_id=b.id and p.status='paid' and p.provider<>'simulation') paid,
   b.status='pending' and b.expires_at>now() holding
  from public.bookings b where b.created_at >= (first_day::timestamp at time zone 'Asia/Ho_Chi_Minh')
   and b.created_at < ((last_day+1)::timestamp at time zone 'Asia/Ho_Chi_Minh')
 ), totals as(select count(*) created,count(*) filter(where paid) paid,
  count(*) filter(where not paid and holding) holding,count(*) filter(where not paid and not holding) ended from cohort)
 select jsonb_build_object('from',first_day,'to',last_day,'checked_at',now(),'created',s.created,'paid',s.paid,'holding',s.holding,'ended',s.ended,
  'conversion_pct',round(100.0*s.paid/nullif(s.created,0),1),
  'daily',coalesce((select jsonb_agg(jsonb_build_object('date',d.day::date,'created',(select count(*) from cohort c where c.created_day=d.day::date),
   'paid',(select count(*) from cohort c where c.created_day=d.day::date and c.paid)) order by d.day)
   from generate_series(first_day::timestamp,last_day::timestamp,interval '1 day')d(day)),'[]'::jsonb)) into answer from totals s;
 return answer;
end $$;
revoke all on function public.get_booking_conversion(int) from public,anon;
grant execute on function public.get_booking_conversion(int) to authenticated;
notify pgrst,'reload schema';
commit;
