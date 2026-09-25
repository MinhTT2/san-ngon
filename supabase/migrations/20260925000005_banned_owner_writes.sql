-- These tables were added after the account-ban guard. SECURITY DEFINER RPCs
-- bypass RLS, so enforce the same write guard at the table boundary.
create trigger reject_banned_write before insert or update or delete on public.court_closures
  for each row execute function public.reject_banned_write();
create trigger reject_banned_write before insert or update or delete on public.subscription_invoices
  for each row execute function public.reject_banned_write();

create policy active_account on public.court_closures as restrictive to authenticated
  using (public.account_active()) with check (public.account_active());
create policy active_account on public.owner_subscriptions as restrictive to authenticated
  using (public.account_active()) with check (public.account_active());
create policy active_account on public.subscription_invoices as restrictive to authenticated
  using (public.account_active()) with check (public.account_active());
