begin;
-- Dedicated receiver: later changes to owner fees must not redirect VIP payments.
create table public.vip_receiver (
  singleton boolean primary key default true check(singleton),
  bank text not null, account_number text not null, account_name text not null
);
insert into public.vip_receiver(bank,account_number,account_name)
values('MBBank','0691920022005','NGUYEN DANG NGUYEN');
alter table public.vip_receiver enable row level security;
revoke all on public.vip_receiver from public,anon,authenticated;

create table public.vip_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  code text unique not null default ('VIP'||upper(encode(extensions.gen_random_bytes(6),'hex'))),
  amount int not null default 49000 check(amount=49000),
  months int not null default 1 check(months=1),
  bank text not null, account_number text not null, account_name text not null,
  status text not null default 'awaiting_payment' check(status in ('awaiting_payment','pending','approved','rejected')),
  created_at timestamptz not null default now(), submitted_at timestamptz,
  review_due_at timestamptz, reviewed_at timestamptz, reviewed_by uuid,
  rejection_reason text, transaction_id text, period_start timestamptz, period_end timestamptz,
  check(code ~ '^VIP[A-F0-9]{12}$')
);
create unique index vip_one_open_purchase on public.vip_purchases(user_id)
  where status in ('awaiting_payment','pending');
create index vip_review_queue on public.vip_purchases(status,submitted_at);
alter table public.vip_purchases enable row level security;
revoke all on public.vip_purchases from public,anon,authenticated;
grant select on public.vip_purchases to authenticated;
create policy vip_purchase_read on public.vip_purchases for select to authenticated
  using (user_id=auth.uid() or public.is_admin());

alter table public.notifications add column vip_purchase_id uuid references public.vip_purchases(id);

create function public.get_my_vip()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('active',coalesce((select enabled and paid_until>now() from user_vip_memberships where user_id=auth.uid()),false),
    'paid_until',(select paid_until from user_vip_memberships where user_id=auth.uid()),
    'purchases',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from
      (select * from vip_purchases where user_id=auth.uid() order by created_at desc limit 20) p),'[]'::jsonb));
$$;
revoke all on function public.get_my_vip() from public,anon;
grant execute on function public.get_my_vip() to authenticated;

create function public.create_vip_purchase()
returns public.vip_purchases language plpgsql security definer set search_path=public as $$
declare v_row vip_purchases; v_receiver vip_receiver;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.account_active() then raise exception 'ACCOUNT_BANNED'; end if;
  perform 1 from profiles where id=auth.uid() for no key update;
  select * into v_row from vip_purchases where user_id=auth.uid() and status in ('awaiting_payment','pending');
  if found then return v_row; end if;
  select * into strict v_receiver from vip_receiver;
  insert into vip_purchases(user_id,bank,account_number,account_name)
    values(auth.uid(),v_receiver.bank,v_receiver.account_number,v_receiver.account_name) returning * into v_row;
  return v_row;
end $$;

