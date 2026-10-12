-- Durable receiver-scoped receipts, including transfers that cannot be allocated.
-- Raw payload and business result are private; authenticated callers use bounded RPC projections.
create table public.incoming_transfers (
 id uuid primary key default gen_random_uuid(),
 transaction_key text not null unique,
 connection_id uuid references public.sepay_connections(id),
 receiver_owner_id uuid references public.profiles(id) on delete set null,
 bank text not null, account_number text not null, bank_tx_id text not null,
 amount int not null check(amount>0), ref_codes text[] not null default '{}',
 booking_id uuid references public.bookings(id),
 source text not null default 'unknown' check(source in ('booking','tournament','subscription','unknown')),
 expected_amount int, outcome text not null default 'processing', reason text,
 needs_review boolean not null default true,
 raw jsonb not null, result jsonb,
 payload_conflicts int not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index incoming_transfers_owner_date on public.incoming_transfers(receiver_owner_id,created_at desc,id);
create index incoming_transfers_review_date on public.incoming_transfers(needs_review,created_at desc,id);
create index incoming_transfers_booking on public.incoming_transfers(booking_id);
create table public.incoming_transfer_notes (
 id uuid primary key,
 transfer_id uuid not null references public.incoming_transfers(id),
 actor_id uuid references public.profiles(id) on delete set null,
 note text not null check(length(note) between 10 and 1000),
 created_at timestamptz not null default now()
);
create index incoming_transfer_notes_date on public.incoming_transfer_notes(transfer_id,created_at desc,id);
alter table public.incoming_transfers enable row level security;
alter table public.incoming_transfer_notes enable row level security;
revoke all on public.incoming_transfers,public.incoming_transfer_notes from public,anon,authenticated;
grant all on public.incoming_transfers,public.incoming_transfer_notes to service_role;

-- Existing SAN receipts are actual bank amounts. Do not infer a past receipt's
-- original outcome from today's booking state. Old unmatched transfers were never stored.
insert into public.incoming_transfers(transaction_key,connection_id,receiver_owner_id,bank,account_number,bank_tx_id,
 amount,ref_codes,booking_id,source,expected_amount,outcome,reason,needs_review,raw,created_at,updated_at)
select lower(trim(b.payment_bank))||':'||b.payment_account||':'||regexp_replace(e.transaction_key,'^.*:',''),
 e.connection_id,b.payment_owner_id,lower(trim(b.payment_bank)),b.payment_account,regexp_replace(e.transaction_key,'^.*:',''),
 e.amount,array[b.code],b.id,'booking',b.deposit_amount,'historical','HISTORICAL_RECORD',
 e.amount<>b.deposit_amount or coalesce(b.refund_status='needed',false) or
  exists(select 1 from public.sepay_events other where other.booking_id=b.id and other.transaction_key<>e.transaction_key),
 e.raw,e.created_at,e.created_at
from public.sepay_events e join public.bookings b on b.id=e.booking_id
where b.payment_bank is not null and b.payment_account is not null
on conflict(transaction_key) do nothing;

-- Fee and tournament histories already store their individual receipt outcomes.
insert into public.incoming_transfers(transaction_key,connection_id,receiver_owner_id,bank,account_number,bank_tx_id,
 amount,ref_codes,source,expected_amount,outcome,reason,needs_review,raw,created_at,updated_at)
select e.transaction_key,i.connection_id,coalesce(c.owner_id,o.owner_id),lower(trim(i.bank)),i.account_number,regexp_replace(e.transaction_key,'^.*:',''),
 e.amount,array[i.code],'subscription',i.amount,case e.outcome when 'paid' then 'exact' when 'duplicate_payment' then 'duplicate' else e.outcome end,upper(e.outcome),e.outcome<>'paid',e.raw,e.created_at,e.created_at
from public.subscription_payment_events e join public.subscription_invoices i on i.id=e.invoice_id
left join public.sepay_connections c on c.id=i.connection_id
left join public.booking_operator o on i.connection_id is null and lower(trim(o.bank))=lower(trim(i.bank)) and o.account_number=i.account_number
on conflict(transaction_key) do nothing;
insert into public.incoming_transfers(transaction_key,connection_id,receiver_owner_id,bank,account_number,bank_tx_id,
 amount,ref_codes,source,expected_amount,outcome,reason,needs_review,raw,created_at,updated_at)
select e.transaction_key,r.connection_id,r.payment_owner_id,lower(trim(r.bank)),r.account_number,regexp_replace(e.transaction_key,'^.*:',''),
 e.amount,array[r.code],'tournament',r.deposit_amount,case e.outcome when 'paid' then 'exact' when 'duplicate_payment' then 'duplicate' when 'late_or_cancelled' then 'late' else e.outcome end,upper(e.outcome),e.outcome<>'paid' or e.refund_status='needed',e.raw,e.created_at,e.created_at
from public.tournament_payment_events e join public.tournament_registrations r on r.id=e.registration_id
where r.bank is not null and r.account_number is not null
on conflict(transaction_key) do nothing;

-- Preserve the bank receipt's identity, amount and original payload, including on retries.
create function public.preserve_incoming_receipt() returns trigger
language plpgsql set search_path=public as $$
begin
 if row(new.id,new.transaction_key,new.connection_id,new.bank,new.account_number,new.bank_tx_id,new.amount,new.ref_codes,new.raw,new.created_at)
  is distinct from row(old.id,old.transaction_key,old.connection_id,old.bank,old.account_number,old.bank_tx_id,old.amount,old.ref_codes,old.raw,old.created_at) then
  raise exception 'RECEIPT_IMMUTABLE';
 end if;
 return new;
end $$;
revoke all on function public.preserve_incoming_receipt() from public,anon,authenticated;
create trigger preserve_incoming_receipt before update on public.incoming_transfers
 for each row execute function public.preserve_incoming_receipt();

create function public.process_incoming_transfer(
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
 if v_outcome<>'exact' and receiver is not null then
  insert into public.notifications(user_id,booking_id,kind,channel,title,body)
  values(receiver,booking,'new_booking','app','Giao dịch cần đối soát',
   'Một khoản tiền vào chưa được đối soát đầy đủ. Mở Sổ tiền vào trong trang Chủ sân để kiểm tra.');
 end if;
 return v_result;
end $$;
revoke all on function public.process_incoming_transfer(text[],int,text,jsonb,uuid,text,text) from public,anon,authenticated;
grant execute on function public.process_incoming_transfer(text[],int,text,jsonb,uuid,text,text) to service_role;

create function public.get_incoming_transfer_page(p_query text default '',p_filter text default 'review',p_page int default 1)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare q text:=upper(trim(coalesce(p_query,'')));answer jsonb;
begin
 if not public.account_active() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if length(q)>100 or p_filter is null or p_filter not in ('all','review','exact') then raise exception 'INVALID_FILTER';end if;
 with scoped as materialized (
  select t.* from public.incoming_transfers t where (t.receiver_owner_id=auth.uid() or public.is_admin())
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
   'booking_received',case when p.booking_id is not null then (select sum(t.amount::bigint) from public.incoming_transfers t where t.booking_id=p.booking_id) end,
   'notes',coalesce((select jsonb_agg(to_jsonb(n)) from (select note,created_at from public.incoming_transfer_notes where transfer_id=p.id order by created_at desc,id desc limit 5)n),'[]'::jsonb)
  ) order by p.created_at desc,p.id desc) from paged p),'[]'::jsonb))
 into answer from limits l;
 return answer;
