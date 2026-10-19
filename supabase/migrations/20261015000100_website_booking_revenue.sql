-- Revenue is the paid deposit allocated to a website booking, once per booking.
-- Operational counts/hours still use the playing date; money uses the paid date.
create index if not exists payments_booking_paid_idx on public.payments(booking_id) where status='paid';
create index if not exists bookings_paid_stats_idx on public.bookings(paid_at,court_id) where paid_at is not null;
create function public.booking_revenue_entries(p_venue_id uuid, p_from date, p_to date)
returns table(booking_id uuid, court_id uuid, venue_id uuid, paid_date date, amount bigint)
language sql stable security definer set search_path=public as $$
  select b.id, b.court_id, c.venue_id,
    (b.paid_at at time zone 'Asia/Ho_Chi_Minh')::date,
    least(b.total_amount::bigint, b.deposit_amount::bigint, p.amount)
  from bookings b join courts c on c.id=b.court_id
  cross join lateral (
    select coalesce(sum(greatest(amount,0)::bigint),0)::bigint as amount
    from payments where booking_id=b.id and status='paid' and paid_at is not null
  ) p
  where (p_venue_id is null or c.venue_id=p_venue_id)
    and b.paid_at >= (p_from::timestamp at time zone 'Asia/Ho_Chi_Minh')
    and b.paid_at < ((p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh')
    and b.status in ('confirmed','completed','no_show','cancelled')
    and coalesce(b.refund_status::text,'none')='none'
    and p.amount>0 and b.deposit_amount>0;
$$;
revoke all on function public.booking_revenue_entries(uuid,date,date) from public,anon,authenticated;

create function public.website_booking_stats(p_venue_id uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare answer jsonb;
begin
  if not public.account_active() or
    (p_venue_id is null and not public.is_admin()) or
    (p_venue_id is not null and not exists(select 1 from venues where id=p_venue_id and (owner_id=auth.uid() or public.is_admin())))
  then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'INVALID_DATE_RANGE'; end if;

  with scoped_venues as materialized (
    -- Historical revenue survives deactivation of a venue or court.
    select * from venues where p_venue_id is null or id=p_venue_id
  ), operating as materialized (
    select b.*,c.venue_id from bookings b join courts c on c.id=b.court_id join scoped_venues v on v.id=c.venue_id
    where b.starts_at >= (p_from::timestamp at time zone 'Asia/Ho_Chi_Minh')
      and b.starts_at < ((p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh')
  ), receipts as materialized (
    select * from public.booking_revenue_entries(p_venue_id,p_from,p_to)
  ), capacity as (
    select coalesce(sum(extract(epoch from (coalesce(c.close_time,v.close_time)-coalesce(c.open_time,v.open_time)))/3600*(p_to-p_from+1)),0) hours
    from courts c join scoped_venues v on v.id=c.venue_id where c.is_active and v.status='active'
  ), booked as (
    select coalesce(sum(extract(epoch from (ends_at-starts_at))/3600) filter(where status in ('confirmed','completed')),0) hours from operating
  ), court_stats as (
    select c.id,c.name,
      (select count(*) from operating b where b.court_id=c.id and b.status in ('confirmed','completed')) bookings,
      (select coalesce(sum(r.amount),0) from receipts r where r.court_id=c.id) revenue,
      (select round(coalesce(sum(extract(epoch from (b.ends_at-b.starts_at))/3600),0),1) from operating b where b.court_id=c.id and b.status in ('confirmed','completed')) hours
    from courts c join scoped_venues v on v.id=c.venue_id
  ), venue_stats as (
    select v.id,v.name,v.district,
      (select count(*) from receipts r where r.venue_id=v.id) bookings,
      (select coalesce(sum(r.amount),0) from receipts r where r.venue_id=v.id) revenue
    from scoped_venues v
  )
  select jsonb_build_object('from',p_from,'to',p_to,
    'summary',jsonb_build_object(
      'bookings',(select count(*) from operating),
      'paid_bookings',(select count(*) from receipts),
      'revenue',(select coalesce(sum(amount),0) from receipts),
      'deposit',(select coalesce(sum(amount),0) from receipts),
      'cancelled',(select count(*) from operating where status in ('cancelled','no_show')),
      'pending',(select count(*) from bookings b join courts c on c.id=b.court_id join scoped_venues v on v.id=c.venue_id where b.status='pending' and b.expires_at>now()),
      'pending_bookings',(select count(*) from bookings b join courts c on c.id=b.court_id join scoped_venues v on v.id=c.venue_id where b.status='pending' and b.expires_at>now()),
      'capacity_hours',round(cap.hours,1),'booked_hours',round(bk.hours,1),
      'occupancy_pct',case when cap.hours=0 then 0 else round(bk.hours/cap.hours*100,1) end,
      'cancellation_pct',(select case when count(*) filter(where status<>'pending')=0 then 0 else round(count(*) filter(where status in ('cancelled','no_show'))::numeric/count(*) filter(where status<>'pending')*100,1) end from operating),
      'active_venues',(select count(*) from scoped_venues where status='active'),
      'active_courts',(select count(*) from courts c join scoped_venues v on v.id=c.venue_id where c.is_active and v.status='active'),
      'players',(select count(*) from profiles where role='player'),
      'owners',(select count(*) from profiles where role='owner'),
      'new_players',(select count(*) from profiles where role='player' and created_at >= (p_from::timestamp at time zone 'Asia/Ho_Chi_Minh') and created_at < ((p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh')),
      'pending_owners',(select count(*) from profiles where owner_application_status='pending'),
      'pending_venues',(select count(*) from scoped_venues where status='pending')
    ),
    'daily',(select jsonb_agg(jsonb_build_object('date',d.day::date,
      'bookings',(select count(*) from receipts r where r.paid_date=d.day::date),
      'revenue',(select coalesce(sum(r.amount),0) from receipts r where r.paid_date=d.day::date)) order by d.day)
      from generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d(day)),
    'courts',coalesce((select jsonb_agg(to_jsonb(c) order by c.hours desc,c.name,c.id) from court_stats c),'[]'::jsonb),
    'venues',coalesce((select jsonb_agg(to_jsonb(v) order by v.revenue desc,v.name,v.id) from (select * from venue_stats order by revenue desc,name,id limit 8) v),'[]'::jsonb)
  ) into answer from capacity cap cross join booked bk;
  -- Owners receive only the venue report, never platform-wide account counts.
  if p_venue_id is not null then
    answer := (answer-'venues') || jsonb_build_object('summary',(answer->'summary')-
      array['players','owners','new_players','pending_owners','pending_venues','active_venues','active_courts','pending_bookings']);
  end if;
  return answer;
end $$;
revoke all on function public.website_booking_stats(uuid,date,date) from public,anon,authenticated;

create or replace function public.get_owner_stats(p_venue_id uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if p_venue_id is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return public.website_booking_stats(p_venue_id,p_from,p_to);
end $$;
create or replace function public.get_admin_stats(p_from date,p_to date)
returns jsonb language sql stable security definer set search_path=public as $$
  select public.website_booking_stats(null,p_from,p_to);
$$;
create function public.get_admin_period_stats(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if p_days is null or p_days not in (7,30,90) then raise exception 'INVALID_PERIOD'; end if;
  return public.get_admin_stats(today-p_days+1,today);
end $$;
revoke all on function public.get_admin_period_stats(int) from public,anon;
grant execute on function public.get_admin_period_stats(int) to authenticated;

-- Keep unrelated bank receipts privately for idempotency/audit, but do not
-- expose personal transfers in the website ledger, totals, search or notes.
create or replace function public.get_incoming_transfer_page(p_query text default '',p_filter text default 'review',p_page int default 1)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare q text:=upper(trim(coalesce(p_query,'')));answer jsonb;
begin
 if not public.account_active() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if length(q)>100 or p_filter is null or p_filter not in ('all','review','exact') then raise exception 'INVALID_FILTER';end if;
 with scoped as materialized (
  select t.* from public.incoming_transfers t where (t.receiver_owner_id=auth.uid() or public.is_admin())
    and t.source in ('booking','tournament','subscription') and t.expected_amount is not null
 ), matching as materialized (
  select * from scoped where (p_filter='all' or (p_filter='review' and needs_review) or (p_filter='exact' and not needs_review))
  and (q='' or strpos(upper(array_to_string(ref_codes,' ')||' '||bank_tx_id),q)>0)
 ), limits as (
  select count(*) as total,greatest(1,ceil(count(*)/30.0)::int) as pages,
   least(greatest(1,coalesce(p_page,1)),greatest(1,ceil(count(*)/30.0)::int)) as page from matching
 ), paged as (
  select * from matching order by created_at desc,id desc limit 30 offset(select (page-1)*30 from limits)
 )
 select jsonb_build_object('total',l.total,'page',l.page,'pages',l.pages,'review_count',(select count(*) from scoped where needs_review),
  'received_amount',(select coalesce(sum(amount::bigint),0) from scoped),
  'rows',coalesce((select jsonb_agg(jsonb_build_object(
   'id',p.id,'bank',p.bank,'account_number',p.account_number,'bank_tx_id',p.bank_tx_id,'amount',p.amount,'ref_codes',p.ref_codes,
   'booking_id',p.booking_id,'source',p.source,'expected_amount',p.expected_amount,'outcome',p.outcome,'reason',p.reason,
   'needs_review',p.needs_review,'payload_conflicts',p.payload_conflicts,'created_at',p.created_at,'updated_at',p.updated_at,
   'booking_received',case when p.booking_id is not null then (select sum(t.amount::bigint) from scoped t where t.booking_id=p.booking_id) end,
   'notes',coalesce((select jsonb_agg(to_jsonb(n)) from (select note,created_at from public.incoming_transfer_notes where transfer_id=p.id order by created_at desc,id desc limit 5)n),'[]'::jsonb)
  ) order by p.created_at desc,p.id desc) from paged p),'[]'::jsonb)) into answer from limits l;
 return answer;
end $$;

create or replace function public.note_incoming_transfer(p_id uuid,p_note_id uuid,p_note text,p_updated_at timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare t public.incoming_transfers;existing public.incoming_transfer_notes;n text:=trim(coalesce(p_note,''));
begin
 if not public.account_active() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_note_id is null or length(n) not between 10 and 1000 then raise exception 'INVALID_NOTE';end if;
 select * into t from public.incoming_transfers where id=p_id and (receiver_owner_id=auth.uid() or public.is_admin())
   and source in ('booking','tournament','subscription') and expected_amount is not null for update;
 if not found then raise exception 'TRANSFER_NOT_FOUND';end if;
 select * into existing from public.incoming_transfer_notes where id=p_note_id;
 if found then
  if existing.actor_id=auth.uid() and existing.transfer_id=p_id and existing.note=n then return;end if;
  raise exception 'NOTE_CONFLICT';
 end if;
 if t.updated_at is distinct from p_updated_at then raise exception 'TRANSFER_CHANGED';end if;
 insert into public.incoming_transfer_notes(id,transfer_id,actor_id,note) values(p_note_id,p_id,auth.uid(),n);
 update public.incoming_transfers set updated_at=clock_timestamp() where id=p_id;
end $$;

-- Only website-related receipts create reconciliation notifications.
create or replace function public.process_incoming_transfer(
 p_codes text[],p_amount int,p_bank_tx_id text,p_raw jsonb,p_connection_id uuid,p_receiver_bank text,p_receiver_account text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 tx text; codes text[]; entry public.incoming_transfers; receiver uuid; v_code text;
 b public.bookings; invoice public.subscription_invoices; reg public.tournament_registrations;
 v_result jsonb; v_reason text; v_outcome text; v_source text:='unknown'; expected int;
 booking uuid; previous_receipts int:=0; old_confirmed boolean:=false; recorded int;
begin
 if p_amount is null or p_amount<=0 or coalesce(p_bank_tx_id,'') !~ '^[1-9][0-9]{0,49}$'
  or coalesce(trim(p_receiver_bank),'')='' or length(p_receiver_bank)>100
  or coalesce(p_receiver_account,'') !~ '^[0-9]{6,30}$' then
  return jsonb_build_object('ok',false,'reason','INVALID_PAYMENT');
 end if;
 select coalesce(array_agg(distinct upper(trim(c)) order by upper(trim(c))),'{}'::text[]) into codes
 from unnest(coalesce(p_codes,'{}'::text[])) c where nullif(trim(c),'') is not null;
 tx:=lower(trim(p_receiver_bank))||':'||p_receiver_account||':'||p_bank_tx_id;
 if p_connection_id is not null then
  select owner_id into receiver from public.sepay_connections
  where id=p_connection_id and lower(trim(bank))=lower(trim(p_receiver_bank)) and account_number=p_receiver_account;
  if not found then return jsonb_build_object('ok',false,'reason','WRONG_RECEIVER');end if;
 else
  select owner_id into receiver from public.booking_operator
  where lower(trim(bank))=lower(trim(p_receiver_bank)) and account_number=p_receiver_account;
  -- A legacy frozen receiver can outlive the current operator configuration.
  -- Unknown legacy receivers remain visible to admin only, never guessed from a reference.
 end if;
 insert into public.incoming_transfers(transaction_key,connection_id,receiver_owner_id,bank,account_number,bank_tx_id,amount,ref_codes,raw)
 values(tx,p_connection_id,receiver,lower(trim(p_receiver_bank)),p_receiver_account,p_bank_tx_id,p_amount,codes,coalesce(p_raw,'{}'))
 on conflict(transaction_key) do nothing;
 get diagnostics recorded=row_count;
 select * into entry from public.incoming_transfers where transaction_key=tx for update;
 if recorded=0 then
  if entry.amount<>p_amount or entry.ref_codes is distinct from codes or entry.connection_id is distinct from p_connection_id then
   update public.incoming_transfers set payload_conflicts=payload_conflicts+1,needs_review=true,updated_at=clock_timestamp() where id=entry.id;
   return jsonb_build_object('ok',false,'reason','PAYMENT_PAYLOAD_CONFLICT');
  end if;
  -- Returning CONFIRMED on a retry would re-send owner messages.
  return jsonb_build_object('ok',true,'reason','ALREADY_PROCESSED','original_reason',entry.reason);
 end if;
 if cardinality(codes)=0 then
  v_result:=jsonb_build_object('ok',false,'reason','NO_REF_CODE');
 elsif cardinality(codes)>1 then
  v_result:=jsonb_build_object('ok',false,'reason','AMBIGUOUS_REF_CODE');
 else
  v_code:=codes[1];
  if v_code ~ '^SAN[A-HJ-NP-Z2-9]{6}$' then
   v_source:='booking';
   select * into b from public.bookings where bookings.code=v_code for update;
   if found and b.payment_connection_id is not distinct from p_connection_id
     and lower(trim(b.payment_bank))=lower(trim(p_receiver_bank)) and b.payment_account=p_receiver_account then
    booking:=b.id;expected:=b.deposit_amount;receiver:=b.payment_owner_id;
    select count(*) into previous_receipts from public.sepay_events where booking_id=b.id;
    old_confirmed:=b.status in ('confirmed','completed') and exists(select 1 from public.payments where booking_id=b.id and bank_tx_id is not null);
   end if;
   v_result:=public.confirm_payment(v_code,p_amount,p_bank_tx_id,p_raw,p_connection_id,p_receiver_bank,p_receiver_account);
  elsif v_code ~ '^PHI[A-F0-9]{8}$' then
   v_source:='subscription';
   select * into invoice from public.subscription_invoices where subscription_invoices.code=v_code;
   if found and invoice.connection_id is not distinct from p_connection_id and lower(trim(invoice.bank))=lower(trim(p_receiver_bank)) and invoice.account_number=p_receiver_account then expected:=invoice.amount;end if;
   v_result:=public.confirm_subscription_payment(v_code,p_amount,p_bank_tx_id,p_raw,p_connection_id,p_receiver_bank,p_receiver_account);
   if expected is not null then select count(*) into previous_receipts from public.subscription_payment_events where invoice_id=invoice.id and transaction_key<>tx;end if;
  elsif v_code ~ '^GIAI[A-F0-9]{12}$' then
   v_source:='tournament';
   select * into reg from public.tournament_registrations where tournament_registrations.code=v_code;
   if found and reg.connection_id is not distinct from p_connection_id and lower(trim(reg.bank))=lower(trim(p_receiver_bank)) and reg.account_number=p_receiver_account then expected:=reg.deposit_amount;end if;
   v_result:=public.confirm_tournament_payment(v_code,p_amount,p_bank_tx_id,p_raw,p_connection_id,p_receiver_bank,p_receiver_account);
   if expected is not null then select count(*) into previous_receipts from public.tournament_payment_events where registration_id=reg.id and transaction_key<>tx;end if;
  else v_result:=jsonb_build_object('ok',false,'reason','REF_NOT_FOUND');end if;
 end if;
 v_reason:=coalesce(v_result->>'reason','UNKNOWN');
 v_outcome:=case
  when v_reason='UNDERPAID' then 'underpaid'
  when v_reason in ('BOOKING_CANCELLED','LATE','EXPIRED','CANCELLED','LATE_OR_CANCELLED') then 'late'
  when v_reason in ('NO_REF_CODE','REF_NOT_FOUND') then 'unmatched'
  when v_reason='AMBIGUOUS_REF_CODE' then 'ambiguous'
  when v_reason='WRONG_RECEIVER' then 'wrong_receiver'
  when v_reason in ('ALREADY_PAID','DUPLICATE','DUPLICATE_PAYMENT') or old_confirmed then 'duplicate'
  when v_reason='ALREADY_CONFIRMED' then 'manual_confirmed'
  when v_reason='ALREADY_PROCESSED' then 'prior_receipt'
  when v_reason='OVERPAID' or (expected is not null and p_amount>expected) then 'overpaid'
  when v_reason in ('CONFIRMED','SUBSCRIPTION_PAID','PAID') and previous_receipts>0 then 'overpaid'
  when v_reason in ('CONFIRMED','SUBSCRIPTION_PAID','PAID') then 'exact'
  else 'other' end;
 update public.incoming_transfers set receiver_owner_id=receiver,booking_id=booking,source=v_source,
  expected_amount=expected,outcome=v_outcome,reason=v_reason,result=v_result,needs_review=v_outcome<>'exact',updated_at=clock_timestamp()
 where id=entry.id;
 if p_connection_id is not null then update public.sepay_connections set last_webhook_at=now() where id=p_connection_id;end if;
 if v_outcome<>'exact' and receiver is not null and expected is not null then
  insert into public.notifications(user_id,booking_id,kind,channel,title,body)
  values(receiver,booking,'new_booking','app','Giao dịch cần đối soát',
   'Một khoản tiền vào chưa được đối soát đầy đủ. Mở Sổ tiền vào trong trang Chủ sân để kiểm tra.');
 end if;
 return v_result;
end $$;
revoke all on function public.process_incoming_transfer(text[],int,text,jsonb,uuid,text,text) from public,anon,authenticated;
grant execute on function public.process_incoming_transfer(text[],int,text,jsonb,uuid,text,text) to service_role;

notify pgrst,'reload schema';
