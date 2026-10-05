-- Optional tournament covers. Keep avatars in their existing bucket.
alter table public.tournaments add column cover_path text;
alter table public.tournaments add constraint tournament_cover_path_format
  check (cover_path is null or cover_path ~ ('^' || manager_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tournament-photos','tournament-photos',true,5242880,array['image/jpeg','image/png','image/webp']);

create policy tournament_photos_insert on storage.objects for insert to authenticated
with check(bucket_id='tournament-photos' and public.account_active()
  and name ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$'));
create policy tournament_photos_read_own on storage.objects for select to authenticated
using(bucket_id='tournament-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy tournament_photos_delete on storage.objects for delete to authenticated
using(bucket_id='tournament-photos' and public.account_active()
  and (storage.foldername(name))[1]=auth.uid()::text
  and not exists(select 1 from public.tournaments t where t.manager_id=auth.uid() and t.cover_path=storage.objects.name));

create or replace function public.create_tournament_proposal(p_data jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid; court uuid:=nullif(p_data->>'court_id','')::uuid; cover text:=nullif(p_data->>'cover_path','');
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
  if cover is not null then
    if cover !~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') then raise exception 'TOURNAMENT_IMAGE_INVALID'; end if;
    -- Lock the object until submission commits, so deletion cannot race linking it.
    perform 1 from storage.objects o where o.bucket_id='tournament-photos' and o.name=cover
      and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')
      and (o.metadata->>'size')::bigint between 1 and 5242880 for share;
    if not found then raise exception 'TOURNAMENT_IMAGE_INVALID'; end if;
  end if;
  insert into tournaments(manager_id,court_id,title,description,sport,address,starts_at,ends_at,registration_deadline,capacity,entry_fee,deposit_amount,payment_deadline,payment_hold_hours,cancel_window_hours,cover_path)
  values(auth.uid(),court,trim(p_data->>'title'),trim(p_data->>'description'),(p_data->>'sport')::sport_type,trim(p_data->>'address'),
    (p_data->>'starts_at')::timestamp at time zone 'Asia/Ho_Chi_Minh', (p_data->>'ends_at')::timestamp at time zone 'Asia/Ho_Chi_Minh',
    (p_data->>'registration_deadline')::timestamp at time zone 'Asia/Ho_Chi_Minh', (p_data->>'capacity')::int,(p_data->>'entry_fee')::int,(p_data->>'deposit_amount')::int,
    coalesce(nullif(p_data->>'payment_deadline','')::timestamp at time zone 'Asia/Ho_Chi_Minh', (p_data->>'starts_at')::timestamp at time zone 'Asia/Ho_Chi_Minh'),
    coalesce((p_data->>'payment_hold_hours')::int,24),24,cover)
  returning id into result;
  return result;
end $$;

create or replace function public.resubmit_tournament(p_id uuid,p_data jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare old_t tournaments; draft tournaments; temp_id uuid;
begin
 select * into old_t from tournaments where id=p_id for update;
 if not found or old_t.manager_id<>auth.uid() or not account_active() then raise exception 'FORBIDDEN'; end if;
 if old_t.status not in ('pending','rejected') then raise exception 'TOURNAMENT_NOT_EDITABLE'; end if;
 -- Reuse the same SQL validation as first submission, without publishing an intermediate proposal.
 temp_id:=create_tournament_proposal(p_data);
 select * into draft from tournaments where id=temp_id;
 update tournaments set title=draft.title,description=draft.description,cover_path=draft.cover_path,sport=draft.sport,court_id=draft.court_id,
 address=draft.address,starts_at=draft.starts_at,ends_at=draft.ends_at,registration_deadline=draft.registration_deadline,
 payment_deadline=draft.payment_deadline,payment_hold_hours=draft.payment_hold_hours,cancel_window_hours=draft.cancel_window_hours,
 capacity=draft.capacity,entry_fee=draft.entry_fee,deposit_amount=draft.deposit_amount,status='pending',review_note='',reviewed_by=null
 where id=p_id;
 delete from notifications where tournament_id=temp_id;
 delete from tournaments where id=temp_id;
 if draft.court_id is not null then perform review_tournament(p_id,true,draft.court_id); end if;
 return p_id;
end $$;

-- Draft writer remains internal; only checked submission RPCs may link covers.
revoke all on function public.create_tournament_proposal(jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
