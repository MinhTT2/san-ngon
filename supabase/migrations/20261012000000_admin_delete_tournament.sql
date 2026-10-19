-- Admin may remove unused proposals/fixtures, without losing payment references.
create or replace function public.delete_tournament(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare t tournaments;
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into t from tournaments where id=p_id for update;
  if not found then raise exception 'TOURNAMENT_NOT_FOUND'; end if;
  -- All registration, payment and settlement writers take this same parent lock.
  -- Keep even expired/cancelled QR references: late transfers still need refunds.
  if exists(select 1 from tournament_registrations r where r.tournament_id=p_id
      and ((r.deposit_amount>0 and r.bank is not null) or r.paid_at is not null
        or r.balance_received_at is not null or r.balance_refund_due>0 or r.balance_refunded_at is not null))
    or exists(select 1 from tournament_payment_events e join tournament_registrations r on r.id=e.registration_id where r.tournament_id=p_id)
    or exists(select 1 from tournament_transfers where tournament_id=p_id)
    or exists(select 1 from tournament_settlements where tournament_id=p_id
      and (venue_fee is null or venue_fee>0 or cancellation_venue_fee>0))
  then raise exception 'TOURNAMENT_HAS_FINANCIAL_HISTORY'; end if;

  -- The closure guard only allows removing reservations after unpublishing.
  update tournaments set status='cancelled',cancelled_by=auth.uid() where id=p_id;
  -- Detach after the status change, including notices created by its trigger.
  update notifications set tournament_id=null where tournament_id=p_id;
  insert into notifications(user_id,kind,channel,title,body)
    select affected.user_id,'tournament','app','Giải đấu đã được xóa',
      'Admin đã xóa giải “'||t.title||'”. Danh sách đăng ký đã được xóa và lịch sân đã được mở lại.'
    from (
      select t.manager_id as user_id
      union select user_id from tournament_registrations where tournament_id=p_id
      union select v.owner_id from courts c join venues v on v.id=c.venue_id where c.id=t.court_id
    ) affected;
  delete from court_closures where tournament_id=p_id;
  delete from tournament_registrations where tournament_id=p_id;
  delete from tournament_settlements where tournament_id=p_id;
  delete from tournaments where id=p_id;
end $$;

revoke all on function public.delete_tournament(uuid) from public,anon,authenticated;
grant execute on function public.delete_tournament(uuid) to authenticated;
notify pgrst,'reload schema';
