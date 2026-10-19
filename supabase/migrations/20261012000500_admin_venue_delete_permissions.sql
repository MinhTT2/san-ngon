-- Match permanent admin tournament deletion; owner CRUD keeps its history guard.
-- Support receipts remain accessible after their order is permanently deleted.
alter table public.feedback add column deleted_booking_code text;
alter table public.feedback drop constraint feedback_receipt_booking;
alter table public.feedback add constraint feedback_receipt_booking
  check (receipt_path is null or booking_id is not null or deleted_booking_code is not null);

create or replace function public.admin_delete_venue(p_venue_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.venues; tournament_id uuid;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v from public.venues where id = p_venue_id for update;
  if not found then raise exception 'VENUE_NOT_FOUND'; end if;
  -- Serialize with booking creation and prevent new references during cleanup.
  perform 1 from public.courts where venue_id = p_venue_id order by id for update;
  perform 1 from public.bookings b join public.courts c on c.id = b.court_id
    where c.venue_id = p_venue_id order by b.id for update of b;

  -- Reuse tournament deletion for registrations, settlement and protected closures.
  for tournament_id in
    select t.id from public.tournaments t join public.courts c on c.id = t.court_id
    where c.venue_id = p_venue_id order by t.id
  loop
    perform public.delete_tournament(tournament_id);
  end loop;

  -- Keep notices, support requests and durable bank receipts after removing orders.
  update public.notifications set booking_id = null where booking_id in
    (select b.id from public.bookings b join public.courts c on c.id=b.court_id where c.venue_id=p_venue_id);
  update public.feedback f set booking_id = null, deleted_booking_code = b.code
    from public.bookings b join public.courts c on c.id=b.court_id
    where f.booking_id=b.id and c.venue_id=p_venue_id;
  update public.incoming_transfers set booking_id = null where booking_id in
    (select b.id from public.bookings b join public.courts c on c.id=b.court_id where c.venue_id=p_venue_id);
  insert into public.notifications(user_id,kind,channel,title,body)
    select affected.user_id,'new_booking','app','Cụm sân đã được xóa',
      'Admin đã xóa cụm sân “'||v.name||'” cùng các đơn đặt liên quan. Không chuyển thêm tiền theo mã đơn cũ. Liên hệ chủ sân để đối soát các khoản đã chuyển; thao tác xóa không tự hoàn tiền.'
    from (
      select v.owner_id as user_id
      union select b.user_id from public.bookings b join public.courts c on c.id=b.court_id where c.venue_id=p_venue_id
    ) affected;
  -- sepay_transfer_claims and incoming_transfers retain receipt/retry identities.
  delete from public.sepay_events where booking_id in
    (select b.id from public.bookings b join public.courts c on c.id=b.court_id where c.venue_id=p_venue_id);
  -- Payments and booking requests cascade; courts, prices and favorites follow.
  delete from public.bookings where court_id in (select id from public.courts where venue_id=p_venue_id);
  delete from public.venues where id=p_venue_id;
end $$;

revoke all on function public.admin_delete_venue(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_venue(uuid) to authenticated;
notify pgrst, 'reload schema';
