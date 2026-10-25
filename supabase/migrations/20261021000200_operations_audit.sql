begin;
create table public.operations_audit (
 id bigint generated always as identity primary key,
 actor_id uuid,
 action text not null,
 entity_id uuid not null,
 entity_code text,
 details jsonb not null default '{}',
 created_at timestamptz not null default clock_timestamp()
);
create index operations_audit_date on public.operations_audit(created_at desc,id desc);
create index operations_audit_entity on public.operations_audit(entity_id,created_at desc);
alter table public.operations_audit enable row level security;
revoke all on public.operations_audit from public,anon,authenticated;

create function public.preserve_operations_audit() returns trigger
language plpgsql set search_path=public as $$
begin raise exception 'AUDIT_IMMUTABLE';end $$;
revoke all on function public.preserve_operations_audit() from public,anon,authenticated;
create trigger preserve_operations_audit before update or delete on public.operations_audit
 for each row execute function public.preserve_operations_audit();

create function public.capture_operation_audit() returns trigger
language plpgsql security definer set search_path=public as $$
declare action text; entity uuid; code text; details jsonb:='{}';
begin
 case tg_table_name
 when 'bookings' then
  if old.status is distinct from new.status then
   action:=case when old.status='pending' and new.status='confirmed' then 'booking.confirmed'
    when new.status='cancelled' then 'booking.cancelled' when new.status='no_show' then 'booking.no_show' else null end;
   entity:=new.id;code:=new.code;details:=jsonb_build_object('from',old.status,'to',new.status);
  end if;
 when 'booking_refunds' then
  action:='booking.refund_recorded';entity:=new.booking_id;
  select b.code into code from public.bookings b where b.id=entity;
  details:=jsonb_build_object('refund_id',new.id,'amount',new.amount);
 when 'owner_application_reviews' then
  action:='owner.reviewed';entity:=new.owner_id;details:=jsonb_build_object('status',new.status);
 when 'owner_subscriptions' then
  if old.fee_required is distinct from new.fee_required then
   action:='subscription.fee_changed';entity:=new.owner_id;details:=jsonb_build_object('fee_required',new.fee_required);
  elsif old.paid_until is distinct from new.paid_until then
   action:='subscription.period_changed';entity:=new.owner_id;details:=jsonb_build_object('from',old.paid_until,'to',new.paid_until);
  end if;
 when 'sepay_connections' then
  if old.status is distinct from new.status then
   action:='sepay.status_changed';entity:=new.owner_id;details:=jsonb_build_object('from',old.status,'to',new.status);
  end if;
 when 'notification_deliveries' then
  if old.status='failed' and new.status='pending' and auth.uid() is not null then
   action:='notification.retry_requested';entity:=new.id;details:=jsonb_build_object('channel',new.channel);
  end if;
 when 'venues' then
  if old.status is distinct from new.status then
   action:='venue.status_changed';entity:=new.id;details:=jsonb_build_object('from',old.status,'to',new.status);
  end if;
 end case;
 if action is not null then
  insert into public.operations_audit(actor_id,action,entity_id,entity_code,details)
   values(auth.uid(),action,entity,code,details);
 end if;
 return new;
end $$;
revoke all on function public.capture_operation_audit() from public,anon,authenticated;
create trigger audit_booking_operation after update on public.bookings for each row execute function public.capture_operation_audit();
create trigger audit_refund_operation after insert on public.booking_refunds for each row execute function public.capture_operation_audit();
create trigger audit_owner_review after insert on public.owner_application_reviews for each row execute function public.capture_operation_audit();
create trigger audit_subscription_operation after update on public.owner_subscriptions for each row execute function public.capture_operation_audit();
create trigger audit_sepay_operation after update on public.sepay_connections for each row execute function public.capture_operation_audit();
create trigger audit_notification_retry after update on public.notification_deliveries for each row execute function public.capture_operation_audit();
create trigger audit_venue_status after update on public.venues for each row execute function public.capture_operation_audit();

create function public.get_operations_audit(p_page int default 1,p_query text default '')
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare q text:=trim(coalesce(p_query,'')); answer jsonb;
begin
 if not public.account_active() or not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if length(q)>100 then raise exception 'INVALID_FILTER';end if;
 with matching as materialized (select a.*,p.full_name actor_name from public.operations_audit a
  left join public.profiles p on p.id=a.actor_id
  where q='' or strpos(lower(coalesce(a.entity_code,'')||' '||a.entity_id::text||' '||a.action),lower(q))>0),
 limits as (select count(*) total,greatest(1,ceil(count(*)/30.0)::int) pages,
  least(greatest(1,coalesce(p_page,1)),greatest(1,ceil(count(*)/30.0)::int)) page from matching),
 rows as (select * from matching order by created_at desc,id desc limit 30 offset(select (page-1)*30 from limits))
 select jsonb_build_object('total',l.total,'pages',l.pages,'page',l.page,
  'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc) from rows r),'[]'::jsonb)) into answer from limits l;
 return answer;
end $$;
revoke all on function public.get_operations_audit(int,text) from public,anon;
grant execute on function public.get_operations_audit(int,text) to authenticated;
notify pgrst,'reload schema';
commit;