end $$;
revoke all on function public.get_incoming_transfer_page(text,text,int) from public,anon;
grant execute on function public.get_incoming_transfer_page(text,text,int) to authenticated;

create function public.note_incoming_transfer(p_id uuid,p_note_id uuid,p_note text,p_updated_at timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare t public.incoming_transfers;existing public.incoming_transfer_notes;n text:=trim(coalesce(p_note,''));
begin
 if not public.account_active() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_note_id is null or length(n) not between 10 and 1000 then raise exception 'INVALID_NOTE';end if;
 select * into t from public.incoming_transfers where id=p_id and (receiver_owner_id=auth.uid() or public.is_admin()) for update;
 if not found then raise exception 'TRANSFER_NOT_FOUND';end if;
 select * into existing from public.incoming_transfer_notes where id=p_note_id;
 if found then
  if existing.actor_id=auth.uid() and existing.transfer_id=p_id and existing.note=n then return;end if;
  raise exception 'NOTE_CONFLICT';
 end if;
 if t.updated_at is distinct from p_updated_at then raise exception 'TRANSFER_CHANGED';end if;
 insert into public.incoming_transfer_notes(id,transfer_id,actor_id,note) values(p_note_id,p_id,auth.uid(),n);
 update public.incoming_transfers set updated_at=clock_timestamp() where id=p_id;
 -- A note is not proof of an outgoing refund and cannot clear a financial obligation.
end $$;
revoke all on function public.note_incoming_transfer(uuid,uuid,text,timestamptz) from public,anon;
grant execute on function public.note_incoming_transfer(uuid,uuid,text,timestamptz) to authenticated;
notify pgrst,'reload schema';
