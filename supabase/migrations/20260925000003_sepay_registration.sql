-- Connect SePay as step 3 of owner registration, without granting owner approval.
alter table public.sepay_oauth_states add column return_to text not null default '/chu-san/thanh-toan'
  check (return_to in ('/dang-ky-san','/chu-san/thanh-toan'));

create or replace function public.register_owner(
  p_full_name text,
  p_phone text,
  p_business_license_path text,
  p_business_license_name text,
  p_payout_bank text,
  p_payout_account text
) returns profiles
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profile profiles%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(trim(p_full_name), '') = '' then raise exception 'REPRESENTATIVE_REQUIRED'; end if;
  if coalesce(trim(p_phone), '') !~ '^0[0-9]{9}$' then raise exception 'PHONE_INVALID'; end if;
  -- The OAuth step follows the saved application. Keep older callers compatible.
  if nullif(trim(p_payout_bank), '') is not null or nullif(trim(p_payout_account), '') is not null then
    if coalesce(trim(p_payout_bank), '') = '' or coalesce(trim(p_payout_account), '') !~ '^[0-9]{6,30}$' then
      raise exception 'PAYOUT_INVALID';
    end if;
  end if;
  if coalesce(trim(p_business_license_path), '') = ''
     or coalesce(trim(p_business_license_name), '') = '' then
    raise exception 'BUSINESS_LICENSE_REQUIRED';
  end if;
  if p_business_license_path !~ ('^' || v_uid::text || '/[0-9a-f-]+\.(pdf|jpg|png)$') then
    raise exception 'BUSINESS_LICENSE_INVALID';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'venue-documents' and name = p_business_license_path
  ) then raise exception 'BUSINESS_LICENSE_MISSING'; end if;

  select * into v_profile from profiles where id = v_uid for update;
  if not found then raise exception 'PROFILE_REQUIRED'; end if;
  if v_profile.owner_application_status = 'pending' then raise exception 'OWNER_APPLICATION_EXISTS'; end if;
  if v_profile.owner_application_status = 'active' then raise exception 'OWNER_ALREADY_APPROVED'; end if;

  update profiles set
    full_name = trim(p_full_name), phone = trim(p_phone),
    payout_bank = coalesce((select bank from sepay_connections where owner_id=v_uid and status='ready'), nullif(trim(p_payout_bank), '')),
    payout_account = coalesce((select account_number from sepay_connections where owner_id=v_uid and status='ready'), nullif(trim(p_payout_account), '')),
    business_license_path = p_business_license_path,
    business_license_name = left(trim(p_business_license_name), 255),
    owner_application_status = 'pending'
  where id = v_uid
  returning * into v_profile;
  return v_profile;
end $$;

grant execute on function public.register_owner(text, text, text, text, text, text) to authenticated;

create or replace function public.claim_sepay_connection(p_owner_id uuid, p_operation uuid)
returns public.sepay_connections language plpgsql security definer set search_path = public as $$
declare v_row sepay_connections;
begin
  if not exists (select 1 from profiles where id = p_owner_id
    and (owner_application_status = 'pending' or (owner_application_status = 'active' and role in ('owner','admin')))) then
    raise exception 'OWNER_NOT_APPROVED';
  end if;
  insert into sepay_connections(owner_id) values(p_owner_id) on conflict(owner_id) do nothing;
  update sepay_connections set operation_token = p_operation, operation_expires_at = now() + interval '2 minutes'
    where owner_id = p_owner_id and (operation_expires_at is null or operation_expires_at < now())
    returning * into v_row;
  if not found then raise exception 'CONNECTION_BUSY'; end if;
  return v_row;
end $$;

create or replace function public.activate_sepay_connection(p_owner_id uuid, p_operation uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c sepay_connections;
begin
  select * into c from sepay_connections where owner_id = p_owner_id
    and operation_token = p_operation and operation_expires_at > now() for update;
  if not found then raise exception 'CONNECTION_BUSY'; end if;
  if not exists (select 1 from profiles where id = p_owner_id
    and (owner_application_status = 'pending' or (owner_application_status = 'active' and role in ('owner','admin')))) then
    raise exception 'OWNER_NOT_APPROVED';
  end if;
  if c.bank_account_id is null or c.webhook_id is null or c.webhook_key_hash is null
    or coalesce(c.bank,'') = '' or coalesce(c.account_number,'') !~ '^[0-9]{6,30}$'
    or coalesce(c.account_name,'') = '' then raise exception 'CONNECTION_INCOMPLETE'; end if;
  update sepay_connections set status = 'ready', checked_at = now() where id = c.id;
  update profiles set payout_bank = c.bank, payout_account = c.account_number where id = p_owner_id;
  -- Once migrated, disconnecting OAuth must never silently return to the shared receiver.
  update booking_operator set accepts_new_bookings = false where owner_id = p_owner_id;
end $$;

create or replace function public.venue_accepts_bookings(p_venue_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from venues v where v.id = p_venue_id and v.status = 'active'
    and exists(select 1 from profiles p where p.id=v.owner_id and p.owner_application_status='active' and p.role in ('owner','admin'))
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
  if not exists(select 1 from profiles where id=v_owner and owner_application_status='active' and role in ('owner','admin')) then
    raise exception 'VENUE_NOT_ACCEPTING_BOOKINGS';
  end if;
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


notify pgrst, 'reload schema';
