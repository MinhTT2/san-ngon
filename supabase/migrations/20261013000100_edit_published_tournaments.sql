-- Published edits preserve registration snapshots and admin-approved rental terms.
create or replace function public.get_tournament_proposal(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare t tournaments; can_change boolean;
begin
 select * into t from tournaments where id=p_id and manager_id=auth.uid();
 if not found or not account_active() or t.status not in ('pending','rejected','published')
   or (t.status='published' and t.starts_at<=now()) then raise exception 'TOURNAMENT_NOT_EDITABLE'; end if;
 can_change:=t.status<>'published' or (
   not exists(select 1 from tournament_registrations where tournament_id=t.id)
   and exists(select 1 from courts c join venues v on v.id=c.venue_id
     join tournament_settlements s on s.tournament_id=t.id
     where c.id=t.court_id and v.owner_id=auth.uid() and s.owner_id=auth.uid() and s.venue_fee=0));
 return to_jsonb(t)||jsonb_build_object('can_change_structure',can_change,
 'starts_at',to_char(t.starts_at at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD"T"HH24:MI'),
 'ends_at',to_char(t.ends_at at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD"T"HH24:MI'),
 'registration_deadline',to_char(t.registration_deadline at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD"T"HH24:MI'),
 'payment_deadline',to_char(t.payment_deadline at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD"T"HH24:MI'));
end $$;

create function public.update_published_tournament(p_id uuid,p_data jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare t tournaments; n tournaments; c courts; v venues; has_registrations boolean;
 structural_change boolean; own_court boolean; recipient uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not account_active() then raise exception 'ACCOUNT_BANNED'; end if;
 select * into t from tournaments where id=p_id for update;
 if not found or t.manager_id<>auth.uid() then raise exception 'FORBIDDEN'; end if;
 if t.status<>'published' or t.starts_at<=now() then raise exception 'TOURNAMENT_NOT_EDITABLE'; end if;
 perform refresh_tournament(p_id);
 n:=t;
 n.title:=trim(p_data->>'title'); n.description:=trim(p_data->>'description');
 n.cover_path:=nullif(p_data->>'cover_path',''); n.sport:=(p_data->>'sport')::sport_type;
 n.court_id:=nullif(p_data->>'court_id','')::uuid;
 n.starts_at:=(p_data->>'starts_at')::timestamp at time zone 'Asia/Ho_Chi_Minh';
 n.ends_at:=(p_data->>'ends_at')::timestamp at time zone 'Asia/Ho_Chi_Minh';
 n.registration_deadline:=(p_data->>'registration_deadline')::timestamp at time zone 'Asia/Ho_Chi_Minh';
 n.payment_deadline:=(p_data->>'payment_deadline')::timestamp at time zone 'Asia/Ho_Chi_Minh';
 n.payment_hold_hours:=(p_data->>'payment_hold_hours')::int;
 n.capacity:=(p_data->>'capacity')::int; n.entry_fee:=(p_data->>'entry_fee')::int;
 n.deposit_amount:=(p_data->>'deposit_amount')::int;
 has_registrations:=exists(select 1 from tournament_registrations where tournament_id=p_id);
 own_court:=exists(select 1 from courts ct join venues vv on vv.id=ct.venue_id
   join tournament_settlements s on s.tournament_id=p_id
   where ct.id=t.court_id and vv.owner_id=auth.uid() and s.owner_id=auth.uid() and s.venue_fee=0);
 structural_change:=row(n.court_id,n.sport,n.starts_at,n.ends_at,n.entry_fee,n.deposit_amount,n.payment_hold_hours)
   is distinct from row(t.court_id,t.sport,t.starts_at,t.ends_at,t.entry_fee,t.deposit_amount,t.payment_hold_hours);
 if structural_change and (has_registrations or not own_court) then raise exception 'TOURNAMENT_DETAILS_LOCKED'; end if;
 if n.starts_at<=now() then raise exception 'TOURNAMENT_START_PAST'; end if;
 if n.ends_at<=n.starts_at then raise exception 'TOURNAMENT_END_INVALID'; end if;
 if n.payment_deadline>n.starts_at then raise exception 'TOURNAMENT_PAYMENT_INVALID'; end if;
 if n.registration_deadline>n.payment_deadline then raise exception 'TOURNAMENT_REGISTRATION_INVALID'; end if;
 if (has_registrations or not own_court) and (n.registration_deadline<t.registration_deadline or n.payment_deadline<t.payment_deadline)
   then raise exception 'TOURNAMENT_DEADLINES_LOCKED'; end if;
 if n.registration_deadline is distinct from t.registration_deadline and n.registration_deadline<=now()
   then raise exception 'TOURNAMENT_REGISTRATION_PAST'; end if;
 if n.capacity<(select count(*) from tournament_registrations where tournament_id=p_id and status in ('pending','approved'))
   then raise exception 'TOURNAMENT_CAPACITY_TOO_SMALL'; end if;
 if n.cover_path is not null then
   if n.cover_path !~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') then raise exception 'TOURNAMENT_IMAGE_INVALID'; end if;
   perform 1 from storage.objects o where o.bucket_id='tournament-photos' and o.name=n.cover_path
     and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')
     and (o.metadata->>'size')::bigint between 1 and 5242880 for share;
   if not found then raise exception 'TOURNAMENT_IMAGE_INVALID'; end if;
 end if;
 if structural_change then
   if n.court_id is null then raise exception 'COURT_REQUIRED'; end if;
   -- Booking and closure writers take these same court locks; lock in ID order.
   perform 1 from courts where id in (t.court_id,n.court_id) order by id for update;
   select * into c from courts where id=n.court_id and is_active;
   if not found or c.sport<>n.sport then raise exception 'COURT_INVALID'; end if;
   select * into v from venues where id=c.venue_id;
   if v.owner_id<>auth.uid() or v.status<>'active' or not exists(select 1 from profiles where id=auth.uid() and owner_application_status='active')
     then raise exception 'FORBIDDEN'; end if;
   if not venue_accepts_bookings(v.id) then raise exception 'RECEIVER_NOT_READY'; end if;
   if exists(select 1 from bookings b where b.court_id=c.id and (b.status='confirmed' or (b.status='pending' and b.expires_at>now()))
     and tstzrange(b.starts_at,b.ends_at) && tstzrange(n.starts_at,n.ends_at)) then raise exception 'SLOT_TAKEN'; end if;
   update court_closures set court_id=c.id,starts_at=n.starts_at,ends_at=n.ends_at,reason='Giải đấu: '||n.title where tournament_id=p_id;
   if not found then raise exception 'TOURNAMENT_NOT_EDITABLE'; end if;
   n.address:=v.address;
   update tournament_settlements set due_at=n.ends_at+interval '7 days' where tournament_id=p_id;
 else
   update court_closures set reason='Giải đấu: '||n.title where tournament_id=p_id;
 end if;
 update tournaments set title=n.title,description=n.description,cover_path=n.cover_path,sport=n.sport,court_id=n.court_id,
   address=n.address,starts_at=n.starts_at,ends_at=n.ends_at,registration_deadline=n.registration_deadline,
   payment_deadline=n.payment_deadline,payment_hold_hours=n.payment_hold_hours,
   capacity=n.capacity,entry_fee=n.entry_fee,deposit_amount=n.deposit_amount where id=p_id;
 if n is distinct from t then
   for recipient in select user_id from tournament_registrations where tournament_id=p_id and status in ('pending','approved')
     union select vv.owner_id from courts ct join venues vv on vv.id=ct.venue_id where ct.id=n.court_id loop
     perform tournament_notice(recipient,p_id,'Thông tin giải đấu đã cập nhật',n.title||'. Mở giải để xem thông tin mới. Cọc, hạn thanh toán và quyền hoàn của suất đã đăng ký được giữ nguyên.');
   end loop;
 end if;
 return p_id;
exception when exclusion_violation then raise exception 'SLOT_TAKEN';
end $$;
revoke all on function public.update_published_tournament(uuid,jsonb) from public,anon;
grant execute on function public.update_published_tournament(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
