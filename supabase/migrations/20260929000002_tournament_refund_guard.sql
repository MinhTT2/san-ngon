-- A stale refund screen must not mark a larger refund paid after a concurrent cancellation.
drop function public.mark_tournament_refund(text);
create function public.mark_tournament_refund(p_transaction_key text,p_expected_amount int)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not account_active() then raise exception 'FORBIDDEN'; end if;
  update tournament_payment_events e set refund_status='done',refunded_amount=e.refund_amount from tournament_registrations r
    where e.registration_id=r.id and e.transaction_key=p_transaction_key and e.refund_status='needed'
      and e.refund_amount-e.refunded_amount=p_expected_amount
      and (r.payment_owner_id=auth.uid() or is_admin());
  if not found then raise exception 'REFUND_CHANGED_OR_FORBIDDEN'; end if;
end $$;
revoke all on function public.mark_tournament_refund(text,int) from public,anon;
grant execute on function public.mark_tournament_refund(text,int) to authenticated;
notify pgrst,'reload schema';
