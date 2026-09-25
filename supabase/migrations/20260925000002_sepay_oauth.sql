-- SePay approved the OAuth app in ticket #6725 on 25/09/2026.
create table public.sepay_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id),
  status text not null default 'setup' check (status in ('setup','ready','reconnect','disconnected')),
  bank_account_id text unique,
  bank text,
  account_number text,
  account_name text,
  webhook_id text,
  webhook_key_hash text unique,
  webhook_key_encrypted text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  operation_token uuid,
  operation_expires_at timestamptz,
  checked_at timestamptz,
  last_webhook_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.sepay_oauth_states (
  owner_id uuid primary key references public.profiles(id),
  state_hash text not null unique,
  expires_at timestamptz not null default now() + interval '10 minutes'
);
create table public.sepay_events (
  transaction_key text primary key,
  connection_id uuid references public.sepay_connections(id),
  booking_id uuid not null references public.bookings(id),
  amount int not null check (amount > 0),
  raw jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.sepay_connections enable row level security;
alter table public.sepay_oauth_states enable row level security;
alter table public.sepay_events enable row level security;
revoke all on public.sepay_connections, public.sepay_oauth_states, public.sepay_events from public, anon, authenticated;
grant all on public.sepay_connections, public.sepay_oauth_states, public.sepay_events to service_role;

alter table public.booking_operator add column bank text,
  add column account_number text, add column account_name text,
  add column accepts_new_bookings boolean not null default true,
  add column multi_owner_enabled boolean not null default false;
alter table public.bookings add column payment_connection_id uuid references public.sepay_connections(id),
  add column payment_owner_id uuid references public.profiles(id),
  add column payment_bank text, add column payment_account text, add column payment_account_name text;
-- Freeze the legacy receiver in a trusted setup call immediately after migration.
create function public.initialize_legacy_receiver(p_bank text, p_account text, p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_bank),'') = '' or coalesce(p_account,'') !~ '^[0-9]{6,30}$'
    or p_account ~ '^0+$' or coalesce(trim(p_name),'') = '' then raise exception 'PAYOUT_INVALID'; end if;
  update booking_operator set bank = trim(p_bank), account_number = p_account, account_name = trim(p_name)
    where bank is null;
  update bookings b set payment_owner_id = v.owner_id, payment_bank = o.bank,
    payment_account = o.account_number, payment_account_name = o.account_name
    from courts c join venues v on v.id = c.venue_id cross join booking_operator o
    where b.court_id = c.id and b.payment_bank is null and b.payment_connection_id is null;
end $$;

create function public.claim_sepay_connection(p_owner_id uuid, p_operation uuid)
returns public.sepay_connections language plpgsql security definer set search_path = public as $$
declare v_row sepay_connections;
begin
  if not exists (select 1 from profiles where id = p_owner_id
    and owner_application_status = 'active' and role in ('owner','admin')) then
    raise exception 'OWNER_NOT_APPROVED';
  end if;
  insert into sepay_connections(owner_id) values(p_owner_id) on conflict(owner_id) do nothing;
  update sepay_connections set operation_token = p_operation, operation_expires_at = now() + interval '2 minutes'
    where owner_id = p_owner_id and (operation_expires_at is null or operation_expires_at < now())
    returning * into v_row;
  if not found then raise exception 'CONNECTION_BUSY'; end if;
  return v_row;
end $$;

