begin;
create table public.notification_deliveries (
 id uuid primary key default gen_random_uuid(),
 event_key text not null,
 user_id uuid not null references public.profiles(id),
 booking_id uuid references public.bookings(id),
 kind text not null check(kind in ('booking','owner_review')),
 channel text not null check(channel in ('email','telegram')),
 destination text not null,
 payload jsonb not null,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed','skipped')),
 attempts int not null default 0 check(attempts>=0),
 available_at timestamptz not null default now(),
 lease_id uuid, lease_until timestamptz,
 last_reason text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 sent_at timestamptz,
 unique(event_key,channel)
);
create index notification_delivery_work on public.notification_deliveries(available_at,created_at) where status in ('pending','processing');
alter table public.notification_deliveries enable row level security;
revoke all on public.notification_deliveries from public,anon,authenticated;
create table public.notification_worker_config (
 singleton boolean primary key default true check(singleton),
 endpoint_url text not null check(endpoint_url ~ '^https://[^/]+/api/sepay/notifications$'),
 activated_at timestamptz not null default now()
);
create table public.notification_worker_requests (
 request_id bigint primary key,
 created_at timestamptz not null default now()
);
alter table public.notification_worker_config enable row level security;
alter table public.notification_worker_requests enable row level security;
revoke all on public.notification_worker_config,public.notification_worker_requests from public,anon,authenticated;

-- pg_net is enabled by the activation script, after the protected route is deployed.
create function public.dispatch_notification_worker() returns void
language plpgsql security definer set search_path=public as $$
declare endpoint text; secret text; request bigint;
begin
 select endpoint_url into endpoint from public.notification_worker_config where singleton;
 select decrypted_secret into secret from vault.decrypted_secrets where name='san_ngon_notification_worker';
 if endpoint is null or secret is null then raise exception 'NOTIFICATION_WORKER_NOT_CONFIGURED';end if;
 request:=net.http_post(url=>endpoint,headers=>jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),body=>'{}'::jsonb,timeout_milliseconds=>55000);
 insert into public.notification_worker_requests(request_id) values(request);
 delete from public.notification_worker_requests where created_at<now()-interval '7 days';
end $$;
revoke all on function public.dispatch_notification_worker() from public,anon,authenticated;
grant execute on function public.dispatch_notification_worker() to service_role;

create function public.preserve_notification_delivery() returns trigger
language plpgsql set search_path=public as $$
begin
 if row(new.id,new.event_key,new.user_id,new.booking_id,new.kind,new.channel,new.destination,new.payload,new.created_at)
  is distinct from row(old.id,old.event_key,old.user_id,old.booking_id,old.kind,old.channel,old.destination,old.payload,old.created_at) then raise exception 'DELIVERY_IMMUTABLE';end if;
 return new;
end $$;
revoke all on function public.preserve_notification_delivery() from public,anon,authenticated;
create trigger preserve_notification_delivery before update on public.notification_deliveries
 for each row execute function public.preserve_notification_delivery();

create function public.enqueue_booking_delivery() returns trigger
language plpgsql security definer set search_path=public as $$
declare b public.bookings; p public.profiles; email text; data jsonb;
begin
 if new.channel<>'app' or new.kind<>'new_booking' or new.booking_id is null then return new;end if;
 select * into b from public.bookings where id=new.booking_id;
 if b.paid_at is null or b.status not in ('confirmed','completed') or
   new.title not in ('Đơn mới '||b.code,'Đã xác nhận tay '||b.code) then return new;end if;
 select * into p from public.profiles where id=coalesce(b.payment_owner_id,new.user_id);
 select u.email into email from auth.users u where u.id=p.id;
 data:=jsonb_build_object('code',b.code,'venue_name',b.venue_name_snapshot,'court_name',b.court_name_snapshot,
  'starts_at',b.starts_at,'ends_at',b.ends_at,'total_amount',b.total_amount,'deposit_amount',b.deposit_amount,
  'customer_name',b.customer_name,'customer_phone',b.customer_phone);
 if nullif(email,'') is not null then
  insert into public.notification_deliveries(event_key,user_id,booking_id,kind,channel,destination,payload)
   values('booking:'||b.id,p.id,b.id,'booking','email',email,data) on conflict do nothing;
 end if;
 if nullif(p.telegram_chat_id,'') is not null then
  insert into public.notification_deliveries(event_key,user_id,booking_id,kind,channel,destination,payload)
   values('booking:'||b.id,p.id,b.id,'booking','telegram',p.telegram_chat_id,data) on conflict do nothing;
 end if;
 return new;
end $$;
create trigger enqueue_booking_delivery after insert on public.notifications
 for each row execute function public.enqueue_booking_delivery();

create function public.enqueue_owner_review_delivery() returns trigger
language plpgsql security definer set search_path=public as $$
declare email text;
begin
 select u.email into email from auth.users u where u.id=new.owner_id;
 if nullif(email,'') is not null then
  insert into public.notification_deliveries(event_key,user_id,kind,channel,destination,payload)
   values('owner-review:'||new.id,new.owner_id,'owner_review','email',email,jsonb_build_object('status',new.status,'reason',new.reason));
 end if;
 return new;
end $$;
create trigger enqueue_owner_review_delivery after insert on public.owner_application_reviews
 for each row execute function public.enqueue_owner_review_delivery();
revoke all on function public.enqueue_booking_delivery(),public.enqueue_owner_review_delivery() from public,anon,authenticated;

