-- Admin opts individual owners into a fixed monthly fee. Existing owners remain exempt.
create table public.owner_subscriptions (
  owner_id uuid primary key references public.profiles(id),
  fee_required boolean not null default false,
  paid_until timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
create table public.subscription_receiver (
  singleton boolean primary key default true check (singleton),
  connection_id uuid references public.sepay_connections(id),
  bank text not null,
  account_number text not null check (account_number ~ '^[0-9]{6,30}$'),
  account_name text not null
);
-- Keep website fees on the current receiver, independent of future booking operators.
insert into public.subscription_receiver(connection_id,bank,account_number,account_name)
select case when c.status='ready' then c.id end,
  case when c.status='ready' then c.bank else o.bank end,
  case when c.status='ready' then c.account_number else o.account_number end,
  case when c.status='ready' then c.account_name else o.account_name end
from public.booking_operator o left join public.sepay_connections c on c.owner_id=o.owner_id
where c.status='ready' or (o.accepts_new_bookings and o.bank is not null);

create table public.subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  code text not null unique check (code ~ '^PHI[A-F0-9]{8}$'),
  amount int not null default 299000 check (amount=299000),
  status text not null default 'pending' check (status in ('pending','paid')),
  connection_id uuid references public.sepay_connections(id),
  bank text not null, account_number text not null, account_name text not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz, period_start timestamptz, period_end timestamptz
);
create unique index subscription_one_pending on public.subscription_invoices(owner_id) where status='pending';
create index subscription_owner_history on public.subscription_invoices(owner_id,created_at desc);
create table public.subscription_payment_events (
  transaction_key text primary key,
  invoice_id uuid not null references public.subscription_invoices(id),
  amount int not null check (amount>0),
  raw jsonb not null,
  outcome text not null default 'received',
  created_at timestamptz not null default now()
);
alter table public.owner_subscriptions enable row level security;
alter table public.subscription_receiver enable row level security;
alter table public.subscription_invoices enable row level security;
alter table public.subscription_payment_events enable row level security;
revoke all on public.owner_subscriptions,public.subscription_receiver,public.subscription_invoices,public.subscription_payment_events from public,anon,authenticated;
grant select on public.owner_subscriptions,public.subscription_receiver,public.subscription_invoices to authenticated;
grant all on public.owner_subscriptions,public.subscription_receiver,public.subscription_invoices,public.subscription_payment_events to service_role;
create policy subscription_read on public.owner_subscriptions for select to authenticated using(owner_id=auth.uid() or public.is_admin());
create policy subscription_invoice_read on public.subscription_invoices for select to authenticated using(owner_id=auth.uid() or public.is_admin());
create policy subscription_receiver_admin on public.subscription_receiver for select to authenticated using(public.is_admin());
alter publication supabase_realtime add table public.owner_subscriptions,public.subscription_invoices;

