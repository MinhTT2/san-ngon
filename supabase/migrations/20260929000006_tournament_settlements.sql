alter table public.tournament_registrations add column balance_waived_at timestamptz, add column balance_refund_receipt text, add column balance_refunded_by uuid references profiles(id);
-- Private operating ledger. All participant fees go to the venue owner; transfers remain manual.
create table public.tournament_settlements (
 tournament_id uuid primary key references tournaments(id),
 owner_id uuid not null references profiles(id),
 venue_fee int check(venue_fee between 0 and 100000000),
 terms_note text not null default '' check(length(terms_note)<=1000),
 agreed_by uuid references profiles(id),
 agreed_at timestamptz,
 due_at timestamptz not null,
 check((venue_fee is null and agreed_at is null) or (venue_fee is not null and agreed_at is not null))
);
create table public.tournament_transfers (
 id uuid primary key default gen_random_uuid(),
 tournament_id uuid not null references tournaments(id),
 amount bigint not null check(amount<>0), -- positive: owner pays organizer; negative: organizer pays owner
 receipt text not null check(length(trim(receipt)) between 3 and 300),
 recorded_by uuid not null references profiles(id),
 created_at timestamptz not null default now(),
 received_at timestamptz,
 received_by uuid references profiles(id)
);
create unique index tournament_transfer_pending on public.tournament_transfers(tournament_id) where received_at is null;
alter table public.tournament_settlements enable row level security;
alter table public.tournament_transfers enable row level security;
revoke all on public.tournament_settlements,public.tournament_transfers from public,anon,authenticated;
grant select on public.tournament_settlements,public.tournament_transfers to authenticated;
create policy tournament_terms_read on public.tournament_settlements for select to authenticated using(manages_tournament(tournament_id));
create policy tournament_transfers_read on public.tournament_transfers for select to authenticated using(manages_tournament(tournament_id));
insert into tournament_settlements(tournament_id,owner_id,due_at)
 select t.id,v.owner_id,t.ends_at+interval '7 days' from tournaments t join courts c on c.id=t.court_id join venues v on v.id=c.venue_id
 where t.status in ('published','completed','cancelled');

