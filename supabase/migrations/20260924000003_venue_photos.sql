-- Public marketing photos are separate from private business documents.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('venue-photos', 'venue-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy venue_photos_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'venue-photos' and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.venues v where v.id::text = (storage.foldername(name))[2]
    and v.owner_id = auth.uid())
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$'
);
create policy venue_photos_owner_read on storage.objects for select to authenticated
using (bucket_id = 'venue-photos' and (storage.foldername(name))[1] = auth.uid()::text);
-- Detach first, then delete the object. Failed cleanup never breaks published photos.
create policy venue_photos_delete on storage.objects for delete to authenticated
using (bucket_id = 'venue-photos' and (storage.foldername(name))[1] = auth.uid()::text
  and not exists (select 1 from public.venues v where storage.objects.name = any(v.images)));

create or replace function public.set_venue_images(p_venue_id uuid, p_images text[], p_expected text[])
returns text[] language plpgsql security definer set search_path = public as $$
declare v_venue venues%rowtype; v_path text;
begin
  select * into v_venue from venues where id = p_venue_id and owner_id = auth.uid() for update;
  if not found then raise exception 'VENUE_NOT_FOUND'; end if;
  if p_expected is distinct from v_venue.images then raise exception 'IMAGES_CHANGED'; end if;
  if p_images is null or cardinality(p_images) > 8
    or cardinality(p_images) <> (select count(distinct p) from unnest(p_images) p) then
    raise exception 'IMAGES_INVALID';
  end if;
  foreach v_path in array p_images loop
    if v_path is null or v_path !~ ('^' || auth.uid()::text || '/' || p_venue_id::text || '/[0-9a-f-]{36}\.(webp|jpg|png)$')
      or not exists (select 1 from storage.objects o where o.bucket_id = 'venue-photos' and o.name = v_path
        and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')
        and (o.metadata->>'size')::bigint between 1 and 5242880) then
      raise exception 'IMAGES_INVALID';
    end if;
  end loop;
  update venues set images = p_images where id = p_venue_id;
  return p_images;
end $$;
revoke all on function public.set_venue_images(uuid,text[],text[]) from public, anon;
grant execute on function public.set_venue_images(uuid,text[],text[]) to authenticated;
