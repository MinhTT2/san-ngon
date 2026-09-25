-- One receiving bank account means one booking operator until SePay approves OAuth.
-- This is a demo guard, not multi-account payment infrastructure.
create table public.booking_operator (
  singleton boolean primary key default true check (singleton),
  owner_id uuid not null references public.profiles(id) on delete restrict
);
alter table public.booking_operator enable row level security;
revoke all on public.booking_operator from public, anon, authenticated;

-- Preserve the existing operator only when unambiguous. Otherwise configure in SQL.
insert into public.booking_operator (owner_id)
select owner_id from public.venues where status = 'active' group by owner_id
having (select count(distinct owner_id) from public.venues where status = 'active') = 1;

create function public.venue_accepts_bookings(p_venue_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.venues v join public.booking_operator o on o.owner_id = v.owner_id
    where v.id = p_venue_id and v.status = 'active'
  );
$$;
revoke all on function public.venue_accepts_bookings(uuid) from public;
grant execute on function public.venue_accepts_bookings(uuid) to anon, authenticated;

create function public.require_booking_operator()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.venue_accepts_bookings((select venue_id from public.courts where id = new.court_id)) then
    raise exception 'VENUE_NOT_ACCEPTING_BOOKINGS';
  end if;
  return new;
end;
$$;
revoke all on function public.require_booking_operator() from public, anon, authenticated;
create trigger bookings_require_operator
before insert or update of court_id on public.bookings
for each row execute function public.require_booking_operator();

comment on table public.booking_operator is
  'One demo owner, configured only through trusted SQL. Do not enable multiple receivers before SePay OAuth approval.';
notify pgrst, 'reload schema';
