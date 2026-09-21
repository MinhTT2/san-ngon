-- Admin dashboard: đọc dữ liệu vận hành và duyệt hồ sơ qua RLS.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists profiles_admin_read on profiles;
create policy profiles_admin_read on profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists venues_admin_read on venues;
create policy venues_admin_read on venues for select
  using (status = 'active' or owner_id = auth.uid() or public.is_admin());

drop policy if exists venues_admin_update on venues;
create policy venues_admin_update on venues for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists courts_admin_read on courts;
create policy courts_admin_read on courts for select
  using (exists (select 1 from venues v where v.id = venue_id and (v.status = 'active' or v.owner_id = auth.uid() or public.is_admin())));

drop policy if exists bookings_admin_read on bookings;
create policy bookings_admin_read on bookings for select
  using (user_id = auth.uid() or owns_court(court_id) or public.is_admin());
