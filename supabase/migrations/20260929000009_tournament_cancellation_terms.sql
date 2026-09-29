-- Separate participant refunds from the privately agreed venue cancellation charge.
alter table public.tournament_settlements add column cancellation_venue_fee int not null default 0
 check(cancellation_venue_fee between 0 and 100000000);
alter table public.tournament_settlements add constraint tournament_cancellation_fee_limit check(venue_fee is null or cancellation_venue_fee<=venue_fee);
alter table public.tournaments add column cancelled_by uuid references profiles(id);


drop function public.review_tournament(uuid,boolean,uuid,text,int,text,boolean);

create function public.review_tournament(p_id uuid,p_approve boolean,p_court_id uuid,p_note text default '',p_venue_fee int default null,p_terms_note text default '',p_terms_confirmed boolean default false,p_cancellation_venue_fee int default 0)
returns void language plpgsql security definer set search_path=public as $$
declare t tournaments; c courts; v venues;
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_approve is null then raise exception 'INVALID_INPUT'; end if;
  select * into t from tournaments where id=p_id for update;
  if not found or t.status<>'pending' then raise exception 'TOURNAMENT_NOT_PENDING'; end if;
  if p_approve then
    if p_cancellation_venue_fee is null or p_cancellation_venue_fee<0 or p_cancellation_venue_fee>p_venue_fee or p_terms_confirmed is distinct from true or p_venue_fee is null or p_venue_fee<0 or p_venue_fee>100000000 or length(trim(coalesce(p_terms_note,'')))<10 then raise exception 'TERMS_REQUIRED'; end if;
    select * into c from courts where id=p_court_id and is_active for update;
    if not found or c.sport<>t.sport then raise exception 'COURT_INVALID'; end if;
    select * into v from venues where id=c.venue_id;
    if v.status<>'active' or t.registration_deadline<=now() then raise exception 'TOURNAMENT_DATE_INVALID'; end if;
    if not venue_accepts_bookings(v.id) then raise exception 'RECEIVER_NOT_READY'; end if;
    if exists(select 1 from bookings b where b.court_id=c.id and (b.status='confirmed' or (b.status='pending' and b.expires_at>now()))
      and tstzrange(b.starts_at,b.ends_at) && tstzrange(t.starts_at,t.ends_at)) then raise exception 'SLOT_TAKEN'; end if;
    insert into court_closures(court_id,starts_at,ends_at,reason,tournament_id) values(c.id,t.starts_at,t.ends_at,'Giải đấu: '||t.title,t.id);
    insert into tournament_settlements(tournament_id,owner_id,venue_fee,cancellation_venue_fee,terms_note,agreed_by,agreed_at,due_at)
    values(t.id,v.owner_id,p_venue_fee,p_cancellation_venue_fee,trim(p_terms_note),auth.uid(),now(),t.ends_at+interval '7 days');
    update tournaments set status='published',court_id=c.id,address=v.address,reviewed_by=auth.uid(),review_note=coalesce(trim(p_note),'') where id=t.id;
  else
    if length(trim(coalesce(p_note,'')))<3 then raise exception 'REVIEW_NOTE_REQUIRED'; end if;
    update tournaments set status='rejected',reviewed_by=auth.uid(),review_note=trim(p_note) where id=t.id;
  end if;
exception when exclusion_violation then raise exception 'SLOT_TAKEN';
end $$;

revoke all on function public.review_tournament(uuid,boolean,uuid,text,int,text,boolean,int) from public,anon;
grant execute on function public.review_tournament(uuid,boolean,uuid,text,int,text,boolean,int) to authenticated;

drop function public.set_tournament_terms(uuid,int,text);

create function public.set_tournament_terms(p_id uuid,p_venue_fee int,p_note text,p_cancellation_venue_fee int default 0)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not is_admin() then raise exception 'FORBIDDEN'; end if;
 perform 1 from tournaments where id=p_id for update;
 if p_cancellation_venue_fee is null or p_cancellation_venue_fee<0 or p_cancellation_venue_fee>p_venue_fee or p_venue_fee is null or p_venue_fee<0 or p_venue_fee>100000000 or length(trim(coalesce(p_note,'')))<10 then raise exception 'TERMS_REQUIRED'; end if;
 update tournament_settlements set venue_fee=p_venue_fee,cancellation_venue_fee=p_cancellation_venue_fee,terms_note=trim(p_note),agreed_by=auth.uid(),agreed_at=now()
 where tournament_id=p_id and venue_fee is null;
 if not found then raise exception 'TERMS_ALREADY_FIXED'; end if;
end $$;

revoke all on function public.set_tournament_terms(uuid,int,text,int) from public,anon;
grant execute on function public.set_tournament_terms(uuid,int,text,int) to authenticated;

create or replace function public.get_tournament_settlement(p_id uuid)
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
 rental:=case when t.status='cancelled' then case when t.cancelled_by=s.owner_id then 0 else s.cancellation_venue_fee end else s.venue_fee end;
 balance:=case when s.owner_id=t.manager_id then 0 else deposits-refund_due+cash-cash_refund-rental-paid_transfers-pending_transfers end;
 return jsonb_build_object('owner_id',s.owner_id,'manager_id',t.manager_id,'venue_fee',s.venue_fee,'cancellation_venue_fee',s.cancellation_venue_fee,'effective_venue_fee',rental,'terms_note',s.terms_note,'due_at',s.due_at,
 'bank_received',deposits,'refund_due',refund_due-refunded,'balance_received',cash,'balance_refund_due',cash_refund-coalesce((select sum(balance_refund_due) from tournament_registrations where tournament_id=p_id and balance_refunded_at is not null),0),
 'uncollected_count',missing,'transferred',paid_transfers,'pending_transfer',pending_transfers,'balance',balance,
 'can_settle',s.venue_fee is not null and (t.status in ('completed','cancelled') or t.ends_at<=now()) and refund_due=refunded and missing=0
 and not exists(select 1 from tournament_registrations where tournament_id=p_id and balance_refund_due>0 and balance_refunded_at is null));
end $$;

create or replace function public.cancel_tournament(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare t tournaments;
begin
 if not manages_tournament(p_id) then raise exception 'FORBIDDEN'; end if;
 select * into t from tournaments where id=p_id for update;
 if t.status='cancelled' then return; end if;
 if t.status='completed' or t.ends_at<=now() then raise exception 'TOURNAMENT_STARTED'; end if;
 update tournaments set status='cancelled',cancelled_by=auth.uid() where id=p_id;
 -- A cancelled tournament also refunds deposits forfeited by earlier individual cancellations.
 update tournament_registrations set status='cancelled',cancelled_at=now(),cancellation_kind='tournament',
   balance_refund_due=case when balance_received_at is not null then entry_fee-deposit_amount else 0 end
 where tournament_id=p_id and status in ('pending','approved','cancelled','expired');
 update tournament_payment_events e set refund_amount=e.amount,refund_status=case when e.refunded_amount=e.amount then 'done' else 'needed' end
 from tournament_registrations r where e.registration_id=r.id and r.tournament_id=p_id;
 delete from court_closures where tournament_id=p_id;
end $$;

notify pgrst,'reload schema';
