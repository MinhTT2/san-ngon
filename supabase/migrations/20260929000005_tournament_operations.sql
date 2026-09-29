-- Preserve old promises; new proposals use the agreed 24-hour refund window.
alter table public.tournaments
  add column payment_deadline timestamptz,
  add column payment_hold_hours int not null default 24 check(payment_hold_hours between 1 and 72),
  add column cancel_window_hours int not null default 0 check(cancel_window_hours in (0,24));
update public.tournaments set payment_deadline=registration_deadline;
alter table public.tournaments alter column payment_deadline set not null;
alter table public.tournaments alter column cancel_window_hours set default 24;
alter table public.tournaments add constraint tournament_payment_deadline check(isfinite(payment_deadline) and payment_deadline>=registration_deadline and payment_deadline<=starts_at);
alter table public.tournaments drop constraint tournaments_status_check;
alter table public.tournaments add constraint tournaments_status_check check(status in ('pending','published','rejected','cancelled','completed'));
alter table public.tournament_registrations
  add column payment_expires_at timestamptz,
  add column refund_deadline timestamptz,
  add column cancellation_kind text check(cancellation_kind in ('self','organizer','tournament')),
  add column cancelled_at timestamptz,
  add column reminder_sent_at timestamptz,
  add column balance_received_at timestamptz,
  add column balance_received_by uuid references profiles(id),
  add column balance_receipt text,
  add column balance_refund_due int not null default 0 check(balance_refund_due>=0),
  add column balance_refunded_at timestamptz;
update public.tournament_registrations r set payment_expires_at=t.registration_deadline,refund_deadline=t.starts_at from tournaments t where t.id=r.tournament_id;
alter table public.tournament_registrations drop constraint tournament_registrations_status_check;
alter table public.tournament_registrations add constraint tournament_registrations_status_check check(status in ('pending','approved','rejected','cancelled','expired'));
alter table public.tournament_registrations drop constraint tournament_registrations_tournament_id_user_id_key;
create unique index tournament_active_registration on public.tournament_registrations(tournament_id,user_id) where status in ('pending','approved');
create index tournament_expiry on public.tournament_registrations(payment_expires_at) where status='approved' and paid_at is null;
alter table public.notifications add column tournament_id uuid references public.tournaments(id);
create index notifications_tournament on public.notifications(tournament_id) where tournament_id is not null;
create or replace function public.tournament_notice(p_user uuid,p_id uuid,p_title text,p_body text)
returns void language sql security definer set search_path=public as $$
 insert into notifications(user_id,tournament_id,kind,channel,title,body) select p_user,p_id,'tournament','app',p_title,p_body where p_user is not null;
$$;
revoke all on function public.tournament_notice(uuid,uuid,text,text) from public,anon,authenticated;

