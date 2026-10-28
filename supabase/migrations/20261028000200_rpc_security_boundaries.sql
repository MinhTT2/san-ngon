-- Pin helpers to trusted built-ins, independent of the caller's search_path.
-- ALTER/CREATE OR REPLACE preserve existing ownership, dependencies and ACLs.
alter function public.gen_booking_code() set search_path = pg_catalog;
alter function public.unaccent_vi(text) set search_path = pg_catalog;
create or replace function public.slugify(p_text text)
returns text language sql immutable set search_path = pg_catalog as $$
  select trim(both '-' from regexp_replace(
    lower(public.unaccent_vi(p_text)), '[^a-z0-9]+', '-', 'g'));
$$;

-- These RPCs already check the session/owner internally. Anonymous callers
-- should also be rejected at the function boundary. Keep signed-in access.
revoke execute on function
  public.register_owner(text,text,text,text,text,text),
  public.create_venue(text,text,text,text,text,time,time,jsonb),
  public.update_venue(uuid,text,text,text,text,text,time,time,int,int),
  public.delete_venue(uuid),
  public.create_court(uuid,text,public.sport_type,text,boolean,int,time,time,int),
  public.update_court(uuid,text,public.sport_type,text,boolean,int,time,time,boolean,int),
  public.delete_court(uuid),
  public.get_owner_stats(uuid,date,date)
from public, anon;
grant execute on function
  public.register_owner(text,text,text,text,text,text),
  public.create_venue(text,text,text,text,text,time,time,jsonb),
  public.update_venue(uuid,text,text,text,text,text,time,time,int,int),
  public.delete_venue(uuid),
  public.create_court(uuid,text,public.sport_type,text,boolean,int,time,time,int),
  public.update_court(uuid,text,public.sport_type,text,boolean,int,time,time,boolean,int),
  public.delete_court(uuid),
  public.get_owner_stats(uuid,date,date)
to authenticated;

-- Trigger functions are executed by existing triggers, never as browser RPCs.
-- Do not revoke public read/RLS helpers or the Telegram linking endpoint.
revoke execute on function
  public.check_booking_court_open(),
  public.handle_new_user(),
  public.notify_owner_application_submitted(),
  public.reject_banned_write(),
  public.require_active_venue_court(),
  public.require_active_venue_has_court(),
  public.require_profile_payout_for_active_venues(),
  public.require_venue_payout(),
  public.require_venue_photos_before_publish(),
  public.validate_venue_fields()
from public, anon, authenticated;
