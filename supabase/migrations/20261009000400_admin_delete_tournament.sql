-- Keep registration and financial history; only remove tournaments without obligations.
create function public.delete_tournament(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;
  perform 1 from tournaments where id=p_id for update;
  if not found then raise exception 'TOURNAMENT_NOT_FOUND'; end if;
  if exists(select 1 from tournament_registrations where tournament_id=p_id) then
    raise exception 'TOURNAMENT_HAS_REGISTRATIONS';
  end if;
  if exists(select 1 from tournament_transfers where tournament_id=p_id)
    or exists(select 1 from tournament_settlements where tournament_id=p_id
      and (venue_fee is null or venue_fee>0 or cancellation_venue_fee>0)) then
    raise exception 'TOURNAMENT_HAS_SETTLEMENT';
  end if;
  -- The closure guard requires the tournament to stop being published first.
  update tournaments set status='cancelled',cancelled_by=auth.uid() where id=p_id and status='published';
  delete from court_closures where tournament_id=p_id;
  delete from notifications where tournament_id=p_id;
  delete from tournament_settlements where tournament_id=p_id;
  delete from tournaments where id=p_id;
end $$;

revoke all on function public.delete_tournament(uuid) from public,anon,authenticated;

grant execute on function public.delete_tournament(uuid) to authenticated;

notify pgrst,'reload schema';
