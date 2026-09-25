-- Price writes stay in Postgres, with ownership checked even for direct RPC calls.
create or replace function public.save_price_rule(
  p_court_id uuid, p_rule_id uuid, p_label text, p_days int[],
  p_start_time time, p_end_time time, p_price_per_hour int, p_priority int
) returns public.price_rules
language plpgsql security definer set search_path = public as $$
declare
  v_rule public.price_rules%rowtype;
  v_status public.venue_status;
begin
  select v.status into v_status
  from public.courts c join public.venues v on v.id = c.venue_id
  where c.id = p_court_id and v.owner_id = auth.uid()
  for update of c;
  if not found then raise exception 'COURT_NOT_FOUND'; end if;
  if v_status = 'rejected' then raise exception 'VENUE_NOT_EDITABLE'; end if;

  if p_rule_id is not null then
    select * into v_rule from public.price_rules
    where id = p_rule_id and court_id = p_court_id for update;
    if not found then raise exception 'PRICE_RULE_NOT_FOUND'; end if;
  end if;
  if p_price_per_hour is null or p_price_per_hour not between 1000 and 10000000 then
    raise exception 'PRICE_INVALID';
  end if;

  -- This generated rule follows court/venue hours in update_court/update_venue.
  -- Its rate is editable; its coverage remains the all-day fallback.
  if v_rule.label = 'Giá chung' then
    update public.price_rules set price_per_hour = p_price_per_hour
    where id = p_rule_id returning * into v_rule;
    return v_rule;
  end if;

  if coalesce(trim(p_label), '') = '' or length(trim(p_label)) > 80 then
    raise exception 'PRICE_LABEL_INVALID';
  end if;
  if trim(p_label) = 'Giá chung' then raise exception 'BASE_PRICE_RESERVED'; end if;
  if p_days is null or cardinality(p_days) not between 1 and 7
    or array_position(p_days, null) is not null or not p_days <@ array[0,1,2,3,4,5,6] then
    raise exception 'PRICE_DAYS_INVALID';
  end if;
  if p_start_time is null or p_end_time is null or p_end_time <= p_start_time then
    raise exception 'INVALID_HOURS';
  end if;
  if p_priority is null or p_priority not between 0 and 100 then
    raise exception 'PRICE_PRIORITY_INVALID';
  end if;

  if p_rule_id is null then
    insert into public.price_rules (court_id, label, days, start_time, end_time, price_per_hour, priority)
    values (p_court_id, trim(p_label), p_days, p_start_time, p_end_time, p_price_per_hour, p_priority)
    returning * into v_rule;
  else
    update public.price_rules set label = trim(p_label), days = p_days,
      start_time = p_start_time, end_time = p_end_time,
      price_per_hour = p_price_per_hour, priority = p_priority
    where id = p_rule_id returning * into v_rule;
  end if;
  return v_rule;
end $$;

create or replace function public.delete_price_rule(p_court_id uuid, p_rule_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rule public.price_rules%rowtype;
  v_status public.venue_status;
begin
  select v.status into v_status
  from public.courts c join public.venues v on v.id = c.venue_id
  where c.id = p_court_id and v.owner_id = auth.uid() for update of c;
  if not found then raise exception 'COURT_NOT_FOUND'; end if;
  if v_status = 'rejected' then raise exception 'VENUE_NOT_EDITABLE'; end if;
  select * into v_rule from public.price_rules
  where id = p_rule_id and court_id = p_court_id for update;
  if not found then raise exception 'PRICE_RULE_NOT_FOUND'; end if;
  if v_rule.label = 'Giá chung' then raise exception 'BASE_PRICE_REQUIRED'; end if;
  delete from public.price_rules where id = p_rule_id;
end $$;

revoke all on function public.save_price_rule(uuid, uuid, text, int[], time, time, int, int) from public, anon;
revoke all on function public.delete_price_rule(uuid, uuid) from public, anon;
grant execute on function public.save_price_rule(uuid, uuid, text, int[], time, time, int, int) to authenticated;
grant execute on function public.delete_price_rule(uuid, uuid) to authenticated;