create function public.submit_vip_purchase(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_row vip_purchases;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.account_active() then raise exception 'ACCOUNT_BANNED'; end if;
  select * into v_row from vip_purchases where id=p_id and user_id=auth.uid() for update;
  if not found then raise exception 'VIP_PURCHASE_NOT_FOUND'; end if;
  if v_row.status='pending' then return; end if;
  if v_row.status<>'awaiting_payment' then raise exception 'VIP_ALREADY_REVIEWED'; end if;
  update vip_purchases set status='pending',submitted_at=now(),review_due_at=now()+interval '30 minutes' where id=p_id;
  -- Reuse the existing inbox; no new notification channel.
  insert into notifications(user_id,kind,vip_purchase_id,title,body)
    select id,'vip',p_id,'Yêu cầu mua VIP chờ duyệt',v_row.code||' · 49.000đ · kiểm tra tại /admin/vip'
    from profiles where role='admin' and (banned_until is null or banned_until<=now());
end $$;

create function public.review_vip_purchase(p_id uuid,p_approve boolean,p_transaction_id text default null,p_reason text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_row vip_purchases; v_until timestamptz; v_start timestamptz; v_tx text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_approve is null then raise exception 'INVALID_INPUT'; end if;
  -- Lock profile first, consistently with booking creation and purchase creation.
  perform 1 from profiles where id=(select user_id from vip_purchases where id=p_id) for no key update;
  select * into v_row from vip_purchases where id=p_id for update;
  if not found then raise exception 'VIP_PURCHASE_NOT_FOUND'; end if;
  if v_row.status='approved' and p_approve then return; end if;
  if v_row.status='rejected' and not p_approve then return; end if;
  if v_row.status<>'pending' then raise exception 'VIP_ALREADY_REVIEWED'; end if;
  if not p_approve then
    if char_length(trim(coalesce(p_reason,''))) not between 5 and 500 then raise exception 'INVALID_INPUT'; end if;
    update vip_purchases set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=trim(p_reason) where id=p_id;
  else
    -- Admin reads the incoming SePay transaction ID after checking 49,000 VND,
    -- recipient and VIP code. Never accept a payer's claim as proof of payment.
    if trim(coalesce(p_transaction_id,'')) !~ '^[1-9][0-9]{0,29}$' then raise exception 'VIP_TRANSACTION_REQUIRED'; end if;
    v_tx:=lower(trim(v_row.bank))||':'||v_row.account_number||':'||trim(p_transaction_id);
    insert into sepay_transfer_claims(transaction_key) values(v_tx) on conflict do nothing;
    if not found then raise exception 'VIP_TRANSACTION_USED'; end if;
    select paid_until into v_until from user_vip_memberships where user_id=v_row.user_id and enabled;
    v_start:=greatest(coalesce(v_until,now()),now());
    v_until:=((v_start at time zone 'Asia/Ho_Chi_Minh')+make_interval(months=>v_row.months)) at time zone 'Asia/Ho_Chi_Minh';
    insert into user_vip_memberships(user_id,enabled,paid_until,updated_by)
      values(v_row.user_id,true,v_until,auth.uid())
      on conflict(user_id) do update set enabled=true,paid_until=excluded.paid_until,updated_by=excluded.updated_by,updated_at=now();
    update vip_purchases set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),
      transaction_id=trim(p_transaction_id),period_start=v_start,period_end=v_until where id=p_id;
  end if;
  insert into operations_audit(actor_id,action,entity_id,entity_code,details)
    values(auth.uid(),case when p_approve then 'vip.approved' else 'vip.rejected' end,p_id,v_row.code,
      jsonb_build_object('user_id',v_row.user_id,'amount',v_row.amount,'period_end',v_until,'reason',p_reason));
  insert into notifications(user_id,kind,vip_purchase_id,title,body) values(v_row.user_id,'vip',p_id,
    case when p_approve then 'VIP đã được kích hoạt' else 'Yêu cầu mua VIP chưa được duyệt' end,
    case when p_approve then 'Bạn được giảm 10% tiền đặt sân. Xem hạn VIP tại /vip.'
      else coalesce(trim(p_reason),'')||' · Xem tại /vip. Nếu đã chuyển tiền, liên hệ hỗ trợ để đối soát.' end);
end $$;

revoke all on function public.create_vip_purchase() from public,anon;
revoke all on function public.submit_vip_purchase(uuid) from public,anon;
revoke all on function public.review_vip_purchase(uuid,boolean,text,text) from public,anon;
grant execute on function public.create_vip_purchase() to authenticated;
grant execute on function public.submit_vip_purchase(uuid) to authenticated;
grant execute on function public.review_vip_purchase(uuid,boolean,text,text) to authenticated;
do $$ declare t text; begin
  foreach t in array array['vip_purchases','user_vip_memberships'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
