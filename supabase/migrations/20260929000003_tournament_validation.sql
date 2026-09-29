-- Direct RPC callers must not persist dates that cannot be displayed or unbounded social links.
alter table public.tournaments add constraint tournament_finite_dates
  check(isfinite(starts_at) and isfinite(ends_at) and isfinite(registration_deadline));
alter table public.community_profiles add constraint community_facebook_length check(length(facebook_url)<=300);
