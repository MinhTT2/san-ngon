-- Admin deletion is separate from owner CRUD and preserves operating history.
create function public.admin_delete_venue(p_venue_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  perform 1 from public.venues where id = p_venue_id for update;
  if not found then raise exception 'VENUE_NOT_FOUND'; end if;
  -- Lock children too: booking creation and tournament publication use court locks.
  perform 1 from public.courts where venue_id = p_venue_id order by id for update;
  if exists (
    select 1 from public.bookings b join public.courts c on c.id = b.court_id
    where c.venue_id = p_venue_id
  ) then raise exception 'VENUE_HAS_BOOKINGS'; end if;
  if exists (
    select 1 from public.tournaments t join public.courts c on c.id = t.court_id
    where c.venue_id = p_venue_id
  ) then raise exception 'VENUE_HAS_TOURNAMENTS'; end if;
  delete from public.venues where id = p_venue_id;
end $$;

revoke all on function public.admin_delete_venue(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_venue(uuid) to authenticated;
notify pgrst, 'reload schema';
