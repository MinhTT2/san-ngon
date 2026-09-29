-- Giải đấu: admin duyệt địa điểm, người đề xuất quản lý, chủ sân nhận cọc.
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references profiles(id),
  court_id uuid references courts(id),
  title text not null check(length(title) between 3 and 150),
  description text not null check(length(description) between 10 and 5000),
  sport sport_type not null,
  address text not null check(length(address) between 5 and 300),
  starts_at timestamptz not null, ends_at timestamptz not null,
  registration_deadline timestamptz not null,
  capacity int not null check(capacity between 2 and 1000),
  entry_fee int not null check(entry_fee between 0 and 100000000),
  deposit_amount int not null check(deposit_amount between 0 and entry_fee),
  status text not null default 'pending' check(status in ('pending','published','rejected','cancelled')),
  review_note text not null default '' check(length(review_note)<=1000),
  reviewed_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check(ends_at>starts_at and registration_deadline<=starts_at),
  check(status<>'published' or court_id is not null)
);
create index tournaments_status_date on public.tournaments(status,starts_at);
create index tournaments_manager on public.tournaments(manager_id);
alter table public.court_closures add column tournament_id uuid unique references public.tournaments(id);

create table public.tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id),
  user_id uuid not null references profiles(id),
  full_name text not null check(length(full_name) between 2 and 100),
  phone text not null check(phone ~ '^0[0-9]{9}$'),
  address text not null check(length(address) between 2 and 300),
  team_name text not null default '' check(length(team_name)<=100),
  note text not null default '' check(length(note)<=1000),
  status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
  review_note text not null default '' check(length(review_note)<=1000),
  code text not null unique check(code ~ '^GIAI[A-F0-9]{12}$'),
  entry_fee int not null, deposit_amount int not null,
  connection_id uuid references sepay_connections(id),
  payment_owner_id uuid references profiles(id),
  bank text, account_number text, account_name text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique(tournament_id,user_id)
);
create table public.tournament_payment_events (
  transaction_key text primary key,
  registration_id uuid not null references tournament_registrations(id),
  amount int not null check(amount>0), raw jsonb not null,
  outcome text not null default 'received',
  refund_amount int not null default 0 check(refund_amount between 0 and amount),
  refunded_amount int not null default 0 check(refunded_amount between 0 and refund_amount),
  refund_status text not null default 'none' check(refund_status in ('none','needed','done')),
  created_at timestamptz not null default now()
);
create index tournament_events_registration on public.tournament_payment_events(registration_id);
alter table public.tournaments enable row level security;
alter table public.tournament_registrations enable row level security;
alter table public.tournament_payment_events enable row level security;
revoke all on public.tournaments,public.tournament_registrations,public.tournament_payment_events from public,anon,authenticated;
grant select on public.tournaments to anon,authenticated;
grant select on public.tournament_registrations to authenticated;
grant select(transaction_key,registration_id,amount,outcome,refund_amount,refunded_amount,refund_status,created_at) on public.tournament_payment_events to authenticated;
grant all on public.tournaments,public.tournament_registrations,public.tournament_payment_events to service_role;