create function public.activate_sepay_connection(p_owner_id uuid, p_operation uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c sepay_connections;
begin
  select * into c from sepay_connections where owner_id = p_owner_id
    and operation_token = p_operation and operation_expires_at > now() for update;
  if not found then raise exception 'CONNECTION_BUSY'; end if;
  if c.bank_account_id is null or c.webhook_id is null or c.webhook_key_hash is null
    or coalesce(c.bank,'') = '' or coalesce(c.account_number,'') !~ '^[0-9]{6,30}$'
    or coalesce(c.account_name,'') = '' then raise exception 'CONNECTION_INCOMPLETE'; end if;
  update sepay_connections set status = 'ready', checked_at = now() where id = c.id;
  update profiles set payout_bank = c.bank, payout_account = c.account_number where id = p_owner_id;
  -- Once migrated, disconnecting OAuth must never silently return to the shared receiver.
  update booking_operator set accepts_new_bookings = false where owner_id = p_owner_id;
end $$;

create function public.disconnect_sepay_connection(p_owner_id uuid, p_operation uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c sepay_connections;
begin
  select * into c from sepay_connections where owner_id = p_owner_id
    and operation_token = p_operation and operation_expires_at > now() for update;
  if not found then raise exception 'CONNECTION_BUSY'; end if;
  if exists(select 1 from bookings where payment_connection_id = c.id
    and status = 'pending' and expires_at > now()) then raise exception 'PENDING_PAYMENTS'; end if;
  update sepay_connections set status = 'disconnected' where id = c.id;
end $$;

create function public.get_my_sepay_connection()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('status', c.status, 'bank', c.bank, 'account_number', c.account_number,
    'account_name', c.account_name, 'bank_account_id', c.bank_account_id,
    'has_authorization', c.access_token_encrypted is not null,
    'rollout_enabled', exists(select 1 from booking_operator o where o.owner_id=c.owner_id or o.multi_owner_enabled),
    'checked_at', c.checked_at, 'last_webhook_at', c.last_webhook_at)
  from sepay_connections c where c.owner_id = auth.uid();
$$;

create or replace function public.venue_accepts_bookings(p_venue_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from venues v where v.id = p_venue_id and v.status = 'active'
    and (exists(select 1 from sepay_connections c where c.owner_id = v.owner_id and c.status = 'ready'
        and exists(select 1 from booking_operator o where o.owner_id = v.owner_id or o.multi_owner_enabled))
      or exists(select 1 from booking_operator o where o.owner_id = v.owner_id and o.accepts_new_bookings)));
$$;

create or replace function public.require_booking_operator()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; c sepay_connections; o booking_operator;
begin
  if tg_op = 'UPDATE' then
    if new.court_id is distinct from old.court_id then raise exception 'BOOKING_RECEIVER_FROZEN'; end if;
    return new;
  end if;
  select v.owner_id into v_owner from courts ct join venues v on v.id = ct.venue_id
    where ct.id = new.court_id and v.status = 'active';
  select * into c from sepay_connections where owner_id = v_owner for share;
  new.payment_owner_id := v_owner;
  if c.status = 'ready' and exists(select 1 from booking_operator where owner_id = v_owner or multi_owner_enabled) then
    new.payment_connection_id := c.id;
    new.payment_bank := c.bank;
    new.payment_account := c.account_number;
    new.payment_account_name := c.account_name;
  else
    select * into o from booking_operator where owner_id = v_owner and accepts_new_bookings for share;
    if not found then raise exception 'VENUE_NOT_ACCEPTING_BOOKINGS'; end if;
    if o.bank is null then raise exception 'RECEIVER_NOT_CONFIGURED'; end if;
    new.payment_connection_id := null;
    new.payment_bank := o.bank;
    new.payment_account := o.account_number;
    new.payment_account_name := o.account_name;
  end if;
  return new;
end $$;

-- RPCs still perform business updates; browsers cannot rewrite payment snapshots.
revoke update on public.bookings from public, anon, authenticated;
grant update (status, refund_status, paid_at, cancelled_at, customer_name, customer_phone, note)
  on public.bookings to authenticated;
revoke select on public.payments from public, anon, authenticated;
grant select (id, booking_id, provider, amount, ref_code, bank_tx_id, status, created_at, paid_at)
  on public.payments to authenticated;

create function public.confirm_payment(
  p_ref_code text, p_amount int, p_bank_tx_id text, p_raw jsonb,
  p_connection_id uuid, p_receiver_bank text, p_receiver_account text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b bookings; p payments; ct courts; v venues; owner profiles;
  tx text; inserted int;
begin
  if p_amount is null or p_amount <= 0 or coalesce(trim(p_bank_tx_id),'') = '' then
    return jsonb_build_object('ok',false,'reason','INVALID_PAYMENT');
  end if;
  select * into b from bookings where code = p_ref_code for update;
  if not found then return jsonb_build_object('ok',false,'reason','REF_NOT_FOUND'); end if;
  if b.payment_bank is null then raise exception 'RECEIVER_NOT_CONFIGURED'; end if;
  if b.payment_connection_id is distinct from p_connection_id
    or lower(trim(b.payment_bank)) is distinct from lower(trim(p_receiver_bank))
    or b.payment_account is distinct from p_receiver_account then
    return jsonb_build_object('ok',false,'reason','WRONG_RECEIVER');
  end if;
  if p_connection_id is not null and not exists (
    select 1 from sepay_connections where id = p_connection_id and owner_id = b.payment_owner_id
  ) then return jsonb_build_object('ok',false,'reason','WRONG_RECEIVER'); end if;
  tx := case when p_connection_id is null then p_bank_tx_id else p_connection_id::text || ':' || p_bank_tx_id end;
  if exists (select 1 from payments where bank_tx_id = tx) then
    return jsonb_build_object('ok',true,'reason','ALREADY_PROCESSED');
  end if;
  insert into sepay_events(transaction_key, connection_id, booking_id, amount, raw)
    values(tx, p_connection_id, b.id, p_amount, p_raw) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return jsonb_build_object('ok',true,'reason','ALREADY_PROCESSED'); end if;
  select * into p from payments where booking_id = b.id order by created_at desc limit 1 for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if b.status = 'pending' and b.expires_at <= now() then
    update bookings set status = 'cancelled', cancelled_at = now() where id = b.id;
    b.status := 'cancelled';
  end if;
  if b.status in ('cancelled','no_show') then
    update payments set bank_tx_id = tx, raw = p_raw, status = 'failed' where id = p.id;
    update bookings set refund_status = 'needed' where id = b.id;
    return jsonb_build_object('ok',false,'reason','BOOKING_CANCELLED');
  end if;
  if b.status in ('confirmed','completed') then
    -- Preserve the original receipt; a manual confirmation can acquire its bank receipt once.
    update payments set bank_tx_id = tx, raw = p_raw, status = 'paid', paid_at = coalesce(paid_at,now())
      where id = p.id and bank_tx_id is null;
    return jsonb_build_object('ok',true,'reason','ALREADY_CONFIRMED');
  end if;
  if p_amount < p.amount then
    return jsonb_build_object('ok',false,'reason','UNDERPAID');
  end if;
  update payments set bank_tx_id = tx, raw = p_raw, status = 'paid', paid_at = now() where id = p.id;
  update bookings set status = 'confirmed', paid_at = now() where id = b.id;
  select * into ct from courts where id = b.court_id;
  select * into v from venues where id = ct.venue_id;
  select * into owner from profiles where id = b.payment_owner_id;
  insert into notifications(user_id, booking_id, kind, channel, title, body) values
    (b.user_id,b.id,'deposit_paid','app','Đã nhận cọc '||b.code,v.name||' — '||ct.name),
    (b.payment_owner_id,b.id,'new_booking','app','Đơn mới '||b.code,ct.name||' · '||b.customer_phone);
  return jsonb_build_object('ok',true,'reason','CONFIRMED','code',b.code,'booking_id',b.id,
    'owner_id',b.payment_owner_id,'court_name',ct.name,'venue_name',v.name,'starts_at',b.starts_at,
    'ends_at',b.ends_at,'total_amount',b.total_amount,'deposit_amount',b.deposit_amount,
    'customer_name',b.customer_name,'customer_phone',b.customer_phone,'owner_telegram_chat_id',owner.telegram_chat_id);
end $$;

-- Compatibility during rollout: the old deployment may only confirm legacy orders.
create or replace function public.confirm_payment(p_ref_code text, p_amount int, p_bank_tx_id text, p_raw jsonb)
returns jsonb language sql security definer set search_path = public as $$
  select public.confirm_payment(p_ref_code,p_amount,p_bank_tx_id,p_raw,null,p_raw->>'gateway',p_raw->>'accountNumber');
$$;

revoke all on function initialize_legacy_receiver(text,text,text), claim_sepay_connection(uuid,uuid),
  activate_sepay_connection(uuid,uuid), disconnect_sepay_connection(uuid,uuid),
  confirm_payment(text,int,text,jsonb,uuid,text,text) from public, anon, authenticated;
grant execute on function initialize_legacy_receiver(text,text,text), claim_sepay_connection(uuid,uuid),
  activate_sepay_connection(uuid,uuid), disconnect_sepay_connection(uuid,uuid),
  confirm_payment(text,int,text,jsonb,uuid,text,text) to service_role;
revoke all on function get_my_sepay_connection() from public, anon;
grant execute on function get_my_sepay_connection() to authenticated;
notify pgrst, 'reload schema';