create function public.claim_notification_deliveries(p_limit int default 3)
returns jsonb language plpgsql security definer set search_path=public as $$
declare answer jsonb;
begin
 update public.notification_deliveries set status='failed',last_reason='LEASE_EXHAUSTED',lease_id=null,lease_until=null,updated_at=clock_timestamp()
  where status='processing' and lease_until<clock_timestamp() and attempts>=6;
 update public.notification_deliveries set status='pending',last_reason='LEASE_EXPIRED',lease_id=null,lease_until=null,updated_at=clock_timestamp()
  where status='processing' and lease_until<clock_timestamp() and attempts<6;
 update public.notification_deliveries set status='failed',last_reason='DELIVERY_REVIEW_REQUIRED',updated_at=clock_timestamp()
  where status='pending' and channel='email' and attempts>0 and created_at<now()-interval '23 hours'
   and coalesce(last_reason,'') not in ('NOT_CONFIGURED','HTTP_400','HTTP_401','HTTP_403','HTTP_404','HTTP_429');
 -- Revoke a stale contact before disclosing a queued payload to a sender.
 update public.notification_deliveries d set status='skipped',last_reason='RECIPIENT_CHANGED',updated_at=clock_timestamp()
  where d.status='pending' and not exists(select 1 from public.profiles p join auth.users u on u.id=p.id
   where p.id=d.user_id and (p.banned_until is null or p.banned_until<=now()) and
   case when d.channel='email' then u.email=d.destination else p.telegram_chat_id=d.destination end);
 with candidates as (
  select id from public.notification_deliveries where attempts<6 and
   ((status='pending' and available_at<=clock_timestamp()) or (status='processing' and lease_until<clock_timestamp()))
  order by available_at,created_at,id for update skip locked limit greatest(1,least(coalesce(p_limit,3),3))
 ), claimed as (
  update public.notification_deliveries d set status='processing',attempts=attempts+1,
   lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '90 seconds',updated_at=clock_timestamp()
  from candidates c where d.id=c.id returning d.*
 ) select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into answer from claimed c;
 return answer;
end $$;

create function public.finish_notification_delivery(p_id uuid,p_lease_id uuid,p_ok boolean,p_reason text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare d public.notification_deliveries; permanent boolean;
begin
 select * into d from public.notification_deliveries where id=p_id and status='processing' and lease_id=p_lease_id and lease_until>=clock_timestamp() for update;
 if not found then return false;end if;
 if p_ok is null or (not p_ok and (p_reason is null or p_reason !~ '^[A-Z0-9_]{1,60}$')) then raise exception 'INVALID_DELIVERY_RESULT';end if;
 permanent:=p_reason in ('NOT_CONFIGURED','HTTP_400','HTTP_401','HTTP_403','HTTP_404','INVALID_PAYLOAD');
 update public.notification_deliveries set status=case when p_ok then 'sent' when permanent or attempts>=6 then 'failed' else 'pending' end,
  sent_at=case when p_ok then clock_timestamp() end,last_reason=case when p_ok then null else p_reason end,
  available_at=clock_timestamp()+make_interval(secs=>least(3600,60*power(2,least(attempts,6))::int)),
  lease_id=null,lease_until=null,updated_at=clock_timestamp() where id=d.id;
 return true;
end $$;
revoke all on function public.claim_notification_deliveries(int),public.finish_notification_delivery(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.claim_notification_deliveries(int),public.finish_notification_delivery(uuid,uuid,boolean,text) to service_role;

create function public.get_notification_delivery_page(p_page int default 1)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare answer jsonb;
begin
 if not public.account_active() or not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 with limits as (select count(*) total,greatest(1,ceil(count(*)/30.0)::int) pages,
  least(greatest(1,coalesce(p_page,1)),greatest(1,ceil(count(*)/30.0)::int)) page from public.notification_deliveries),
 rows as (select d.id,d.kind,d.channel,d.status,d.attempts,d.last_reason,d.created_at,d.updated_at,d.sent_at,
  d.available_at,b.code,p.full_name from public.notification_deliveries d left join public.bookings b on b.id=d.booking_id
  join public.profiles p on p.id=d.user_id order by d.created_at desc,d.id desc limit 30 offset(select (page-1)*30 from limits))
 select jsonb_build_object('total',l.total,'pages',l.pages,'page',l.page,
  'worker_configured',exists(select 1 from public.notification_worker_config) and exists(select 1 from cron.job where jobname='notification-delivery' and active),
  'worker_last_request_at',(select max(created_at) from public.notification_worker_requests),
  'failed',(select count(*) from public.notification_deliveries where status='failed'),
  'pending',(select count(*) from public.notification_deliveries where status in ('pending','processing')),
  'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc) from rows r),'[]'::jsonb)) into answer from limits l;
 return answer;
end $$;

create function public.retry_notification_delivery(p_id uuid,p_updated_at timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare d public.notification_deliveries;
begin
 if not public.account_active() or not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into d from public.notification_deliveries where id=p_id for update;
 if not found then raise exception 'DELIVERY_NOT_FOUND';end if;
 if d.updated_at is distinct from p_updated_at or d.status<>'failed' then raise exception 'DELIVERY_CHANGED';end if;
 -- An uncertain email cannot safely be retried after the provider's 24h idempotency window.
 if d.channel='email' and d.created_at<now()-interval '23 hours' and d.last_reason not in ('NOT_CONFIGURED','HTTP_400','HTTP_401','HTTP_403','HTTP_404','HTTP_429') then raise exception 'DELIVERY_REVIEW_REQUIRED';end if;
 update public.notification_deliveries set status='pending',attempts=0,last_reason=null,available_at=clock_timestamp(),updated_at=clock_timestamp() where id=d.id;
end $$;
revoke all on function public.get_notification_delivery_page(int),public.retry_notification_delivery(uuid,timestamptz) from public,anon;
grant execute on function public.get_notification_delivery_page(int),public.retry_notification_delivery(uuid,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
