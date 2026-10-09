-- Replay one authenticated booking intent without a second hold or payment.
begin;

create table public.booking_requests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  payload_hash bytea not null check (octet_length(payload_hash) = 32),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table public.booking_requests enable row level security;
-- Only the authorized SECURITY DEFINER RPC writes/reads these private hashes.
revoke all on public.booking_requests from public, anon, authenticated;

create function public.create_booking_once(
  p_request_id uuid, p_court_id uuid, p_starts_at timestamptz, p_ends_at timestamptz,
  p_customer_name text, p_customer_phone text, p_note text default null
) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_hash bytea;
  v_request public.booking_requests%rowtype;
  v_booking public.bookings%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
  -- The same lock as create_booking serializes both retries and this user's hold limit.
  perform 1 from public.profiles where id = v_uid for no key update;
  if not found or not public.account_active() then
    raise exception 'ACCOUNT_BANNED' using errcode = '42501';
  end if;
  -- Bound the hashed input too. A replay may refer to a past/cancelled booking,
  -- so the original create_booking still owns the "in the past" check for NEW requests.
  if p_starts_at is null or p_ends_at is null or not isfinite(p_starts_at)
    or not isfinite(p_ends_at) or p_ends_at <= p_starts_at then raise exception 'INVALID_RANGE'; end if;
  if coalesce(trim(p_customer_phone),'') = '' then raise exception 'PHONE_REQUIRED'; end if;
  if trim(p_customer_phone) !~ '^0[0-9]{9}$' then raise exception 'PHONE_INVALID'; end if;
  if char_length(trim(coalesce(p_customer_name,''))) > 100 then raise exception 'NAME_TOO_LONG'; end if;
  if char_length(trim(coalesce(p_note,''))) > 500 then raise exception 'NOTE_TOO_LONG'; end if;

  -- Epoch numbers compare the same instant across SQL session timezones.
  -- Store a digest, not another copy of customers' contact information.
  v_hash := extensions.digest(convert_to(jsonb_build_object(
    'court', p_court_id, 'starts', extract(epoch from p_starts_at), 'ends', extract(epoch from p_ends_at),
    'name', nullif(trim(coalesce(p_customer_name,'')),''),
    'phone', trim(p_customer_phone), 'note', nullif(trim(coalesce(p_note,'')),'')
  )::text, 'UTF8'), 'sha256');

  select * into v_request from public.booking_requests where user_id = v_uid and request_id = p_request_id;
  if found then
    if v_request.payload_hash <> v_hash then raise exception 'REQUEST_CONFLICT'; end if;
    select * into strict v_booking from public.bookings where id = v_request.booking_id and user_id = v_uid;
    -- Return current status, frozen price/receiver and original expires_at. Never reopen or extend.
    return v_booking;
  end if;

  v_booking := public.create_booking(p_court_id, p_starts_at, p_ends_at,
    p_customer_name, p_customer_phone, p_note);
  insert into public.booking_requests(user_id, request_id, payload_hash, booking_id)
    values (v_uid, p_request_id, v_hash, v_booking.id);
  return v_booking;
end $$;
revoke all on function public.create_booking_once(uuid,uuid,timestamptz,timestamptz,text,text,text) from public, anon;
grant execute on function public.create_booking_once(uuid,uuid,timestamptz,timestamptz,text,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
