-- Owners publish at their own courts; player proposals still require admin approval.
-- Keep proposal validation shared with resubmission, but never expose the draft writer.
create or replace function public.create_tournament_proposal(p_data jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid; court uuid:=nullif(p_data->>'court_id','')::uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not account_active() then raise exception 'ACCOUNT_BANNED'; end if;
  if court is null and exists(select 1 from profiles where id=auth.uid() and role='owner') then raise exception 'COURT_REQUIRED'; end if;
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
revoke all on function public.create_tournament_proposal(jsonb) from public,anon,authenticated;

create or replace function public.review_tournament(p_id uuid,p_approve boolean,p_court_id uuid,p_note text default '',p_venue_fee int default null,p_terms_note text default '',p_terms_confirmed boolean default false,p_cancellation_venue_fee int default 0)
returns void language plpgsql security definer set search_path=public as $$
declare t tournaments; c courts; v venues; own_court boolean;
begin
  if not account_active() then raise exception 'FORBIDDEN'; end if;
  -- Owners may publish only their own proposal at their own verified venue.
  select exists(
      select 1 from tournaments tt join courts cc on cc.id=p_court_id
      join venues vv on vv.id=cc.venue_id join profiles pp on pp.id=vv.owner_id
      where tt.id=p_id and tt.manager_id=auth.uid() and vv.owner_id=auth.uid()
        and pp.owner_application_status='active'
    ) into own_court;
  if not is_admin() and (p_approve is distinct from true or not own_court) then raise exception 'FORBIDDEN'; end if;
  if p_approve and own_court then
    p_venue_fee:=0;
    p_cancellation_venue_fee:=0;
    p_terms_note:='Chủ sân tự tổ chức tại sân của mình; tự thu và hoàn lệ phí, không quyết toán giữa hai bên.';
    p_terms_confirmed:=true;
    p_note:='';
  end if;
  if p_approve is null then raise exception 'INVALID_INPUT'; end if;
  select * into t from tournaments where id=p_id for update;
  if not found or t.status<>'pending' then raise exception 'TOURNAMENT_NOT_PENDING'; end if;
  if p_approve then
    if p_cancellation_venue_fee is null or p_cancellation_venue_fee<0 or p_cancellation_venue_fee>p_venue_fee or p_terms_confirmed is distinct from true or p_venue_fee is null or p_venue_fee<0 or p_venue_fee>100000000 or length(trim(coalesce(p_terms_note,'')))<10 then raise exception 'TERMS_REQUIRED'; end if;
    select * into c from courts where id=p_court_id and is_active for update;
    if not found or c.sport<>t.sport then raise exception 'COURT_INVALID'; end if;
    select * into v from venues where id=c.venue_id;
    if v.status<>'active' or t.registration_deadline<=now() then raise exception 'TOURNAMENT_DATE_INVALID'; end if;
    if not venue_accepts_bookings(v.id) then raise exception 'RECEIVER_NOT_READY'; end if;
    if exists(select 1 from bookings b where b.court_id=c.id and (b.status='confirmed' or (b.status='pending' and b.expires_at>now()))
      and tstzrange(b.starts_at,b.ends_at) && tstzrange(t.starts_at,t.ends_at)) then raise exception 'SLOT_TAKEN'; end if;
    insert into court_closures(court_id,starts_at,ends_at,reason,tournament_id) values(c.id,t.starts_at,t.ends_at,'Giải đấu: '||t.title,t.id);
    insert into tournament_settlements(tournament_id,owner_id,venue_fee,cancellation_venue_fee,terms_note,agreed_by,agreed_at,due_at)
    values(t.id,v.owner_id,p_venue_fee,p_cancellation_venue_fee,trim(p_terms_note),auth.uid(),now(),t.ends_at+interval '7 days');
    update tournaments set status='published',court_id=c.id,address=v.address,reviewed_by=auth.uid(),review_note=coalesce(trim(p_note),'') where id=t.id;
  else
    if length(trim(coalesce(p_note,'')))<3 then raise exception 'REVIEW_NOTE_REQUIRED'; end if;
    update tournaments set status='rejected',reviewed_by=auth.uid(),review_note=trim(p_note) where id=t.id;
  end if;
exception when exclusion_violation then raise exception 'SLOT_TAKEN';
end $$;

create or replace function public.submit_tournament(p_data jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid; court uuid:=nullif(p_data->>'court_id','')::uuid;
begin
  result:=create_tournament_proposal(p_data);
  if court is not null then perform review_tournament(result,true,court); end if;
  return result;
end $$;

create or replace function public.resubmit_tournament(p_id uuid,p_data jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare old_t tournaments; draft tournaments; temp_id uuid;
begin
 select * into old_t from tournaments where id=p_id for update;
 if not found or old_t.manager_id<>auth.uid() or not account_active() then raise exception 'FORBIDDEN'; end if;
 if old_t.status not in ('pending','rejected') then raise exception 'TOURNAMENT_NOT_EDITABLE'; end if;
 -- Reuse the same SQL validation as first submission, without publishing an intermediate proposal.
 temp_id:=create_tournament_proposal(p_data);
 select * into draft from tournaments where id=temp_id;
 update tournaments set title=draft.title,description=draft.description,sport=draft.sport,court_id=draft.court_id,
 address=draft.address,starts_at=draft.starts_at,ends_at=draft.ends_at,registration_deadline=draft.registration_deadline,
 payment_deadline=draft.payment_deadline,payment_hold_hours=draft.payment_hold_hours,cancel_window_hours=draft.cancel_window_hours,
 capacity=draft.capacity,entry_fee=draft.entry_fee,deposit_amount=draft.deposit_amount,status='pending',review_note='',reviewed_by=null
 where id=p_id;
 delete from notifications where tournament_id=temp_id;
 delete from tournaments where id=temp_id;
 if draft.court_id is not null then perform review_tournament(p_id,true,draft.court_id); end if;
 return p_id;
end $$;

create or replace function public.notify_tournament_changes()
returns trigger language plpgsql security definer set search_path=public as $$
declare t tournaments; owner_id uuid; msg text; recipient uuid;
begin
 if tg_table_name='tournaments' then
   t:=new;
   if new.status='pending' and new.court_id is null and (tg_op='INSERT' or old.status is distinct from new.status) then
     for recipient in select id from profiles where role='admin' loop
       perform tournament_notice(recipient,t.id,'Có đề xuất giải cần duyệt',t.title);
     end loop;
   elsif tg_op='UPDATE' and old.status is distinct from new.status then
     msg:=case new.status when 'published' then 'Giải đã được công khai' when 'rejected' then 'Đề xuất cần chỉnh sửa' when 'cancelled' then 'Giải đấu đã hủy' when 'completed' then 'Giải đã kết thúc — kiểm tra đối soát' else 'Giải đấu có cập nhật' end;
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

notify pgrst,'reload schema';