create function public.manages_tournament(p_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select account_active() and exists(select 1 from tournaments t where t.id=p_id and
    (t.manager_id=auth.uid() or is_admin() or exists(select 1 from courts c join venues v on v.id=c.venue_id where c.id=t.court_id and v.owner_id=auth.uid())));
$$;
create policy tournament_read on public.tournaments for select using(status='published' or manager_id=auth.uid() or manages_tournament(id) or is_admin());
create policy tournament_registration_read on public.tournament_registrations for select to authenticated using(user_id=auth.uid() or manages_tournament(tournament_id));
create policy tournament_event_read on public.tournament_payment_events for select to authenticated using(exists(select 1 from tournament_registrations r where r.id=registration_id and (r.user_id=auth.uid() or manages_tournament(r.tournament_id))));

create function public.submit_tournament(p_data jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid; court uuid:=nullif(p_data->>'court_id','')::uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not account_active() then raise exception 'ACCOUNT_BANNED'; end if;
  if court is not null and not exists(select 1 from courts c join venues v on v.id=c.venue_id join profiles p on p.id=v.owner_id
    where c.id=court and c.is_active and v.status='active' and v.owner_id=auth.uid() and p.owner_application_status='active') then raise exception 'FORBIDDEN'; end if;
  if (p_data->>'starts_at')::timestamp at time zone 'Asia/Ho_Chi_Minh' <= now()
    or (p_data->>'registration_deadline')::timestamp at time zone 'Asia/Ho_Chi_Minh' <= now() then raise exception 'TOURNAMENT_DATE_INVALID'; end if;
  insert into tournaments(manager_id,court_id,title,description,sport,address,starts_at,ends_at,registration_deadline,capacity,entry_fee,deposit_amount)
  values(auth.uid(),court,trim(p_data->>'title'),trim(p_data->>'description'),(p_data->>'sport')::sport_type,trim(p_data->>'address'),
    (p_data->>'starts_at')::timestamp at time zone 'Asia/Ho_Chi_Minh', (p_data->>'ends_at')::timestamp at time zone 'Asia/Ho_Chi_Minh',
    (p_data->>'registration_deadline')::timestamp at time zone 'Asia/Ho_Chi_Minh', (p_data->>'capacity')::int,(p_data->>'entry_fee')::int,(p_data->>'deposit_amount')::int)
  returning id into result;
  return result;
end $$;

create function public.review_tournament(p_id uuid,p_approve boolean,p_court_id uuid,p_note text default '')
returns void language plpgsql security definer set search_path=public as $$
declare t tournaments; c courts; v venues;
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_approve is null then raise exception 'INVALID_INPUT'; end if;
  select * into t from tournaments where id=p_id for update;
  if not found or t.status<>'pending' then raise exception 'TOURNAMENT_NOT_PENDING'; end if;
  if p_approve then
    select * into c from courts where id=p_court_id and is_active for update;
    if not found or c.sport<>t.sport then raise exception 'COURT_INVALID'; end if;
    select * into v from venues where id=c.venue_id;
    if v.status<>'active' or t.registration_deadline<=now() then raise exception 'TOURNAMENT_DATE_INVALID'; end if;
    if t.deposit_amount>0 and not venue_accepts_bookings(v.id) then raise exception 'RECEIVER_NOT_READY'; end if;
    if exists(select 1 from bookings b where b.court_id=c.id and (b.status='confirmed' or (b.status='pending' and b.expires_at>now()))
      and tstzrange(b.starts_at,b.ends_at) && tstzrange(t.starts_at,t.ends_at)) then raise exception 'SLOT_TAKEN'; end if;
    insert into court_closures(court_id,starts_at,ends_at,reason,tournament_id) values(c.id,t.starts_at,t.ends_at,'Giải đấu: '||t.title,t.id);
    update tournaments set status='published',court_id=c.id,address=v.address,reviewed_by=auth.uid(),review_note=coalesce(trim(p_note),'') where id=t.id;
  else
    if length(trim(coalesce(p_note,'')))<3 then raise exception 'REVIEW_NOTE_REQUIRED'; end if;
    update tournaments set status='rejected',reviewed_by=auth.uid(),review_note=trim(p_note) where id=t.id;
  end if;
exception when exclusion_violation then raise exception 'SLOT_TAKEN';
end $$;

create function public.register_tournament(p_id uuid,p_data jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare t tournaments; r tournament_registrations; result uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not account_active() then raise exception 'ACCOUNT_BANNED'; end if;
  select * into t from tournaments where id=p_id for update;
  if not found or t.status<>'published' or t.registration_deadline<=now() then raise exception 'REGISTRATION_CLOSED'; end if;
  if (select count(*) from tournament_registrations where tournament_id=t.id and status='approved')>=t.capacity then raise exception 'TOURNAMENT_FULL'; end if;
  if exists(select 1 from tournament_registrations where tournament_id=t.id and user_id=auth.uid()) then raise exception 'ALREADY_REGISTERED'; end if;
  insert into tournament_registrations(tournament_id,user_id,full_name,phone,address,team_name,note,entry_fee,deposit_amount,code)
  values(t.id,auth.uid(),trim(p_data->>'full_name'),regexp_replace(regexp_replace(p_data->>'phone','[[:space:]().-]','','g'),'^\+84','0'),
    trim(p_data->>'address'),trim(coalesce(p_data->>'team_name','')),trim(coalesce(p_data->>'note','')),t.entry_fee,t.deposit_amount,
    'GIAI'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))) returning id into result;
  return result;
end $$;

create function public.review_tournament_registration(p_id uuid,p_approve boolean,p_note text default '')
returns void language plpgsql security definer set search_path=public as $$
declare r tournament_registrations; t tournaments; c sepay_connections; o booking_operator; v venues;
begin
  select * into r from tournament_registrations where id=p_id;
  if not found or not manages_tournament(r.tournament_id) then raise exception 'FORBIDDEN'; end if;
  select * into t from tournaments where id=r.tournament_id for update;
  select * into r from tournament_registrations where id=p_id for update;
  if t.status<>'published' or t.registration_deadline<=now() then raise exception 'REGISTRATION_CLOSED'; end if;
  if r.status<>'pending' or p_approve is null then raise exception 'REGISTRATION_NOT_PENDING'; end if;
  if not p_approve then
    update tournament_registrations set status='rejected',review_note=coalesce(trim(p_note),'') where id=r.id;
    return;
  end if;
  if (select count(*) from tournament_registrations where tournament_id=t.id and status='approved')>=t.capacity then raise exception 'TOURNAMENT_FULL'; end if;
  select v1.* into v from venues v1 join courts ct on ct.venue_id=v1.id where ct.id=t.court_id;
  if r.deposit_amount>0 then
    if not venue_accepts_bookings(v.id) then raise exception 'RECEIVER_NOT_READY'; end if;
    select * into c from sepay_connections where owner_id=v.owner_id for share;
    if c.status='ready' then
      update tournament_registrations set connection_id=c.id,bank=c.bank,account_number=c.account_number,account_name=c.account_name where id=r.id;
    else
      select * into o from booking_operator where owner_id=v.owner_id and accepts_new_bookings for share;
      if not found or o.bank is null then raise exception 'RECEIVER_NOT_READY'; end if;
      update tournament_registrations set bank=o.bank,account_number=o.account_number,account_name=o.account_name where id=r.id;
    end if;
  end if;
  update tournament_registrations set status='approved',payment_owner_id=v.owner_id,review_note=coalesce(trim(p_note),'') where id=r.id;
end $$;

create function public.cancel_tournament_registration(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r tournament_registrations; t tournaments;
begin
  if not account_active() then raise exception 'FORBIDDEN'; end if;
  select * into r from tournament_registrations where id=p_id;
  if not found or (r.user_id<>auth.uid() and not manages_tournament(r.tournament_id)) then raise exception 'FORBIDDEN'; end if;
  select * into t from tournaments where id=r.tournament_id for update;
  if t.starts_at<=now() then raise exception 'TOURNAMENT_STARTED'; end if;
  update tournament_registrations set status='cancelled' where id=r.id;
  update tournament_payment_events set refund_amount=amount,refund_status='needed'
    where registration_id=r.id and refunded_amount<amount;
end $$;

create function public.cancel_tournament(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare t tournaments;
begin
  if not manages_tournament(p_id) then raise exception 'FORBIDDEN'; end if;
  select * into t from tournaments where id=p_id for update;
  if t.starts_at<=now() then raise exception 'TOURNAMENT_STARTED'; end if;
  update tournaments set status='cancelled' where id=p_id;
  update tournament_registrations set status='cancelled' where tournament_id=p_id and status in ('pending','approved');
  update tournament_payment_events e set refund_amount=e.amount,refund_status='needed'
    from tournament_registrations r where e.registration_id=r.id and r.tournament_id=p_id and e.refunded_amount<e.amount;
  delete from court_closures where tournament_id=p_id;
end $$;

-- Không mở lịch giải đang công khai từ nút mở khung sân thông thường.
create function public.guard_tournament_closure() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from tournaments where id=old.tournament_id and status='published') then raise exception 'TOURNAMENT_COURT_RESERVED'; end if;
  return old;
end $$;
create trigger tournament_closure_delete before delete on public.court_closures for each row execute function public.guard_tournament_closure();

create function public.confirm_tournament_payment(p_ref_code text,p_amount int,p_bank_tx_id text,p_raw jsonb,p_connection_id uuid,p_receiver_bank text,p_receiver_account text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r tournament_registrations; t tournaments; tx text; v_outcome text; refund int:=0;
begin
  if p_amount is null or p_amount<=0 or coalesce(trim(p_bank_tx_id),'')='' then return jsonb_build_object('reason','INVALID_PAYMENT'); end if;
  select * into r from tournament_registrations where code=p_ref_code;
  if not found then return jsonb_build_object('reason','REF_NOT_FOUND'); end if;
  select * into t from tournaments where id=r.tournament_id for update;
  select * into r from tournament_registrations where id=r.id for update;
  if r.bank is null or r.connection_id is distinct from p_connection_id or lower(trim(r.bank)) is distinct from lower(trim(p_receiver_bank))
    or r.account_number is distinct from p_receiver_account then return jsonb_build_object('reason','WRONG_RECEIVER'); end if;
  tx:=lower(trim(r.bank))||':'||r.account_number||':'||p_bank_tx_id;
  insert into tournament_payment_events(transaction_key,registration_id,amount,raw) values(tx,r.id,p_amount,p_raw) on conflict do nothing;
  if not found then return jsonb_build_object('reason','ALREADY_PROCESSED'); end if;
  if r.paid_at is not null then v_outcome:='duplicate_payment'; refund:=p_amount;
  elsif r.status<>'approved' or t.status<>'published' or t.registration_deadline<=now() then v_outcome:='late_or_cancelled'; refund:=p_amount;
  elsif p_amount<r.deposit_amount then v_outcome:='underpaid'; refund:=p_amount;
  else
    v_outcome:=case when p_amount>r.deposit_amount then 'overpaid' else 'paid' end;
    refund:=p_amount-r.deposit_amount;
    update tournament_registrations set paid_at=now() where id=r.id;
  end if;
  update tournament_payment_events set outcome=v_outcome,refund_amount=refund,
    refund_status=case when refund>0 then 'needed' else 'none' end where transaction_key=tx;
  return jsonb_build_object('reason',upper(v_outcome));
end $$;

create function public.mark_tournament_refund(p_transaction_key text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not account_active() then raise exception 'FORBIDDEN'; end if;
  update tournament_payment_events e set refund_status='done',refunded_amount=e.refund_amount from tournament_registrations r
    where e.registration_id=r.id and e.transaction_key=p_transaction_key and e.refund_status='needed'
      and (r.payment_owner_id=auth.uid() or is_admin());
  if not found then raise exception 'FORBIDDEN'; end if;
end $$;

-- Block disconnecting while participants still have a valid transfer instruction.
create or replace function public.disconnect_sepay_connection(p_owner_id uuid,p_operation uuid)
returns void language plpgsql security definer set search_path=public as $$
declare c sepay_connections;
begin
  select * into c from sepay_connections where owner_id=p_owner_id and operation_token=p_operation and operation_expires_at>now() for update;
  if not found then raise exception 'CONNECTION_BUSY'; end if;
  if exists(select 1 from subscription_receiver where connection_id=c.id) then raise exception 'SUBSCRIPTION_RECEIVER_IN_USE'; end if;
  if exists(select 1 from bookings where payment_connection_id=c.id and status='pending' and expires_at>now())
    or exists(select 1 from tournament_registrations r join tournaments t on t.id=r.tournament_id
      where r.connection_id=c.id and r.status='approved' and r.paid_at is null and t.status='published' and t.registration_deadline>now()) then raise exception 'PENDING_PAYMENTS'; end if;
  update sepay_connections set status='disconnected' where id=c.id;
end $$;

revoke all on function public.manages_tournament(uuid),public.submit_tournament(jsonb),public.review_tournament(uuid,boolean,uuid,text),public.register_tournament(uuid,jsonb),public.review_tournament_registration(uuid,boolean,text),public.cancel_tournament_registration(uuid),public.cancel_tournament(uuid),public.mark_tournament_refund(text),public.guard_tournament_closure(),public.confirm_tournament_payment(text,int,text,jsonb,uuid,text,text) from public,anon,authenticated;
grant execute on function public.manages_tournament(uuid) to anon,authenticated;
grant execute on function public.submit_tournament(jsonb),public.review_tournament(uuid,boolean,uuid,text),public.register_tournament(uuid,jsonb),public.review_tournament_registration(uuid,boolean,text),public.cancel_tournament_registration(uuid),public.cancel_tournament(uuid),public.mark_tournament_refund(text) to authenticated;
grant execute on function public.confirm_tournament_payment(text,int,text,jsonb,uuid,text,text) to service_role;
alter publication supabase_realtime add table public.tournament_registrations,public.tournaments,public.tournament_payment_events;
notify pgrst,'reload schema';

-- One bank receipt across all three payment flows, including retries with changed references.
create table public.sepay_transfer_claims(transaction_key text primary key);
alter table public.sepay_transfer_claims enable row level security;
revoke all on public.sepay_transfer_claims from public,anon,authenticated;
grant all on public.sepay_transfer_claims to service_role;
insert into sepay_transfer_claims
select lower(trim(b.payment_bank))||':'||b.payment_account||':'||regexp_replace(e.transaction_key,'^.*:','')
from sepay_events e join bookings b on b.id=e.booking_id where b.payment_bank is not null
union select transaction_key from subscription_payment_events on conflict do nothing;
create function public.claim_sepay_transfer() returns trigger language plpgsql security definer set search_path=public as $$
declare tx text;
begin
  if tg_table_name='sepay_events' then
    select lower(trim(payment_bank))||':'||payment_account||':'||regexp_replace(new.transaction_key,'^.*:','') into tx from bookings where id=new.booking_id;
  else tx:=new.transaction_key; end if;
  insert into sepay_transfer_claims values(tx) on conflict do nothing;
  if not found then return null; end if;
  return new;
end $$;
revoke all on function public.claim_sepay_transfer() from public,anon,authenticated;
create trigger claim_transfer before insert on public.sepay_events for each row execute function public.claim_sepay_transfer();
create trigger claim_transfer before insert on public.subscription_payment_events for each row execute function public.claim_sepay_transfer();
create trigger claim_transfer before insert on public.tournament_payment_events for each row execute function public.claim_sepay_transfer();
create policy tournament_participant_read on public.tournaments for select to authenticated using(exists(select 1 from tournament_registrations r where r.tournament_id=tournaments.id and r.user_id=auth.uid()));
create function public.get_tournament_capacity(p_id uuid)
returns int language sql stable security definer set search_path=public as $$
  select count(*)::int from tournament_registrations r join tournaments t on t.id=r.tournament_id where t.id=p_id and r.status='approved' and (t.status='published' or manages_tournament(p_id));
$$;
revoke all on function public.get_tournament_capacity(uuid) from public;
grant execute on function public.get_tournament_capacity(uuid) to anon,authenticated;
