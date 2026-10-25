begin;

-- A record of a transfer already made by the receiver; this never moves money.
create table public.booking_refunds (
 id uuid primary key,
 booking_id uuid not null references public.bookings(id),
 receiver_owner_id uuid not null references public.profiles(id),
 actor_id uuid not null references public.profiles(id),
 amount bigint not null check(amount>0 and amount<=2147483647),
 reference text not null check(length(reference) between 3 and 200),
 transferred_at timestamptz not null check(isfinite(transferred_at)),
 recorded_at timestamptz not null default clock_timestamp(),
 unique(receiver_owner_id,reference)
);
create index booking_refunds_booking on public.booking_refunds(booking_id,recorded_at,id);
-- Preserve the distinction between an old status and evidence of an actual refund.
create table public.booking_refund_legacy (
 booking_id uuid primary key references public.bookings(id)
);
insert into public.booking_refund_legacy select id from public.bookings where refund_status='done';
-- A subsequent late transfer must not make a forfeited original deposit refundable.
create table public.booking_refund_retained (
 booking_id uuid primary key references public.bookings(id),
 amount bigint not null check(amount>=0)
);
insert into public.booking_refund_retained
 select id,deposit_amount from public.bookings where status in ('cancelled','no_show') and paid_at is not null and coalesce(refund_status,'none')='none';
alter table public.booking_refunds enable row level security;
alter table public.booking_refund_legacy enable row level security;
alter table public.booking_refund_retained enable row level security;
revoke all on public.booking_refunds,public.booking_refund_legacy,public.booking_refund_retained from public,anon,authenticated;

create function public.capture_booking_refund_basis() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if old.status not in ('cancelled','no_show') and new.status in ('cancelled','no_show') then
  insert into public.booking_refund_retained(booking_id,amount)
   values(new.id,case when old.paid_at is not null and coalesce(new.refund_status,'none')='none' then old.deposit_amount else 0 end)
   on conflict do nothing;
  if old.status='pending' and exists(select 1 from public.sepay_events where booking_id=old.id) then new.refund_status:='needed';end if;
 end if;
 return new;
end $$;
revoke all on function public.capture_booking_refund_basis() from public,anon,authenticated;
create trigger capture_booking_refund_basis before update on public.bookings
 for each row execute function public.capture_booking_refund_basis();

create function public.preserve_booking_refund() returns trigger
language plpgsql set search_path=public as $$
begin raise exception 'REFUND_IMMUTABLE'; end $$;
revoke all on function public.preserve_booking_refund() from public,anon,authenticated;
create trigger preserve_booking_refund before update or delete on public.booking_refunds
 for each row execute function public.preserve_booking_refund();

-- No browser may bypass the receipt RPC by writing the old status column.
revoke update(refund_status) on public.bookings from authenticated;
create or replace function public.mark_refund_done(p_code text)
returns public.bookings language plpgsql security definer set search_path=public as $$
begin raise exception 'REFUND_RECEIPT_REQUIRED'; end $$;
revoke all on function public.mark_refund_done(text) from public,anon,authenticated;

create function public.get_booking_refund(p_code text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare b public.bookings; received bigint; refunded bigint; legacy boolean; manual_amount bigint; retained bigint;
begin
 if not public.account_active() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into b from public.bookings where code=upper(trim(p_code))
  and (user_id=auth.uid() or payment_owner_id=auth.uid() or public.owns_court(court_id) or public.is_admin());
 if not found then raise exception 'BOOKING_NOT_FOUND';end if;
 -- SePay records every matched bank transfer once, including short/late payments.
 select coalesce(sum(amount::bigint),0) into received from public.sepay_events where booking_id=b.id;
 -- Manual confirmation is evidence of the deposit, not an additional bank transfer.
 select coalesce(max(least(amount,b.deposit_amount)),0) into manual_amount from public.payments
  where booking_id=b.id and status='paid' and provider<>'simulation';
 received:=greatest(received,manual_amount);
 select coalesce((select amount from public.booking_refund_retained where booking_id=b.id),0) into retained;
 select coalesce(sum(amount),0) into refunded from public.booking_refunds where booking_id=b.id;
 legacy:=exists(select 1 from public.booking_refund_legacy where booking_id=b.id);
 return jsonb_build_object('code',b.code,'status',b.refund_status,'received',received,'refunded',refunded,
  'customer_name',b.customer_name,'customer_phone',b.customer_phone,'court_name',b.court_name_snapshot,
  'local_now',to_char(now() at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD"T"HH24:MI'),
  'retained',retained,
  'remaining',case when not legacy and b.refund_status in ('needed','done') then greatest(received-refunded-retained,0) else 0 end,
  'legacy',legacy,'can_record',not legacy and b.refund_status='needed' and received>refunded+retained and
    auth.uid()=coalesce(b.payment_owner_id,(select v.owner_id from public.courts c join public.venues v on v.id=c.venue_id where c.id=b.court_id)),
  'records',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'amount',r.amount,
    'reference',r.reference,'transferred_at',r.transferred_at,'recorded_at',r.recorded_at,
    'actor_name',p.full_name) order by r.recorded_at desc,r.id)
   from public.booking_refunds r join public.profiles p on p.id=r.actor_id where r.booking_id=b.id),'[]'::jsonb));
