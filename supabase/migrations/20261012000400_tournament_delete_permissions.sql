-- Admin can permanently remove any tournament. Only owners keep the financial guard.
create or replace function public.delete_tournament(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare t tournaments; admin boolean:=is_admin();
begin
  if not admin and not (account_active() and exists(
    select 1 from profiles where id=auth.uid() and role='owner'
  )) then raise exception 'FORBIDDEN'; end if;
  select * into t from tournaments where id=p_id for update;
  if not found then raise exception 'TOURNAMENT_NOT_FOUND'; end if;
  if not admin and t.manager_id is distinct from auth.uid() and not exists(
    select 1 from courts c join venues v on v.id=c.venue_id
    where c.id=t.court_id and v.owner_id=auth.uid()
  ) then raise exception 'FORBIDDEN'; end if;

  -- Payment/registration/settlement writers use the same parent lock.
  -- Owners must preserve even expired QR references for late transfers.
  if not admin and (
    exists(select 1 from tournament_registrations r where r.tournament_id=p_id
      and ((r.deposit_amount>0 and r.bank is not null) or r.paid_at is not null
        or r.balance_received_at is not null or r.balance_refund_due>0 or r.balance_refunded_at is not null))
    or exists(select 1 from tournament_payment_events e join tournament_registrations r on r.id=e.registration_id where r.tournament_id=p_id)
    or exists(select 1 from tournament_transfers where tournament_id=p_id)
    or exists(select 1 from tournament_settlements where tournament_id=p_id
      and (venue_fee is null or venue_fee>0 or cancellation_venue_fee>0))
  ) then raise exception 'TOURNAMENT_HAS_FINANCIAL_HISTORY'; end if;

  -- Stop publication before releasing the reserved court.
  update tournaments set status='cancelled',cancelled_by=auth.uid() where id=p_id;
  update notifications set tournament_id=null where tournament_id=p_id;
  insert into notifications(user_id,kind,channel,title,body)
    select affected.user_id,'tournament','app','Giải đấu đã được xóa',
      (case when admin then 'Admin' else 'Chủ sân' end)||' đã xóa giải “'||t.title||'”. Danh sách đăng ký đã được xóa và lịch sân đã được mở lại.'
    from (
      select t.manager_id as user_id
      union select user_id from tournament_registrations where tournament_id=p_id
      union select v.owner_id from courts c join venues v on v.id=c.venue_id where c.id=t.court_id
    ) affected;
  delete from court_closures where tournament_id=p_id;
  -- Keep bank receipts and retry protection across all payment flows.
  delete from tournament_payment_events where registration_id in
    (select id from tournament_registrations where tournament_id=p_id);
  delete from tournament_transfers where tournament_id=p_id;
  delete from tournament_registrations where tournament_id=p_id;
  delete from tournament_settlements where tournament_id=p_id;
  delete from tournaments where id=p_id;
end $$;

revoke all on function public.delete_tournament(uuid) from public,anon,authenticated;
grant execute on function public.delete_tournament(uuid) to authenticated;
notify pgrst,'reload schema';