create function public.owner_subscription_allows(p_owner_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select not exists(select 1 from owner_subscriptions where owner_id=p_owner_id and fee_required and (paid_until is null or paid_until<=now()));
$$;

create function public.get_my_subscription()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('owner_id',p.id,'fee_required',coalesce(s.fee_required,false),
    'paid_until',s.paid_until,'active',owner_subscription_allows(p.id),'amount',299000)
  from profiles p left join owner_subscriptions s on s.owner_id=p.id where p.id=auth.uid();
$$;

create function public.set_owner_subscription_fee(p_owner_id uuid,p_required boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_required is null then raise exception 'INVALID_INPUT'; end if;
  perform 1 from profiles where id=p_owner_id and role in ('owner','admin') and owner_application_status='active' for update;
  if not found then raise exception 'OWNER_NOT_APPROVED'; end if;
  if p_required and not exists(select 1 from subscription_receiver) then raise exception 'RECEIVER_NOT_CONFIGURED'; end if;
  insert into owner_subscriptions(owner_id,fee_required,updated_by) values(p_owner_id,p_required,auth.uid())
  on conflict(owner_id) do update set fee_required=excluded.fee_required,updated_at=now(),updated_by=auth.uid();
end $$;

create function public.create_subscription_invoice()
returns public.subscription_invoices language plpgsql security definer set search_path=public as $$
declare s owner_subscriptions; r subscription_receiver; i subscription_invoices;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  perform 1 from profiles where id=auth.uid() and role in ('owner','admin') and owner_application_status='active' for update;
  if not found then raise exception 'OWNER_NOT_APPROVED'; end if;
  select * into s from owner_subscriptions where owner_id=auth.uid() for update;
  if not found or not s.fee_required then raise exception 'FEE_NOT_REQUIRED'; end if;
  select * into i from subscription_invoices where owner_id=auth.uid() and status='pending';
  if found then return i; end if;
  select * into r from subscription_receiver;
  if not found then raise exception 'RECEIVER_NOT_CONFIGURED'; end if;
  if r.connection_id is not null and not exists(select 1 from sepay_connections where id=r.connection_id and status='ready'
    and bank=r.bank and account_number=r.account_number) then raise exception 'RECEIVER_NOT_READY'; end if;
  -- The owner lock serializes double-clicks; a partial unique index also enforces one pending invoice.
  for attempt in 1..5 loop
    begin
      insert into subscription_invoices(owner_id,code,connection_id,bank,account_number,account_name)
      values(auth.uid(),'PHI'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),r.connection_id,r.bank,r.account_number,r.account_name)
      returning * into i;
      return i;
    exception when unique_violation then if attempt=5 then raise; end if;
    end;
  end loop;
end $$;

create function public.confirm_subscription_payment(
  p_ref_code text,p_amount int,p_bank_tx_id text,p_raw jsonb,
  p_connection_id uuid,p_receiver_bank text,p_receiver_account text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare i subscription_invoices; s owner_subscriptions; tx text; inserted int; start_at timestamptz; end_at timestamptz;
begin
  if p_amount is null or p_amount<=0 or coalesce(trim(p_bank_tx_id),'')='' then
    return jsonb_build_object('ok',false,'reason','INVALID_PAYMENT'); end if;
  select * into i from subscription_invoices where code=p_ref_code;
  if not found then return jsonb_build_object('ok',false,'reason','REF_NOT_FOUND'); end if;
  -- Same lock order as invoice creation and admin changes. Two different receipts never extend twice.
  select * into s from owner_subscriptions where owner_id=i.owner_id for update;
  if not found then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  select * into i from subscription_invoices where id=i.id for update;
  if i.connection_id is distinct from p_connection_id or lower(trim(i.bank)) is distinct from lower(trim(p_receiver_bank))
    or i.account_number is distinct from p_receiver_account then
    return jsonb_build_object('ok',false,'reason','WRONG_RECEIVER'); end if;
  tx:=lower(trim(i.bank))||':'||i.account_number||':'||p_bank_tx_id;
  insert into subscription_payment_events(transaction_key,invoice_id,amount,raw) values(tx,i.id,p_amount,p_raw) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=0 then return jsonb_build_object('ok',true,'reason','ALREADY_PROCESSED'); end if;
  if i.status='paid' then
    update subscription_payment_events set outcome='duplicate_payment' where transaction_key=tx;
    return jsonb_build_object('ok',true,'reason','ALREADY_PAID'); end if;
  -- One complete transfer per invoice; short payments are recorded but do not activate service.
  if p_amount<i.amount then
    update subscription_payment_events set outcome='underpaid' where transaction_key=tx;
    return jsonb_build_object('ok',false,'reason','UNDERPAID'); end if;
  update subscription_payment_events set outcome=case when p_amount>i.amount then 'overpaid' else 'paid' end where transaction_key=tx;
  start_at:=greatest(now(),s.paid_until);
  end_at:=((start_at at time zone 'Asia/Ho_Chi_Minh')+interval '1 month') at time zone 'Asia/Ho_Chi_Minh';
  update owner_subscriptions set paid_until=end_at,updated_at=now() where owner_id=i.owner_id;
  update subscription_invoices set status='paid',paid_at=now(),period_start=start_at,period_end=end_at where id=i.id;
  return jsonb_build_object('ok',true,'reason','SUBSCRIPTION_PAID');
end $$;

-- A database guard covers every entry point, including direct RPC calls and old registration routes.
create function public.enforce_owner_subscription()
returns trigger language plpgsql security definer set search_path=public as $$
declare owner uuid; s owner_subscriptions;
begin
  if tg_table_name='venues' then
    if tg_op='UPDATE' and new.owner_id=old.owner_id and (new.status<>'active' or old.status='active') then return new; end if;
    owner:=new.owner_id;
  elsif tg_table_name='courts' then
    if tg_op='UPDATE' and (not new.is_active or old.is_active) then return new; end if;
    select owner_id into owner from venues where id=new.venue_id;
  else
    select v.owner_id into owner from courts c join venues v on v.id=c.venue_id where c.id=new.court_id;
  end if;
  select * into s from owner_subscriptions where owner_id=owner for share;
  if s.fee_required and (s.paid_until is null or s.paid_until<=now()) then
    if tg_table_name='bookings' then raise exception 'VENUE_NOT_ACCEPTING_BOOKINGS'; end if;
    raise exception 'OWNER_SUBSCRIPTION_DUE';
  end if;
  return new;
end $$;
create trigger venues_subscription before insert or update of status,owner_id on public.venues for each row execute function public.enforce_owner_subscription();
create trigger courts_subscription before insert or update of is_active on public.courts for each row execute function public.enforce_owner_subscription();
create trigger bookings_subscription before insert on public.bookings for each row execute function public.enforce_owner_subscription();

create or replace function public.venue_accepts_bookings(p_venue_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (select 1 from venues v where v.id=p_venue_id and v.status='active'
    and owner_subscription_allows(v.owner_id)
    and exists(select 1 from profiles p where p.id=v.owner_id and p.owner_application_status='active' and p.role in ('owner','admin'))
    and (exists(select 1 from sepay_connections c where c.owner_id=v.owner_id and c.status='ready'
        and exists(select 1 from booking_operator o where o.owner_id=v.owner_id or o.multi_owner_enabled))
      or exists(select 1 from booking_operator o where o.owner_id=v.owner_id and o.accepts_new_bookings)));
$$;

-- Do not allow the active fee receiver to turn off the webhook with unpaid fee invoices.
create or replace function public.disconnect_sepay_connection(p_owner_id uuid,p_operation uuid)
returns void language plpgsql security definer set search_path=public as $$
declare c sepay_connections;
begin
  select * into c from sepay_connections where owner_id=p_owner_id and operation_token=p_operation and operation_expires_at>now() for update;
  if not found then raise exception 'CONNECTION_BUSY'; end if;
  if exists(select 1 from subscription_receiver where connection_id=c.id) then raise exception 'SUBSCRIPTION_RECEIVER_IN_USE'; end if;
  if exists(select 1 from bookings where payment_connection_id=c.id and status='pending' and expires_at>now()) then raise exception 'PENDING_PAYMENTS'; end if;
  update sepay_connections set status='disconnected' where id=c.id;
end $$;

revoke all on function public.get_my_subscription(),public.set_owner_subscription_fee(uuid,boolean),public.create_subscription_invoice() from public,anon;
grant execute on function public.get_my_subscription(),public.set_owner_subscription_fee(uuid,boolean),public.create_subscription_invoice() to authenticated;
revoke all on function public.confirm_subscription_payment(text,int,text,jsonb,uuid,text,text),public.enforce_owner_subscription() from public,anon,authenticated;
grant execute on function public.confirm_subscription_payment(text,int,text,jsonb,uuid,text,text) to service_role;

grant select(transaction_key,invoice_id,amount,created_at,outcome) on public.subscription_payment_events to authenticated;
create policy subscription_event_admin on public.subscription_payment_events for select to authenticated using(public.is_admin());
create function public.get_admin_subscriptions()
returns table(owner_id uuid,full_name text,phone text,fee_required boolean,paid_until timestamptz,active boolean)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  return query select p.id,p.full_name,p.phone,coalesce(s.fee_required,false),s.paid_until,owner_subscription_allows(p.id)
    from profiles p left join owner_subscriptions s on s.owner_id=p.id
    where p.role in ('owner','admin') and p.owner_application_status='active' order by p.full_name,p.id;
end $$;
revoke all on function public.get_admin_subscriptions() from public,anon;
grant execute on function public.get_admin_subscriptions() to authenticated;

notify pgrst,'reload schema';