create function public.set_tournament_terms(p_id uuid,p_venue_fee int,p_note text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not is_admin() then raise exception 'FORBIDDEN'; end if;
 perform 1 from tournaments where id=p_id for update;
 if p_venue_fee is null or p_venue_fee<0 or p_venue_fee>100000000 or length(trim(coalesce(p_note,'')))<10 then raise exception 'TERMS_REQUIRED'; end if;
 update tournament_settlements set venue_fee=p_venue_fee,terms_note=trim(p_note),agreed_by=auth.uid(),agreed_at=now()
 where tournament_id=p_id and venue_fee is null;
 if not found then raise exception 'TERMS_ALREADY_FIXED'; end if;
end $$;
revoke all on function public.set_tournament_terms(uuid,int,text) from public,anon;
grant execute on function public.set_tournament_terms(uuid,int,text) to authenticated;

-- Serialize money records with the tournament lock, as with payments, cancellations and refunds.
create function public.record_tournament_balance(p_id uuid,p_refund boolean,p_receipt text)
returns void language plpgsql security definer set search_path=public as $$
declare r tournament_registrations; t tournaments;
begin
 select * into r from tournament_registrations where id=p_id;
 if not found then raise exception 'FORBIDDEN'; end if;
 select * into t from tournaments where id=r.tournament_id for update;
 select * into r from tournament_registrations where id=p_id for update;
 if not account_active() or (r.payment_owner_id is distinct from auth.uid() and not is_admin()) then raise exception 'FORBIDDEN'; end if;
 if p_refund is null or length(trim(coalesce(p_receipt,'')))<3 or length(p_receipt)>300 then raise exception 'RECEIPT_REQUIRED'; end if;
 if p_refund then
   if r.balance_refund_due=0 or r.balance_refunded_at is not null then raise exception 'BALANCE_ALREADY_RECORDED'; end if;
   update tournament_registrations set balance_refunded_at=now(),balance_refund_receipt=trim(p_receipt),balance_refunded_by=auth.uid() where id=p_id;
   perform tournament_notice(r.user_id,t.id,'Đã xác nhận hoàn phần lệ phí còn lại',t.title||'. Chứng từ: '||trim(p_receipt));
 else
   if r.status<>'approved' or t.status not in ('published','completed') or t.starts_at>now()
      or (r.deposit_amount>0 and r.paid_at is null) or r.entry_fee<=r.deposit_amount or r.balance_received_at is not null or r.balance_waived_at is not null then raise exception 'BALANCE_NOT_COLLECTIBLE'; end if;
   update tournament_registrations set balance_received_at=now(),balance_received_by=auth.uid(),balance_receipt=trim(p_receipt) where id=p_id;
   perform tournament_notice(r.user_id,t.id,'Đã xác nhận nhận đủ lệ phí',t.title||'. Chứng từ phần còn lại: '||trim(p_receipt));
 end if;
end $$;
revoke all on function public.record_tournament_balance(uuid,boolean,text) from public,anon;
grant execute on function public.record_tournament_balance(uuid,boolean,text) to authenticated;

create function public.get_tournament_settlement(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare t tournaments; s tournament_settlements; deposits bigint; refund_due bigint; refunded bigint; cash bigint; cash_refund bigint;
 paid_transfers bigint; pending_transfers bigint; rental bigint; balance bigint; missing int;
begin
 if not manages_tournament(p_id) then raise exception 'FORBIDDEN'; end if;
 select * into t from tournaments where id=p_id;
 select * into s from tournament_settlements where tournament_id=p_id;
 if not found then return null; end if;
 select coalesce(sum(e.amount),0),coalesce(sum(e.refund_amount),0),coalesce(sum(e.refunded_amount),0)
 into deposits,refund_due,refunded from tournament_payment_events e join tournament_registrations r on r.id=e.registration_id where r.tournament_id=p_id;
 select coalesce(sum(case when balance_received_at is not null then entry_fee-deposit_amount else 0 end),0),coalesce(sum(balance_refund_due),0),
 count(*) filter(where status='approved' and entry_fee>deposit_amount and balance_received_at is null and balance_waived_at is null)
 into cash,cash_refund,missing from tournament_registrations where tournament_id=p_id;
 select coalesce(sum(amount) filter(where received_at is not null),0),coalesce(sum(amount) filter(where received_at is null),0)
 into paid_transfers,pending_transfers from tournament_transfers where tournament_id=p_id;
 rental:=case when t.status='cancelled' then 0 else s.venue_fee end;
 balance:=case when s.owner_id=t.manager_id then 0 else deposits-refund_due+cash-cash_refund-rental-paid_transfers-pending_transfers end;
 return jsonb_build_object('owner_id',s.owner_id,'manager_id',t.manager_id,'venue_fee',s.venue_fee,'effective_venue_fee',rental,'terms_note',s.terms_note,'due_at',s.due_at,
 'bank_received',deposits,'refund_due',refund_due-refunded,'balance_received',cash,'balance_refund_due',cash_refund-coalesce((select sum(balance_refund_due) from tournament_registrations where tournament_id=p_id and balance_refunded_at is not null),0),
 'uncollected_count',missing,'transferred',paid_transfers,'pending_transfer',pending_transfers,'balance',balance,
 'can_settle',s.venue_fee is not null and (t.status in ('completed','cancelled') or t.ends_at<=now()) and refund_due=refunded and missing=0
 and not exists(select 1 from tournament_registrations where tournament_id=p_id and balance_refund_due>0 and balance_refunded_at is null));
end $$;
revoke all on function public.get_tournament_settlement(uuid) from public,anon;
grant execute on function public.get_tournament_settlement(uuid) to authenticated;

create function public.record_tournament_transfer(p_id uuid,p_expected_balance bigint,p_receipt text)
returns uuid language plpgsql security definer set search_path=public as $$
declare s jsonb; result uuid; payer uuid; receiver uuid;
begin
 perform 1 from tournaments where id=p_id for update;
 s:=get_tournament_settlement(p_id);
 if not coalesce((s->>'can_settle')::boolean,false) or (s->>'balance')::bigint is distinct from p_expected_balance or coalesce(p_expected_balance,0)=0 then raise exception 'SETTLEMENT_CHANGED'; end if;
 payer:=case when p_expected_balance>0 then (s->>'owner_id')::uuid else (s->>'manager_id')::uuid end;
 receiver:=case when p_expected_balance>0 then (s->>'manager_id')::uuid else (s->>'owner_id')::uuid end;
 if payer<>auth.uid() and not is_admin() then raise exception 'FORBIDDEN'; end if;
 insert into tournament_transfers(tournament_id,amount,receipt,recorded_by) values(p_id,p_expected_balance,trim(p_receipt),auth.uid()) returning id into result;
 perform tournament_notice(receiver,p_id,'Có khoản quyết toán chờ xác nhận','Bên trả đã ghi nhận chuyển tiền. Kiểm tra ngân hàng trước khi xác nhận đã nhận.');
 return result;
exception when unique_violation then raise exception 'TRANSFER_PENDING';
end $$;
create function public.confirm_tournament_transfer(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare x tournament_transfers; s tournament_settlements; t tournaments; receiver uuid;
begin
 select * into x from tournament_transfers where id=p_id;
 if not found or not account_active() then raise exception 'FORBIDDEN'; end if;
 select * into t from tournaments where id=x.tournament_id for update;
 select * into s from tournament_settlements where tournament_id=t.id;
 receiver:=case when x.amount>0 then t.manager_id else s.owner_id end;
 if receiver<>auth.uid() and not is_admin() then raise exception 'FORBIDDEN'; end if;
 update tournament_transfers set received_at=now(),received_by=auth.uid() where id=p_id and received_at is null;
 if found then perform tournament_notice(x.recorded_by,t.id,'Đã xác nhận nhận tiền quyết toán',t.title); end if;
end $$;
revoke all on function public.record_tournament_transfer(uuid,bigint,text),public.confirm_tournament_transfer(uuid) from public,anon;
grant execute on function public.record_tournament_transfer(uuid,bigint,text),public.confirm_tournament_transfer(uuid) to authenticated;
alter publication supabase_realtime add table public.tournament_settlements,public.tournament_transfers;

drop function public.review_tournament(uuid,boolean,uuid,text);
create function public.review_tournament(p_id uuid,p_approve boolean,p_court_id uuid,p_note text default '',p_venue_fee int default null,p_terms_note text default '',p_terms_confirmed boolean default false)
returns void language plpgsql security definer set search_path=public as $$
declare t tournaments; c courts; v venues;
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_approve is null then raise exception 'INVALID_INPUT'; end if;
  select * into t from tournaments where id=p_id for update;
  if not found or t.status<>'pending' then raise exception 'TOURNAMENT_NOT_PENDING'; end if;
  if p_approve then
    if p_terms_confirmed is distinct from true or p_venue_fee is null or p_venue_fee<0 or p_venue_fee>100000000 or length(trim(coalesce(p_terms_note,'')))<10 then raise exception 'TERMS_REQUIRED'; end if;
    select * into c from courts where id=p_court_id and is_active for update;
    if not found or c.sport<>t.sport then raise exception 'COURT_INVALID'; end if;
    select * into v from venues where id=c.venue_id;
    if v.status<>'active' or t.registration_deadline<=now() then raise exception 'TOURNAMENT_DATE_INVALID'; end if;
    if not venue_accepts_bookings(v.id) then raise exception 'RECEIVER_NOT_READY'; end if;
    if exists(select 1 from bookings b where b.court_id=c.id and (b.status='confirmed' or (b.status='pending' and b.expires_at>now()))
      and tstzrange(b.starts_at,b.ends_at) && tstzrange(t.starts_at,t.ends_at)) then raise exception 'SLOT_TAKEN'; end if;
    insert into court_closures(court_id,starts_at,ends_at,reason,tournament_id) values(c.id,t.starts_at,t.ends_at,'Giải đấu: '||t.title,t.id);
    insert into tournament_settlements(tournament_id,owner_id,venue_fee,terms_note,agreed_by,agreed_at,due_at)
    values(t.id,v.owner_id,p_venue_fee,trim(p_terms_note),auth.uid(),now(),t.ends_at+interval '7 days');
    update tournaments set status='published',court_id=c.id,address=v.address,reviewed_by=auth.uid(),review_note=coalesce(trim(p_note),'') where id=t.id;
  else
    if length(trim(coalesce(p_note,'')))<3 then raise exception 'REVIEW_NOTE_REQUIRED'; end if;
    update tournaments set status='rejected',reviewed_by=auth.uid(),review_note=trim(p_note) where id=t.id;
  end if;
exception when exclusion_violation then raise exception 'SLOT_TAKEN';
end $$;
revoke all on function public.review_tournament(uuid,boolean,uuid,text,int,text,boolean) from public,anon;
grant execute on function public.review_tournament(uuid,boolean,uuid,text,int,text,boolean) to authenticated;
notify pgrst,'reload schema';


create function public.waive_tournament_balance(p_id uuid,p_note text)
returns void language plpgsql security definer set search_path=public as $$
declare r tournament_registrations; t tournaments;
begin
 select * into r from tournament_registrations where id=p_id;
 if not found then raise exception 'FORBIDDEN'; end if;
 select * into t from tournaments where id=r.tournament_id for update;
 select * into r from tournament_registrations where id=p_id for update;
 if not account_active() or (r.payment_owner_id is distinct from auth.uid() and not is_admin()) then raise exception 'FORBIDDEN'; end if;
 if t.starts_at>now() or t.status not in ('published','completed') or r.status<>'approved' or r.balance_received_at is not null or r.balance_waived_at is not null
   or r.entry_fee<=r.deposit_amount or length(trim(coalesce(p_note,'')))<3 then raise exception 'BALANCE_NOT_COLLECTIBLE'; end if;
 update tournament_registrations set balance_waived_at=now(),balance_receipt=left(trim(p_note),300) where id=p_id;
 perform tournament_notice(r.user_id,t.id,'Không thu phần lệ phí còn lại',t.title||'. '||left(trim(p_note),300));
end $$;
revoke all on function public.waive_tournament_balance(uuid,text) from public,anon;
grant execute on function public.waive_tournament_balance(uuid,text) to authenticated;