end $$;

create function public.record_booking_refund(p_code text,p_id uuid,p_amount bigint,p_reference text,p_transferred_at text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.bookings; old public.booking_refunds; summary jsonb; receiver uuid; ref text:=btrim(p_reference); transferred timestamptz;
begin
 if not public.account_active() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_id is null or p_amount is null or p_amount<=0 or p_amount>2147483647 or ref is null or length(ref) not between 3 and 200
  or p_transferred_at is null or p_transferred_at !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' then raise exception 'INVALID_REFUND';end if;
 begin transferred:=p_transferred_at::timestamp at time zone 'Asia/Ho_Chi_Minh';
 exception when others then raise exception 'INVALID_REFUND';end;
 if not isfinite(transferred) or transferred>clock_timestamp() then raise exception 'INVALID_REFUND';end if;
 -- Also serializes concurrent refunds against the same available balance.
 select * into b from public.bookings where code=upper(trim(p_code)) for update;
 if not found then raise exception 'BOOKING_NOT_FOUND';end if;
 select coalesce(b.payment_owner_id,v.owner_id) into receiver from public.courts c join public.venues v on v.id=c.venue_id where c.id=b.court_id;
 if receiver is distinct from auth.uid() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into old from public.booking_refunds where id=p_id;
 if found then
  if row(old.booking_id,old.actor_id,old.amount,old.reference,old.transferred_at) is distinct from row(b.id,auth.uid(),p_amount,ref,transferred) then raise exception 'REFUND_CONFLICT';end if;
  return public.get_booking_refund(b.code);
 end if;
 summary:=public.get_booking_refund(b.code);
 if (summary->>'legacy')::boolean then raise exception 'LEGACY_REFUND_REVIEW';end if;
 if b.refund_status is distinct from 'needed'::public.refund_status then raise exception 'REFUND_NOT_NEEDED';end if;
 if transferred<date_trunc('minute',b.created_at) then raise exception 'INVALID_REFUND';end if;
 if p_amount>(summary->>'remaining')::bigint then raise exception 'REFUND_EXCEEDS_REMAINING';end if;
 insert into public.booking_refunds(id,booking_id,receiver_owner_id,actor_id,amount,reference,transferred_at)
 values(p_id,b.id,receiver,auth.uid(),p_amount,ref,transferred);
 if p_amount=(summary->>'remaining')::bigint then update public.bookings set refund_status='done' where id=b.id;end if;
 insert into public.notifications(user_id,booking_id,kind,channel,title,body)
 values(b.user_id,b.id,'deposit_paid','app','Cập nhật hoàn tiền '||b.code,'Chủ sân đã ghi nhận một khoản hoàn tiền. Mở đơn để xem số tiền và mã tham chiếu.');
 return public.get_booking_refund(b.code);
exception when unique_violation then raise exception 'REFUND_CONFLICT';
end $$;
revoke all on function public.get_booking_refund(text),public.record_booking_refund(text,uuid,bigint,text,text) from public,anon;
grant execute on function public.get_booking_refund(text),public.record_booking_refund(text,uuid,bigint,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
