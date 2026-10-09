begin;
-- Existing orders freeze the information known at rollout; original historical
-- values cannot be reconstructed if the venue was already edited.
alter table public.bookings
 add column court_name_snapshot text,
 add column sport_snapshot public.sport_type,
 add column venue_name_snapshot text,
 add column venue_address_snapshot text,
 add column venue_district_snapshot text,
 add column venue_city_snapshot text,
 add column details_recorded_at timestamptz;
-- Keep browser writes limited to the existing owner action fields.
revoke update on public.bookings from public,anon,authenticated;
grant update (status,refund_status,paid_at,cancelled_at,customer_name,customer_phone,note)
 on public.bookings to authenticated;
update public.bookings b set court_name_snapshot=c.name,sport_snapshot=c.sport,
 venue_name_snapshot=v.name,venue_address_snapshot=v.address,
 venue_district_snapshot=v.district,venue_city_snapshot=v.city,details_recorded_at=now()
from public.courts c join public.venues v on v.id=c.venue_id where c.id=b.court_id;
create function public.freeze_booking_details()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' then
  if row(new.court_id,new.court_name_snapshot,new.sport_snapshot,new.venue_name_snapshot,new.venue_address_snapshot,
   new.venue_district_snapshot,new.venue_city_snapshot,new.details_recorded_at)
   is distinct from row(old.court_id,old.court_name_snapshot,old.sport_snapshot,old.venue_name_snapshot,old.venue_address_snapshot,
   old.venue_district_snapshot,old.venue_city_snapshot,old.details_recorded_at) then
   raise exception 'BOOKING_DETAILS_IMMUTABLE';
  end if;
 else
  select c.name,c.sport,v.name,v.address,v.district,v.city into
   new.court_name_snapshot,new.sport_snapshot,new.venue_name_snapshot,new.venue_address_snapshot,
   new.venue_district_snapshot,new.venue_city_snapshot
  from public.courts c join public.venues v on v.id=c.venue_id where c.id=new.court_id;
  if not found then raise exception 'COURT_NOT_FOUND'; end if;
  new.details_recorded_at:=now();
 end if;
 return new;
end $$;
revoke all on function public.freeze_booking_details() from public,anon,authenticated;
create trigger bookings_details before insert or update on public.bookings
 for each row execute function public.freeze_booking_details();