create or replace function public.refresh_tournament(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare t tournaments;
begin
 select * into t from tournaments where id=p_id for update;
 if not found or t.status not in ('pending','published') then return; end if;
 update tournament_registrations set status='expired' where tournament_id=p_id and
   ((status='pending' and t.registration_deadline<=now()) or
    (status='approved' and paid_at is null and deposit_amount>0 and payment_expires_at<=now()));
 if t.status='published' and t.ends_at<=now() then update tournaments set status='completed' where id=p_id; end if;
end $$;
revoke all on function public.refresh_tournament(uuid) from public,anon,authenticated;


create or replace function public.submit_tournament(p_data jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid; court uuid:=nullif(p_data->>'court_id','')::uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not account_active() then raise exception 'ACCOUNT_BANNED'; end if;
  if court is not null and not exists(select 1 from courts c join venues v on v.id=c.venue_id join profiles p on p.id=v.owner_id
    where c.id=court and c.is_active and v.status='active' and v.owner_id=auth.uid() and p.owner_application_status='active') then raise exception 'FORBIDDEN'; end if;
  if (p_data->>'starts_at')::timestamp at time zone 'Asia/Ho_Chi_Minh' <= now()
    or (p_data->>'registration_deadline')::timestamp at time zone 'Asia/Ho_Chi_Minh' <= now() then raise exception 'TOURNAMENT_DATE_INVALID'; end if;
  insert into tournaments(manager_id,court_id,title,description,sport,address,starts_at,ends_at,registration_deadline,capacity,entry_fee,deposit_amount,payment_deadline,payment_hold_hours,cancel_window_hours)
  values(auth.uid(),court,trim(p_data->>'title'),trim(p_data->>'description'),(p_data->>'sport')::sport_type,trim(p_data->>'address'),
    (p_data->>'starts_at')::timestamp at time zone 'Asia/Ho_Chi_Minh', (p_data->>'ends_at')::timestamp at time zone 'Asia/Ho_Chi_Minh',
    (p_data->>'registration_deadline')::timestamp at time zone 'Asia/Ho_Chi_Minh', (p_data->>'capacity')::int,(p_data->>'entry_fee')::int,(p_data->>'deposit_amount')::int,
    coalesce(nullif(p_data->>'payment_deadline','')::timestamp at time zone 'Asia/Ho_Chi_Minh', (p_data->>'starts_at')::timestamp at time zone 'Asia/Ho_Chi_Minh'),
    coalesce((p_data->>'payment_hold_hours')::int,24),24)
  returning id into result;
  return result;
end $$;

create or replace function public.register_tournament(p_id uuid,p_data jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare t tournaments; r tournament_registrations; result uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not account_active() then raise exception 'ACCOUNT_BANNED'; end if;
  perform refresh_tournament(p_id);
  select * into t from tournaments where id=p_id for update;
  if not found or t.status<>'published' or t.registration_deadline<=now() then raise exception 'REGISTRATION_CLOSED'; end if;
  if (select count(*) from tournament_registrations where tournament_id=t.id and status='approved')>=t.capacity then raise exception 'TOURNAMENT_FULL'; end if;
  if exists(select 1 from tournament_registrations where tournament_id=t.id and user_id=auth.uid() and status in ('pending','approved')) then raise exception 'ALREADY_REGISTERED'; end if;
  insert into tournament_registrations(tournament_id,user_id,full_name,phone,address,team_name,note,entry_fee,deposit_amount,refund_deadline,code)
  values(t.id,auth.uid(),trim(p_data->>'full_name'),regexp_replace(regexp_replace(p_data->>'phone','[[:space:]().-]','','g'),'^\+84','0'),
    trim(p_data->>'address'),trim(coalesce(p_data->>'team_name','')),trim(coalesce(p_data->>'note','')),t.entry_fee,t.deposit_amount,t.starts_at-make_interval(hours=>t.cancel_window_hours),
    'GIAI'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))) returning id into result;
  return result;
end $$;

create or replace function public.review_tournament_registration(p_id uuid,p_approve boolean,p_note text default '')
returns void language plpgsql security definer set search_path=public as $$
declare r tournament_registrations; t tournaments; c sepay_connections; o booking_operator; v venues;
begin
  select * into r from tournament_registrations where id=p_id;
  if not found or not manages_tournament(r.tournament_id) then raise exception 'FORBIDDEN'; end if;
  perform refresh_tournament(r.tournament_id);
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
  update tournament_registrations set status='approved',payment_expires_at=least(now()+make_interval(hours=>t.payment_hold_hours),t.payment_deadline),payment_owner_id=v.owner_id,review_note=coalesce(trim(p_note),'') where id=r.id;
end $$;

create or replace function public.confirm_tournament_payment(p_ref_code text,p_amount int,p_bank_tx_id text,p_raw jsonb,p_connection_id uuid,p_receiver_bank text,p_receiver_account text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r tournament_registrations; t tournaments; tx text; v_outcome text; refund int:=0;
begin
  if p_amount is null or p_amount<=0 or coalesce(trim(p_bank_tx_id),'')='' then return jsonb_build_object('reason','INVALID_PAYMENT'); end if;
  select * into r from tournament_registrations where code=p_ref_code;
  if not found then return jsonb_build_object('reason','REF_NOT_FOUND'); end if;
  perform refresh_tournament(r.tournament_id);
  select * into t from tournaments where id=r.tournament_id for update;
  select * into r from tournament_registrations where id=r.id for update;
  if r.bank is null or r.connection_id is distinct from p_connection_id or lower(trim(r.bank)) is distinct from lower(trim(p_receiver_bank))
    or r.account_number is distinct from p_receiver_account then return jsonb_build_object('reason','WRONG_RECEIVER'); end if;
  tx:=lower(trim(r.bank))||':'||r.account_number||':'||p_bank_tx_id;
  insert into tournament_payment_events(transaction_key,registration_id,amount,raw) values(tx,r.id,p_amount,p_raw) on conflict do nothing;
  if not found then return jsonb_build_object('reason','ALREADY_PROCESSED'); end if;
  if r.paid_at is not null then v_outcome:='duplicate_payment'; refund:=p_amount;
  elsif r.status<>'approved' or t.status<>'published' or r.payment_expires_at<=now() then v_outcome:='late_or_cancelled'; refund:=p_amount;
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

create or replace function public.disconnect_sepay_connection(p_owner_id uuid,p_operation uuid)
returns void language plpgsql security definer set search_path=public as $$
declare c sepay_connections;
begin
  select * into c from sepay_connections where owner_id=p_owner_id and operation_token=p_operation and operation_expires_at>now() for update;
  if not found then raise exception 'CONNECTION_BUSY'; end if;
  if exists(select 1 from subscription_receiver where connection_id=c.id) then raise exception 'SUBSCRIPTION_RECEIVER_IN_USE'; end if;
  if exists(select 1 from bookings where payment_connection_id=c.id and status='pending' and expires_at>now())
    or exists(select 1 from tournament_registrations r join tournaments t on t.id=r.tournament_id
      where r.connection_id=c.id and r.status='approved' and r.paid_at is null and t.status='published' and r.payment_expires_at>now()) then raise exception 'PENDING_PAYMENTS'; end if;
  update sepay_connections set status='disconnected' where id=c.id;
end $$;

create or replace function public.get_tournament_capacity(p_id uuid)
returns int language sql stable security definer set search_path=public as $$
 select count(*)::int from tournament_registrations r join tournaments t on t.id=r.tournament_id
 where t.id=p_id and r.status='approved' and (r.paid_at is not null or r.deposit_amount=0 or r.payment_expires_at>now())
 and (t.status in ('published','completed') or manages_tournament(p_id));
$$;
drop policy tournament_read on public.tournaments;
create policy tournament_read on public.tournaments for select using(status in ('published','completed') or manager_id=auth.uid() or manages_tournament(id) or is_admin());


-- A new attempt gets a new row/code. Old payments and refund obligations remain attached to the old row.
create or replace function public.resubmit_tournament(p_id uuid,p_data jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare old_t tournaments; draft tournaments; temp_id uuid;
begin
 select * into old_t from tournaments where id=p_id for update;
 if not found or old_t.manager_id<>auth.uid() or not account_active() then raise exception 'FORBIDDEN'; end if;
 if old_t.status not in ('pending','rejected') then raise exception 'TOURNAMENT_NOT_EDITABLE'; end if;
 -- Reuse the same SQL validation as first submission, without publishing an intermediate proposal.
 temp_id:=submit_tournament(p_data);
 select * into draft from tournaments where id=temp_id;
 update tournaments set title=draft.title,description=draft.description,sport=draft.sport,court_id=draft.court_id,
 address=draft.address,starts_at=draft.starts_at,ends_at=draft.ends_at,registration_deadline=draft.registration_deadline,
 payment_deadline=draft.payment_deadline,payment_hold_hours=draft.payment_hold_hours,cancel_window_hours=draft.cancel_window_hours,
 capacity=draft.capacity,entry_fee=draft.entry_fee,deposit_amount=draft.deposit_amount,status='pending',review_note='',reviewed_by=null
 where id=p_id;
 delete from notifications where tournament_id=temp_id;
 delete from tournaments where id=temp_id;
 return p_id;
end $$;
revoke all on function public.resubmit_tournament(uuid,jsonb) from public,anon;
grant execute on function public.resubmit_tournament(uuid,jsonb) to authenticated;

create or replace function public.cancel_tournament_registration(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r tournament_registrations; t tournaments; self_cancel boolean;
begin
 if not account_active() then raise exception 'FORBIDDEN'; end if;
 select * into r from tournament_registrations where id=p_id;
 if not found or (r.user_id<>auth.uid() and not manages_tournament(r.tournament_id)) then raise exception 'FORBIDDEN'; end if;
 select * into t from tournaments where id=r.tournament_id for update;
 select * into r from tournament_registrations where id=p_id for update;
 if r.status not in ('pending','approved') then return; end if;
 -- Managers cancelling their own seat must obey the player policy, too.
 self_cancel:=r.user_id=auth.uid();
 if (self_cancel and t.starts_at<=now()) or t.status not in ('pending','published') or t.ends_at<=now() then raise exception 'TOURNAMENT_STARTED'; end if;
 update tournament_registrations set status='cancelled',cancelled_at=now(),cancellation_kind=case when self_cancel then 'self' else 'organizer' end,
   balance_refund_due=case when balance_received_at is not null then entry_fee-deposit_amount else 0 end
 where id=r.id;
 if not self_cancel or now()<=r.refund_deadline then
   update tournament_payment_events set refund_amount=amount,refund_status=case when refunded_amount=amount then 'done' else 'needed' end
   where registration_id=r.id;
 end if;
end $$;

create or replace function public.cancel_tournament(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare t tournaments;
begin
 if not manages_tournament(p_id) then raise exception 'FORBIDDEN'; end if;
 select * into t from tournaments where id=p_id for update;
 if t.status='cancelled' then return; end if;
 if t.status='completed' or t.ends_at<=now() then raise exception 'TOURNAMENT_STARTED'; end if;
 update tournaments set status='cancelled' where id=p_id;
 -- A cancelled tournament also refunds deposits forfeited by earlier individual cancellations.
 update tournament_registrations set status='cancelled',cancelled_at=now(),cancellation_kind='tournament',
   balance_refund_due=case when balance_received_at is not null then entry_fee-deposit_amount else 0 end
 where tournament_id=p_id and status in ('pending','approved','cancelled','expired');
 update tournament_payment_events e set refund_amount=e.amount,refund_status=case when e.refunded_amount=e.amount then 'done' else 'needed' end
 from tournament_registrations r where e.registration_id=r.id and r.tournament_id=p_id;
 delete from court_closures where tournament_id=p_id;
end $$;

-- Internal event notifications share the existing inbox and unread counter.
create or replace function public.notify_tournament_changes()
returns trigger language plpgsql security definer set search_path=public as $$
declare t tournaments; owner_id uuid; msg text; recipient uuid;
begin
 if tg_table_name='tournaments' then
   t:=new;
   if tg_op='INSERT' or (new.status='pending' and old.status is distinct from new.status) then
     for recipient in select id from profiles where role='admin' loop
       perform tournament_notice(recipient,t.id,'Có đề xuất giải cần duyệt',t.title);
     end loop;
   elsif old.status is distinct from new.status then
     msg:=case new.status when 'published' then 'Giải đã được duyệt' when 'rejected' then 'Đề xuất cần chỉnh sửa' when 'cancelled' then 'Giải đấu đã hủy' when 'completed' then 'Giải đã kết thúc — kiểm tra đối soát' else 'Giải đấu có cập nhật' end;
     for recipient in select t.manager_id union select v.owner_id from courts c join venues v on v.id=c.venue_id where c.id=t.court_id
       union select user_id from tournament_registrations where tournament_id=t.id loop
       perform tournament_notice(recipient,t.id,msg,t.title||case when t.review_note<>'' then ': '||t.review_note else '' end);
     end loop;
   end if;
 elsif tg_table_name='tournament_registrations' then
   select * into t from tournaments where id=new.tournament_id;
   select v.owner_id into owner_id from courts c join venues v on v.id=c.venue_id where c.id=t.court_id;
   if tg_op='INSERT' then
     for recipient in select t.manager_id union select owner_id loop
       perform tournament_notice(recipient,t.id,'Có đăng ký giải mới',new.full_name||' đăng ký '||t.title);
     end loop;
   elsif old.status is distinct from new.status then
     msg:=case new.status when 'approved' then case when new.deposit_amount=0 then 'Đăng ký đã được duyệt' else 'Đã duyệt — vui lòng đóng cọc' end
       when 'rejected' then 'Đăng ký chưa được chấp nhận' when 'cancelled' then 'Đăng ký đã hủy' when 'expired' then 'Đăng ký đã hết hạn' else 'Đăng ký có cập nhật' end;
     perform tournament_notice(new.user_id,t.id,msg,t.title||case when new.status='approved' and new.deposit_amount>0 then '. Đóng cọc trước '||to_char(new.payment_expires_at at time zone 'Asia/Ho_Chi_Minh','DD/MM/YYYY HH24:MI')||' (giờ Việt Nam).' else '. '||new.review_note end);
     if new.status in ('cancelled','expired') then
       for recipient in select t.manager_id union select owner_id loop perform tournament_notice(recipient,t.id,msg,new.full_name||' · '||t.title); end loop;
     end if;
   end if;
   if tg_op='UPDATE' and old.paid_at is null and new.paid_at is not null then
     for recipient in select new.user_id union select t.manager_id union select owner_id loop
       perform tournament_notice(recipient,t.id,'Đã nhận cọc giải đấu',new.full_name||' · '||t.title);
     end loop;
   end if;
 elsif tg_table_name='tournament_payment_events' then
   select tt.* into t from tournaments tt join tournament_registrations r on r.tournament_id=tt.id where r.id=new.registration_id;
   if new.refund_status='needed' and (old.refund_status is distinct from new.refund_status or old.refund_amount is distinct from new.refund_amount) then
     for recipient in select r.user_id from tournament_registrations r where r.id=new.registration_id union select r.payment_owner_id from tournament_registrations r where r.id=new.registration_id loop
       perform tournament_notice(recipient,t.id,'Có khoản cọc cần hoàn / đối soát',t.title||'. Mở giải để xem số tiền và giao dịch.');
     end loop;
   elsif new.refund_status='done' and old.refund_status is distinct from new.refund_status then
     select user_id into recipient from tournament_registrations where id=new.registration_id;
     perform tournament_notice(recipient,t.id,'Chủ sân đã xác nhận hoàn cọc',t.title||'. Kiểm tra tài khoản nhận tiền của bạn.');
   end if;
 end if;
 return new;
end $$;
revoke all on function public.notify_tournament_changes() from public,anon,authenticated;
create trigger tournament_notices after insert or update on public.tournaments for each row execute function public.notify_tournament_changes();
create trigger registration_notices after insert or update on public.tournament_registrations for each row execute function public.notify_tournament_changes();
create trigger tournament_payment_notices after update on public.tournament_payment_events for each row execute function public.notify_tournament_changes();

create or replace function public.process_tournament_deadlines()
returns void language plpgsql security definer set search_path=public as $$
declare t record; r record;
begin
 for t in select id from tournaments where status='published' order by id for update skip locked loop
   perform refresh_tournament(t.id);
   for r in update tournament_registrations set reminder_sent_at=now()
     where tournament_id=t.id and status='approved' and paid_at is null and deposit_amount>0 and reminder_sent_at is null
       and payment_expires_at>now() and payment_expires_at<=now()+interval '1 hour'
     returning * loop
     perform tournament_notice(r.user_id,t.id,'Sắp hết hạn đóng cọc giải đấu','Mở giải để đóng cọc trước '||to_char(r.payment_expires_at at time zone 'Asia/Ho_Chi_Minh','DD/MM/YYYY HH24:MI')||' (giờ Việt Nam).');
   end loop;
 end loop;
end $$;
revoke all on function public.process_tournament_deadlines() from public,anon,authenticated,service_role;
select cron.schedule('tournament-deadlines','* * * * *','select public.process_tournament_deadlines()');
notify pgrst,'reload schema';
create function public.get_tournament_proposal(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare t tournaments;
begin
 select * into t from tournaments where id=p_id and manager_id=auth.uid();
 if not found or not account_active() or t.status not in ('pending','rejected') then raise exception 'TOURNAMENT_NOT_EDITABLE'; end if;
 return to_jsonb(t)||jsonb_build_object(
 'starts_at',to_char(t.starts_at at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD"T"HH24:MI'),
 'ends_at',to_char(t.ends_at at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD"T"HH24:MI'),
 'registration_deadline',to_char(t.registration_deadline at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD"T"HH24:MI'),
 'payment_deadline',to_char(t.payment_deadline at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD"T"HH24:MI'));
end $$;
revoke all on function public.get_tournament_proposal(uuid) from public,anon;
grant execute on function public.get_tournament_proposal(uuid) to authenticated;

-- Reads show logical expiry immediately, without waiting for the one-minute cleanup job.
create function public.get_tournament_registrations(p_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('status',case
   when r.status='pending' and t.registration_deadline<=now() then 'expired'
   when r.status='approved' and r.deposit_amount>0 and r.paid_at is null and r.payment_expires_at<=now() then 'expired'
   else r.status end) order by r.created_at desc,r.id desc),'[]'::jsonb)
 from tournament_registrations r join tournaments t on t.id=r.tournament_id
 where r.tournament_id=p_id and auth.uid() is not null and (r.user_id=auth.uid() or manages_tournament(p_id));
$$;
create function public.get_my_tournament_registrations(p_page int default 1)
returns jsonb language sql stable security definer set search_path=public as $$
 with latest as (
   select distinct on(r.tournament_id) r.id,r.tournament_id,r.status,r.paid_at,r.deposit_amount,r.payment_expires_at,r.created_at,t.title,t.registration_deadline
   from tournament_registrations r join tournaments t on t.id=r.tournament_id where r.user_id=auth.uid()
   order by r.tournament_id,r.created_at desc,r.id desc
 ) select jsonb_build_object('total',(select count(*) from latest),'rows',coalesce((select jsonb_agg(to_jsonb(x)) from (
   select id,tournament_id,case when status='pending' and registration_deadline<=now() then 'expired'
     when status='approved' and deposit_amount>0 and paid_at is null and payment_expires_at<=now() then 'expired' else status end as status,
     paid_at,deposit_amount,title from latest order by created_at desc,id desc limit 12 offset (greatest(1,least(coalesce(p_page,1),10000))-1)*12
 ) x),'[]'::jsonb));
$$;
revoke all on function public.get_tournament_registrations(uuid),public.get_my_tournament_registrations(int) from public,anon;
grant execute on function public.get_tournament_registrations(uuid),public.get_my_tournament_registrations(int) to authenticated;
