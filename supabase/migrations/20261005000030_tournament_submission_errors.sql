-- Keep publication atomic; return actionable date errors from the server clock.
create or replace function public.create_tournament_proposal(p_data jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid; court uuid:=nullif(p_data->>'court_id','')::uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not account_active() then raise exception 'ACCOUNT_BANNED'; end if;
  if court is null and exists(select 1 from profiles where id=auth.uid() and role='owner') then raise exception 'COURT_REQUIRED'; end if;
  if court is not null and not exists(select 1 from courts c join venues v on v.id=c.venue_id join profiles p on p.id=v.owner_id
    where c.id=court and c.is_active and v.status='active' and v.owner_id=auth.uid() and p.owner_application_status='active') then raise exception 'FORBIDDEN'; end if;
  if (p_data->>'starts_at')::timestamp at time zone 'Asia/Ho_Chi_Minh' <= now() then raise exception 'TOURNAMENT_START_PAST'; end if;
  if (p_data->>'registration_deadline')::timestamp at time zone 'Asia/Ho_Chi_Minh' <= now() then raise exception 'TOURNAMENT_REGISTRATION_PAST'; end if;
  if (p_data->>'ends_at')::timestamp <= (p_data->>'starts_at')::timestamp then raise exception 'TOURNAMENT_END_INVALID'; end if;
  if coalesce(nullif(p_data->>'payment_deadline','')::timestamp,(p_data->>'starts_at')::timestamp) > (p_data->>'starts_at')::timestamp then raise exception 'TOURNAMENT_PAYMENT_INVALID'; end if;
  if (p_data->>'registration_deadline')::timestamp > coalesce(nullif(p_data->>'payment_deadline','')::timestamp,(p_data->>'starts_at')::timestamp) then raise exception 'TOURNAMENT_REGISTRATION_INVALID'; end if;
  insert into tournaments(manager_id,court_id,title,description,sport,address,starts_at,ends_at,registration_deadline,capacity,entry_fee,deposit_amount,payment_deadline,payment_hold_hours,cancel_window_hours)
  values(auth.uid(),court,trim(p_data->>'title'),trim(p_data->>'description'),(p_data->>'sport')::sport_type,trim(p_data->>'address'),
    (p_data->>'starts_at')::timestamp at time zone 'Asia/Ho_Chi_Minh', (p_data->>'ends_at')::timestamp at time zone 'Asia/Ho_Chi_Minh',
    (p_data->>'registration_deadline')::timestamp at time zone 'Asia/Ho_Chi_Minh', (p_data->>'capacity')::int,(p_data->>'entry_fee')::int,(p_data->>'deposit_amount')::int,
    coalesce(nullif(p_data->>'payment_deadline','')::timestamp at time zone 'Asia/Ho_Chi_Minh', (p_data->>'starts_at')::timestamp at time zone 'Asia/Ho_Chi_Minh'),
    coalesce((p_data->>'payment_hold_hours')::int,24),24)
  returning id into result;
  return result;
end $$;

notify pgrst,'reload schema';