create or replace function public.search_owner_bookings(
  p_venue_id uuid, p_query text default null, p_status text default 'all',
  p_from date default null, p_to date default null, p_page int default 1,
  p_show_history boolean default false, p_refund_needed boolean default false
) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_query text := lower(trim(coalesce(p_query,'')));
  v_phone text;
  v_from date := p_from; v_to date := p_to; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.account_active() or not exists(select 1 from public.venues where id=p_venue_id and (owner_id=auth.uid() or public.is_admin())) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if char_length(v_query)>100 then raise exception 'QUERY_TOO_LONG'; end if;
  if p_status is null or p_status not in ('all','pending','confirmed','completed','cancelled','no_show') then raise exception 'INVALID_STATUS'; end if;
  if v_from is not null and v_to is not null and v_from>v_to then raise exception 'INVALID_DATE_RANGE'; end if;
  -- A code/contact search includes old orders unless the user chose date bounds.
  if not coalesce(p_show_history,false) and not coalesce(p_refund_needed,false) and v_query='' and v_from is null and v_to is null then
    v_from := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
    v_to := v_from+30;
  end if;
  v_phone := regexp_replace(v_query,'[[:space:]()-]','','g');
  if v_phone ~ '^\+84[0-9]+$' then v_phone := '0'||substr(v_phone,4); end if;

  with filtered as materialized (
    select b.id,b.code,b.starts_at,b.ends_at,b.status,b.total_amount,b.deposit_amount,
      b.refund_status,b.customer_name,b.customer_phone,coalesce(b.court_name_snapshot,c.name) as "courtName"
    from public.bookings b join public.courts c on c.id=b.court_id
    where c.venue_id=p_venue_id and (not coalesce(p_refund_needed,false) or b.refund_status='needed') and (p_status='all' or b.status::text=p_status)
      and (v_from is null or b.starts_at >= (v_from::timestamp at time zone 'Asia/Ho_Chi_Minh'))
      and (v_to is null or b.starts_at < ((v_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh'))
      and (v_query='' or strpos(lower(b.code),v_query)>0 or strpos(lower(coalesce(b.customer_name,'')),v_query)>0
        or (v_phone ~ '^[0-9]+$' and strpos(b.customer_phone,v_phone)>0))
  ), counts as (
    select count(*) as total,count(*) filter(where status in ('confirmed','completed')) as confirmed,
      count(*) filter(where status='pending') as pending from filtered
  ), limits as (
    select *,greatest(1,ceil(total/30.0)::int) as pages,
      least(greatest(1,coalesce(p_page,1)),greatest(1,ceil(total/30.0)::int)) as page from counts
  ), paged as (
    select * from filtered order by starts_at desc,id desc limit 30 offset (select (page-1)*30 from limits)
  )
  select jsonb_build_object('from',v_from,'to',v_to,'total',l.total,'confirmed',l.confirmed,'pending',l.pending,
    'page',l.page,'pages',l.pages,'page_size',30,'rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.starts_at desc,p.id desc) from paged p),'[]'::jsonb))
    into v_result from limits l;
  return v_result;
end $$;

create or replace function public.search_my_bookings(
 p_query text default null, p_filter text default 'active', p_page int default 1,
 p_from date default null, p_to date default null
) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
 v_query text := lower(public.unaccent_vi(trim(coalesce(p_query,''))));
 v_result jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.account_active() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if char_length(v_query)>100 then raise exception 'QUERY_TOO_LONG'; end if;
 if p_filter is null or p_filter not in ('active','pending','confirmed','history','all') then raise exception 'INVALID_STATUS'; end if;
 if p_from is not null and p_to is not null and p_from>p_to then raise exception 'INVALID_DATE_RANGE'; end if;
 with matching as materialized (
  select b.id,b.code,b.starts_at,b.ends_at,b.status,b.total_amount,b.deposit_amount,
   b.expires_at,b.paid_at,b.refund_status,
   (b.status='pending' and b.expires_at>now()) as pending,
   (b.status='confirmed' and b.ends_at>now()) as confirmed,
   jsonb_build_object('name',coalesce(b.court_name_snapshot,c.name),'sport',coalesce(b.sport_snapshot,c.sport),'venues',jsonb_build_object(
    'name',coalesce(b.venue_name_snapshot,v.name),'district',coalesce(b.venue_district_snapshot,v.district),'slug',v.slug,'status',v.status)) as courts
  from public.bookings b join public.courts c on c.id=b.court_id join public.venues v on v.id=c.venue_id
  where b.user_id=auth.uid()
   and (p_from is null or b.starts_at>=(p_from::timestamp at time zone 'Asia/Ho_Chi_Minh'))
   and (p_to is null or b.starts_at<((p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh'))
   and not exists (
    select 1 from regexp_split_to_table(v_query,'[[:space:]]+') word
    where word<>'' and strpos(lower(public.unaccent_vi(concat_ws(' ',b.code,coalesce(b.court_name_snapshot,c.name),coalesce(b.venue_name_snapshot,v.name),coalesce(b.venue_district_snapshot,v.district),
     case coalesce(b.sport_snapshot,c.sport) when 'badminton' then 'Cầu lông' when 'pickleball' then 'Pickleball' else 'Bóng đá' end))),word)=0
   )
 ), counts as (
  select count(*) as total,count(*) filter(where pending) as pending,count(*) filter(where confirmed) as confirmed,
   count(*) filter(where not pending and not confirmed) as history from matching
 ), filtered as materialized (
  select * from matching where p_filter='all' or (p_filter='active' and (pending or confirmed))
   or (p_filter='pending' and pending) or (p_filter='confirmed' and confirmed)
   or (p_filter='history' and not pending and not confirmed)
 ), limits as (
  select count(*) as matched,greatest(1,ceil(count(*)/30.0)::int) as pages,
   least(greatest(1,coalesce(p_page,1)),greatest(1,ceil(count(*)/30.0)::int)) as page from filtered
 ), paged as (
  select * from filtered order by (pending or confirmed) desc,pending desc,
   case when pending or confirmed then starts_at end asc,
   case when not pending and not confirmed then starts_at end desc,id desc
  limit 30 offset (select (page-1)*30 from limits)
 )
 select jsonb_build_object('total',c.total,'pending',c.pending,'confirmed',c.confirmed,'history',c.history,
  'matched',l.matched,'page',l.page,'pages',l.pages,'page_size',30,'now_ms',floor(extract(epoch from now())*1000),
  'rows',coalesce((select jsonb_agg(to_jsonb(p)-'pending'-'confirmed' order by (p.pending or p.confirmed) desc,p.pending desc,
   case when p.pending or p.confirmed then p.starts_at end asc,
   case when not p.pending and not p.confirmed then p.starts_at end desc,p.id desc) from paged p),'[]'::jsonb))
 into v_result from counts c cross join limits l;
 return v_result;
end $$;

create or replace function public.get_booking_calendar(p_code text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not public.account_active() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return (select jsonb_build_object(
    'id',b.id,'code',b.code,'title',coalesce(b.venue_name_snapshot,v.name) || ' · ' || coalesce(b.court_name_snapshot,c.name),
    'location',coalesce(b.venue_address_snapshot,v.address) || ', ' || coalesce(b.venue_district_snapshot,v.district) || ', ' || coalesce(b.venue_city_snapshot,v.city),
    'starts_at',to_char(b.starts_at at time zone 'UTC','YYYYMMDD"T"HH24MISS"Z"'),
    'ends_at',to_char(b.ends_at at time zone 'UTC','YYYYMMDD"T"HH24MISS"Z"'),
    'stamp',to_char(now() at time zone 'UTC','YYYYMMDD"T"HH24MISS"Z"')
  ) from public.bookings b join public.courts c on c.id=b.court_id join public.venues v on v.id=c.venue_id
  where b.code=p_code and b.user_id=auth.uid() and b.status in ('confirmed','completed'));
end $$;

create or replace function public.confirm_payment(
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
    (b.user_id,b.id,'deposit_paid','app','Đã nhận cọc '||b.code,coalesce(b.venue_name_snapshot,v.name)||' — '||coalesce(b.court_name_snapshot,ct.name)),
    (b.payment_owner_id,b.id,'new_booking','app','Đơn mới '||b.code,coalesce(b.court_name_snapshot,ct.name)||' · '||b.customer_phone);
  return jsonb_build_object('ok',true,'reason','CONFIRMED','code',b.code,'booking_id',b.id,
    'owner_id',b.payment_owner_id,'court_name',coalesce(b.court_name_snapshot,ct.name),'venue_name',coalesce(b.venue_name_snapshot,v.name),'starts_at',b.starts_at,
    'ends_at',b.ends_at,'total_amount',b.total_amount,'deposit_amount',b.deposit_amount,
    'customer_name',b.customer_name,'customer_phone',b.customer_phone,'owner_telegram_chat_id',owner.telegram_chat_id);
end $$;


create or replace function confirm_payment_manual(p_code text)
returns bookings
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_booking bookings%rowtype;
  v_court courts%rowtype;
  v_venue venues%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select b.* into v_booking
  from bookings b
  where b.code = p_code
    and exists (
      select 1 from courts c join venues v on v.id = c.venue_id
      where c.id = b.court_id and v.owner_id = v_uid
    )
  for update;

  if v_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;
  if v_booking.status <> 'pending' or v_booking.expires_at <= now() then raise exception 'NOT_PENDING'; end if;

  update bookings
  set status = 'confirmed', paid_at = coalesce(paid_at, now())
  where id = v_booking.id
  returning * into v_booking;

  update payments
  set status = 'paid', paid_at = coalesce(paid_at, now())
  where booking_id = v_booking.id and status = 'pending';

  select c.* into v_court from courts c where c.id = v_booking.court_id;
  select v.* into v_venue from venues v where v.id = v_court.venue_id;

  insert into notifications (user_id, booking_id, kind, channel, title, body)
  values
    (v_booking.user_id, v_booking.id, 'deposit_paid', 'app',
     'Đã nhận cọc ' || v_booking.code,
     coalesce(v_booking.venue_name_snapshot,v_venue.name) || ' — ' || coalesce(v_booking.court_name_snapshot,v_court.name)),
    (v_venue.owner_id, v_booking.id, 'new_booking', 'app',
     'Đã xác nhận tay ' || v_booking.code,
     coalesce(v_booking.court_name_snapshot,v_court.name) || ' · ' || v_booking.customer_phone);

  return v_booking;
end $$;


-- Replacing definitions preserves their existing execution grants.
notify pgrst,'reload schema';
commit;
